// 저장 위치: src/app/api/analyze/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_TOTAL_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function sanitizeField(value: FormDataEntryValue | null, fallback: string, maxLength = 100): string {
  const raw = typeof value === 'string' ? value : '';
  return raw.replace(/[\r\n\t]+/g, ' ').replace(/[|`]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength) || fallback;
}

function stripCodeFence(text: string): string {
  return text.trim().replace(/^```(?:markdown|md)?\s*\n/i, '').replace(/\n?```\s*$/, '').trim();
}

interface ReportInfo {
  projectNumber: string; photoDate: string; workType: string;
  inspector: string; workDesc: string; photoLocation: string;
}

function buildPrompt(info: ReportInfo): string {
  return `당신은 B2B 산업 현장 안전점검 AI입니다. 첨부된 사진들을 꼼꼼히 분석하여, 반드시 아래의 [현장 안전점검 결과보고서] 양식과 100% 동일한 마크다운(Markdown) 형태로 결과를 작성해주세요.

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
| **공사번호** | ${info.projectNumber} | **점검일자** | ${info.photoDate} |
| **작업공정** | ${info.workType} | **점검자** | ${info.inspector} |
| **작업내용** | ${info.workDesc} | **촬영위치** | ${info.photoLocation} |

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
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) throw new Error('서버에 Gemini API 키가 설정되지 않았습니다.');

    const formData = await req.formData();
    const files = formData.getAll('images').filter((f): f is File => typeof f !== 'string' && f.size > 0);

    if (files.length === 0) throw new Error('사진 파일이 전송되지 않았습니다.');
    if (files.length > MAX_FILES) throw new Error(`사진은 최대 ${MAX_FILES}장까지 업로드할 수 있습니다.`);

    let totalSize = 0;
    for (const file of files) {
      const mimeType = (file.type || 'image/jpeg').toLowerCase();
      if (!ALLOWED_MIME_TYPES.includes(mimeType)) throw new Error('지원하지 않는 이미지 형식입니다.');
      if (file.size > MAX_FILE_SIZE) throw new Error('사진 한 장의 용량이 너무 큽니다.');
      totalSize += file.size;
    }
    if (totalSize > MAX_TOTAL_SIZE) throw new Error('전체 사진 용량이 너무 큽니다.');

    const info: ReportInfo = {
      photoDate: sanitizeField(formData.get('photoDate'), '알 수 없음'),
      photoLocation: sanitizeField(formData.get('photoLocation'), '위치 정보 없음'),
      projectNumber: sanitizeField(formData.get('projectNumber'), '미상'),
      workType: sanitizeField(formData.get('workType'), '일반작업'),
      workDesc: sanitizeField(formData.get('workDesc'), '현장 점검', 200),
      inspector: sanitizeField(formData.get('inspector'), '미상'),
    };

    const imageParts = await Promise.all(
      files.map(async (file) => {
        const buffer = Buffer.from(await file.arrayBuffer());
        return { inlineData: { data: buffer.toString('base64'), mimeType: file.type || 'image/jpeg' } };
      })
    );

    const prompt = buildPrompt(info);
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // ★ 핵심 수정: 자동 모델 탐지 로직을 삭제하고 에러에서 요구한 3.8-flash 모델로 강제 고정
    const TARGET_MODEL = 'gemini-3.8-flash';
    console.log(`[디버깅] 실행 모델: ${TARGET_MODEL}`);
    
    const model = genAI.getGenerativeModel({
      model: TARGET_MODEL,
      generationConfig: { temperature: 0.2 },
    });

    let result;
    let retries = 0;
    const maxRetries = 2;

    while (retries <= maxRetries) {
      try {
        result = await model.generateContent([prompt, ...imageParts]);
        const text = stripCodeFence(result.response.text());
        if (!text) throw new Error('AI 분석 결과가 비어 있습니다.');
        return NextResponse.json({ report: text, model: TARGET_MODEL });
      } catch (err: any) {
        const msg = String(err?.message || '');
        if (msg.includes('429') || msg.includes('503')) {
          if (retries === maxRetries) throw new Error('서버 혼잡 또는 할당량 초과. 잠시 후 시도해주세요.');
          retries++;
          await delay(Math.pow(2, retries) * 1500);
          continue;
        }
        throw new Error(`AI 분석 실패: ${msg}`);
      }
    }
  } catch (error: any) {
    console.error('API 내부 에러:', error);
    return NextResponse.json({ error: error.message || '서버 오류 발생' }, { status: 500 });
  }
}