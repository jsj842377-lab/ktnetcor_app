// 저장 위치: src/app/api/analyze/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const runtime = 'nodejs';

/**
 * ★ 추가된 핵심 함수: "37.398022, 126.931778" 형태의 좌표를 감지하여 한글 주소로 자동 변환
 */
async function resolveLocationToKoreanAddress(rawLocation: string): Promise<string> {
  const trimmed = rawLocation.trim();
  // 위도, 경도 숫자 좌표 패턴인지 정규식으로 검사 (예: "37.398022, 126.931778")
  const coordMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!coordMatch) {
    return trimmed; // 이미 한글 주소이거나 일반 텍스트면 그대로 반환
  }

  const lat = coordMatch[1];
  const lon = coordMatch[2];

  try {
    // 3초 타임아웃 설정 (Vercel 10초 제한 방지)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1&accept-language=ko`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'KTNetcorSafetyInspectionApp/1.0',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) return trimmed;
    const data = await res.json();

    // 1순위: 행정구역 객체(address)를 한국식 주소 순서(시/도 -> 시/군/구 -> 동/읍/면 -> 도로명/번지)로 조합
    const addr = data?.address;
    if (addr) {
      const parts = [
        addr.province || addr.state || '',
        addr.city || addr.county || '',
        addr.borough || addr.city_district || addr.district || '',
        addr.quarter || addr.suburb || addr.neighbourhood || addr.town || addr.village || '',
        addr.road || '',
        addr.house_number || '',
      ].filter(Boolean);

      // 중복 단어 제거 (예: 시/도와 시/군/구가 중복될 경우)
      const uniqueParts = parts.filter((item, idx) => parts.indexOf(item) === idx);
      if (uniqueParts.length >= 2) {
        return uniqueParts.join(' ');
      }
    }

    // 2순위: display_name 문자열을 역순(대한민국 큰 단위부터)으로 정렬하여 반환
    if (data?.display_name) {
      const reversedAddress = data.display_name
        .split(',')
        .map((s: string) => s.trim())
        .filter((s: string) => s !== '대한민국' && s !== 'South Korea' && !/^\d{5}$/.test(s))
        .reverse()
        .join(' ');
      if (reversedAddress) return reversedAddress;
    }

    return trimmed;
  } catch (err) {
    console.warn('좌표 -> 주소 변환 실패, 원본 값 유지:', err);
    return trimmed;
  }
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({ error: '서버에 Gemini API 키가 설정되지 않았습니다.' }, { status: 500 });
    }

    const TARGET_MODEL = 'gemini-3.8-flash';

    const formData = await req.formData();
    const files = formData.getAll('images').filter((f): f is File => typeof f !== 'string' && f.size > 0);

    if (files.length === 0) {
      return NextResponse.json({ error: '사진 파일이 전송되지 않았습니다.' }, { status: 400 });
    }

    const projectNumber = formData.get('projectNumber')?.toString().trim() || '미입력';
    const photoDate = formData.get('photoDate')?.toString().trim() || '알 수 없음';
    const workType = formData.get('workType')?.toString().trim() || '미입력';
    const inspector = formData.get('inspector')?.toString().trim() || '미상';
    const workDesc = formData.get('workDesc')?.toString().trim() || '미입력';
    const rawPhotoLocation = formData.get('photoLocation')?.toString().trim() || '위치 정보 없음';

    // ★ 좌표 형태("37.398022, 126.931778")일 경우 한글 주소로 즉시 변환
    const photoLocation = await resolveLocationToKoreanAddress(rawPhotoLocation);

    const prompt = `당신은 B2B 산업 현장 안전점검 AI입니다. 첨부된 사진들을 꼼꼼히 분석하여, 반드시 아래의 [현장 안전점검 결과보고서] 양식과 100% 동일한 마크다운(Markdown) 형태로 결과를 작성해주세요.

[작성 지침]
1. 어투: 공공기관 및 대기업 제출용으로 적합한 매우 딱딱하고 격식 있는 보고서 어투를 사용하세요.
2. 조치사항 및 비고, 종합 특이사항 란은 사람이 직접 검토하고 수기 작성할 예정이므로 AI는 절대로 임의의 내용을 채우지 말고 빈칸( )으로 두세요.
3. 결과(양호/불량): 지정된 점검항목에 대해 사진을 분석하여 양호 또는 불량 단답으로 작성하세요.
4. 시간적 순서 파악: 제공된 여러 장의 사진은 왼쪽부터 시간 순서입니다. 마지막 사진을 기준으로 최종 판정하세요.
5. 마크다운 코드블록(\`\`\`)으로 감싸지 말고, 보고서 본문만 출력하세요.

### 현장 안전점검 결과보고서

#### ■ 1. 기본 정보
| 항목 | 내용 | 항목 | 내용 |
|---|---|---|---|
| **공사번호** | ${projectNumber} | **점검일자** | ${photoDate} |
| **작업공정** | ${workType} | **점검자** | ${inspector} |
| **작업내용** | ${workDesc} | **촬영위치** | ${photoLocation} |

#### ■ 2. 점검 항목 및 결과
| 점검항목 | 결과(양호/불량) | 조치사항 | 비고 |
|---|---|---|---|
| 보호구 착용 상태 | (AI 판정) | | |
| 안전표지 설치 | (AI 판정) | | |
| 사다리 및 장비 상태 | (AI 판정) | | |
| 적정 공법 적용 상태 | (AI 판정) | | |
| 정리정돈 상태 | (AI 판정) | | |

#### ■ 3. 종합 특이사항
| 내용 |
|---|
| ( ) |
`;

    const imageParts = await Promise.all(
      files.map(async (file) => {
        const buffer = Buffer.from(await file.arrayBuffer());
        return { inlineData: { data: buffer.toString('base64'), mimeType: file.type || 'image/jpeg' } };
      })
    );

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: TARGET_MODEL, 
      generationConfig: { temperature: 0.2 } 
    });

    const result = await model.generateContent([prompt, ...imageParts]);
    let text = result.response.text();
    text = text.replace(/^```(?:markdown|md)?\s*\n/i, '').replace(/\n?```\s*$/, '').trim();

    if (!text) {
      return NextResponse.json({ error: 'AI 분석 결과가 비어 있습니다.' }, { status: 502 });
    }

    return NextResponse.json({ report: text, model: TARGET_MODEL, resolvedLocation: photoLocation });

  } catch (error: any) {
    console.error('API 내부 에러:', error);
    return NextResponse.json({ error: error.message || '서버 오류 발생' }, { status: 500 });
  }
}