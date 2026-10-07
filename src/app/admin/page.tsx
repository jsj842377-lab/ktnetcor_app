import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({ error: '서버에 Gemini API 키가 설정되지 않았습니다.' }, { status: 500 });
    }

    const formData = await req.formData();
    const files = formData.getAll('images') as File[];
    const photoDate = formData.get('photoDate') as string || '알 수 없음';
    const projectNumber = formData.get('projectNumber') as string || '미상';
    const workType = formData.get('workType') as string || '일반작업';
    const workDesc = formData.get('workDesc') as string || '현장 점검';
    const inspector = formData.get('inspector') as string || '경기 서부설계팀';

    if (!files || files.length === 0) {
      return NextResponse.json({ error: '사진 파일이 전송되지 않았습니다.' }, { status: 400 });
    }

    const imageParts = await Promise.all(
      files.map(async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        return { inlineData: { data: buffer.toString('base64'), mimeType: file.type } };
      })
    );

    // ── 모델 후보 목록 만들기 (우선순위 순) ──
    const modelListRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const modelListData = await modelListRes.json();

    const availableModels: string[] = (modelListData.models || [])
      .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m: any) => m.name.replace('models/', ''));

    // 환경변수로 모델을 지정하면 최우선 후보로 사용 (예: GEMINI_MODEL=gemini-2.5-flash)
    const preferredModel = process.env.GEMINI_MODEL?.trim();

    const candidates: string[] = [
      preferredModel,
      availableModels.find((m) => m.includes('3.8-flash')),
      availableModels.find((m) => m.includes('2.5-flash')),
      availableModels.find((m) => m.includes('1.5-flash')),
      availableModels.find((m) => m.includes('flash')),
      availableModels[0],
    ].filter((m, i, arr): m is string => !!m && arr.indexOf(m) === i); // 빈 값/중복 제거

    if (candidates.length === 0) {
      throw new Error('이 API 키로는 사용할 수 있는 AI 모델이 없습니다. 구글 AI 스튜디오에서 키를 새로 발급받아주세요.');
    }

    console.log('✅ [디버깅] AI 모델 후보(우선순위 순):', candidates.join(', '));

    const genAI = new GoogleGenerativeAI(apiKey);

    const prompt = `당신은 B2B 산업 현장 안전점검 AI입니다. 첨부된 사진들을 꼼꼼히 분석하여, 반드시 아래의 [안전점검 결과보고서] 양식과 100% 동일한 마크다운(Markdown) 표 형태로 결과를 작성해주세요.

[작성 지침]
1. **공사번호**: "${projectNumber}"
2. **점검일자**: "${photoDate}"
3. **작업공정**: "${workType}"
4. **작업내용**: "${workDesc}"
5. **점검자**: "${inspector}"
6. **조치사항 및 비고**: 사람이 직접 검토할 예정이므로 AI는 절대로 내용을 채우지 말고 빈칸( )으로 두세요.
7. **결과(양호/불량)**: 지정된 점검항목에 대해 사진을 분석하여 단답으로 작성하세요.
8. **시간적 순서 파악**: 제공된 여러 장의 사진은 왼쪽부터 오른쪽으로 갈수록 '작업 전 ➔ 작업 중 ➔ 작업 후'의 시간 순서입니다.
9. **전후 비교 분석**: 첫 번째 사진에 위험 요소가 있었더라도 마지막 사진에서 개선되었다면 조치 완료로 인지하세요.
10. **최종 결과 기준**: 결과 항목은 중간 과정이 아닌 마지막 사진(최종 상태)을 최우선 기준으로 판정하세요.

### 안전점검 결과보고서

#### ■ 기본 정보
| 항목 | 내용 | 항목 | 내용 |
|---|---|---|---|
| **공사번호** | ${projectNumber} | **점검일자** | ${photoDate} |
| **작업공정** | ${workType} | **점검자** | ${inspector} |
| **작업내용** | ${workDesc} | | |

#### ■ 안전점검 항목
| 점검항목 | 결과(양호/불량) | 조치사항 | 비고 |
|---|---|---|---|
| 보호구 착용 상태 | (AI 판정) | | |
| 안전표지 설치 | (AI 판정) | | |
| 사다리 및 장비 상태 | (AI 판정) | | |
| 적정 공법 적용 상태 | (AI 판정) | | |
| 정리정돈 상태 | (AI 판정) | | |
`;

    // ── 모델별 재시도 → 실패하면 다음 모델로 폴백 ──
    const MAX_ATTEMPTS_PER_MODEL = 3;
    let result;

    for (const modelName of candidates) {
      const model = genAI.getGenerativeModel({ model: modelName });

      for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_MODEL; attempt++) {
        try {
          result = await model.generateContent([prompt, ...imageParts]);
          console.log(`✅ [디버깅] 분석 성공 모델: ${modelName} (시도 ${attempt}회)`);
          break;
        } catch (err: any) {
          const status = err.status || err.response?.status;

          if (status === 429) {
            throw new Error('일일 API 할당량이 소진되었습니다.');
          }

          if (status === 503) {
            console.warn(`⚠️ [${modelName}] 503 과부하 (시도 ${attempt}/${MAX_ATTEMPTS_PER_MODEL})`);
            if (attempt < MAX_ATTEMPTS_PER_MODEL) {
              await delay(attempt * 3000); // 3초, 6초 대기 후 재시도
              continue;
            }
            break; // 이 모델은 포기하고 다음 모델로
          }

          // 모델이 없거나 지원하지 않는 경우(404 등)도 다음 모델로 시도
          if (status === 404) {
            console.warn(`⚠️ [${modelName}] 사용 불가(404), 다음 모델로 전환`);
            break;
          }

          throw err; // 그 외 에러는 즉시 중단
        }
      }

      if (result) break;
    }

    if (!result) {
      throw new Error('현재 AI 서버가 혼잡합니다. 잠시 후 다시 시도해주세요.');
    }

    const response = await result.response;
    return NextResponse.json({ report: response.text() });

  } catch (error: any) {
    console.error('AI API 에러:', error);
    return NextResponse.json({ error: error.message || '서버 오류 발생' }, { status: 500 });
  }
}