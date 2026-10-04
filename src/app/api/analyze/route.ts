import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: '서버에 Gemini API 키가 설정되지 않았습니다.' }, { status: 500 });
    }

    const formData = await req.formData();
    const files = formData.getAll('images') as File[];
    const photoDate = formData.get('photoDate') as string || '알 수 없음';
    const projectNumber = formData.get('projectNumber') as string || '안산-설비-2026-0096';
    const workType = formData.get('workType') as string || '초고속 통신망 설비 점검';
    const workDesc = formData.get('workDesc') as string || '현장 안전 수칙 준수 및 자재 적재 상태 확인';
    const inspector = formData.get('inspector') as string || '경기 서부설계팀';

    if (!files || files.length === 0) {
      return NextResponse.json({ error: '사진 파일이 전송되지 않았습니다.' }, { status: 400 });
    }

    const imageParts = await Promise.all(
      files.map(async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        return {
          inlineData: {
            data: buffer.toString('base64'),
            mimeType: file.type,
          },
        };
      })
    );

    const genAI = new GoogleGenerativeAI(apiKey);
    
    const prompt = `당신은 B2B 산업 현장 안전점검 AI입니다. 첨부된 사진들을 꼼꼼히 분석하여, 반드시 아래의 [안전점검 결과보고서] 양식과 100% 동일한 마크다운(Markdown) 표 형태로 결과를 작성해주세요.

[작성 지침]
1. **공사번호**: 입력된 값("${projectNumber}")을 그대로 사용하세요.
2. **점검일자**: 입력된 값("${photoDate}")을 그대로 사용하세요.
3. **작업공정**: 입력된 값("${workType}")을 그대로 사용하세요.
4. **작업내용**: 입력된 값("${workDesc}")을 그대로 사용하세요.
5. **점검자**: 입력된 값("${inspector}")을 그대로 사용하세요.
6. **조치사항 및 비고**: 2차로 사람이 직접 점검하며 작성할 예정이므로, AI는 절대로 내용을 채우지 말고 완벽히 빈칸( )으로 비워두세요.
7. **결과(양호/불량)**: 지정된 5개의 점검항목에 대해 사진을 분석하여 AI가 1차 판단한 결과(양호 또는 불량)만 단답으로 작성하세요.

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

실제 첨부된 사진 상황에 맞추어 위 양식 그대로 결과를 생성하세요.`;

    // ★ 404 Not Found 에러를 원천 차단하는 모델 자동 릴레이(Fallback) 시스템
    const fallbackModels = [
      process.env.GEMINI_MODEL,  // 1순위: Vercel에 설정한 환경변수 우선 적용 (없으면 무시됨)
      'gemini-1.5-flash-002',    // 2순위: 1.5 플래시 최신 명시적 버전
      'gemini-1.5-flash-001',    // 3순위: 1.5 플래시 초기 버전
      'gemini-1.5-pro',          // 4순위: 1.5 프로 버전
      'gemini-1.0-pro',          // 5순위: 1.0 프로 버전 (모든 지역 지원 보장)
      'gemini-pro'               // 6순위: 구형 레거시 식별자
    ].filter(Boolean) as string[];

    let result;
    let finalError;

    for (const modelName of fallbackModels) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        
        let retries = 0;
        const maxRetries = 2;
        
        while (retries < maxRetries) {
          try {
            result = await model.generateContent([prompt, ...imageParts]);
            break; // 정상 분석 완료 시 while문 탈출
          } catch (err: any) {
            const status = err.status || err.response?.status;
            const errMsg = err.message?.toLowerCase() || '';

            // 404 (모델 없음) 에러면 재시도 없이 곧바로 다음 모델로 교체
            if (status === 404 || errMsg.includes('404') || errMsg.includes('not found')) {
              throw err; 
            }

            // 할당량 초과 에러
            if (status === 429 || errMsg.includes('429') || errMsg.includes('quota')) {
              throw new Error('일일 API 할당량이 모두 소진되었습니다. 내일 다시 시도해주세요.');
            }

            // 서버 과부하 에러 시 지수 백오프(Exponential Backoff) 지연 후 재시도
            const isOverloaded = status === 503 || errMsg.includes('overloaded') || errMsg.includes('unavailable');
            if (isOverloaded && retries < maxRetries) {
              retries++;
              await delay(Math.pow(2, retries) * 1500);
            } else {
              throw err;
            }
          }
        }
        
        if (result) {
          console.log(`[분석 성공] ${modelName} 모델이 호출되었습니다.`);
          break; // 정상 완료되었으므로 for문 전체 탈출
        }
      } catch (err: any) {
        console.warn(`[모델 호출 실패] ${modelName} 사용 불가. 다음 모델로 전환합니다.`);
        finalError = err;
        continue; 
      }
    }

    if (!result) {
      throw new Error(finalError?.message || '사용 가능한 AI 모델이 서버에 존재하지 않거나 호출 권한이 없습니다.');
    }

    const response = await result.response;
    const text = response.text();

    return NextResponse.json({ report: text });

  } catch (error: any) {
    console.error('AI 분석 백엔드 에러:', error);
    return NextResponse.json(
      { error: error.message || 'AI 분석 중 서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}