import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// 503 에러 발생 시 자동 재시도를 위한 지연 함수
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
    const reportDate = formData.get('reportDate') as string || '알 수 없음';

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
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    // 퓨샷 프롬프팅: 사람과 AI의 역할을 분리하고 조치사항/비고를 철저히 빈칸으로 강제
    const prompt = `당신은 B2B 산업 현장 안전점검 AI입니다. 첨부된 사진들을 꼼꼼히 분석하여, 반드시 아래의 [안전점검 결과보고서] 양식과 100% 동일한 마크다운(Markdown) 표 형태로 결과를 작성해주세요.

[작성 지침]
1. '조치사항'과 '비고' 칸은 2차로 사람이 직접 점검하며 작성할 예정이므로, AI는 절대로 내용을 채우지 말고 완벽히 빈칸( )으로 비워두세요.
2. '결과(양호/불량)' 칸만 사진을 분석하여 AI가 1차 판단한 결과(양호 또는 불량)를 작성하세요.
3. 지정된 5개의 점검항목을 임의로 삭제하거나 변경하지 마세요.

### 안전점검 결과보고서

#### ■ 기본 정보
| 항목 | 내용 | 항목 | 내용 |
|---|---|---|---|
| **공사번호** | | **점검일자** | ${reportDate} |
| **작업공정** | (사진 기반 추정) | **점검자** | |
| **작업내용** | (사진 기반 핵심 요약) | | |

#### ■ 안전점검 항목
| 점검항목 | 결과(양호/불량) | 조치사항 | 비고 |
|---|---|---|---|
| 보호구 착용 상태 | (AI 판정) | | |
| 안전표지 설치 | (AI 판정) | | |
| 사다리 및 장비 상태 | (AI 판정) | | |
| 적정 공법 적용 상태 | (AI 판정) | | |
| 정리정돈 상태 | (AI 판정) | | |

실제 첨부된 사진 상황에 맞추어 위 양식 그대로 결과를 생성하세요.`;

    let retries = 0;
    const maxRetries = 3;
    let result;

    // 429 및 503 에러 핸들링 세분화 적용
    while (retries < maxRetries) {
      try {
        result = await model.generateContent([prompt, ...imageParts]);
        break; // 성공 시 반복문 탈출
      } catch (err: any) {
        retries++;
        const status = err.status || err.response?.status;
        const errMsg = err.message?.toLowerCase() || '';

        // 429 에러(일일 할당량 초과) 감지 시 즉각 중단 및 명확한 에러 반환
        if (status === 429 || errMsg.includes('429') || errMsg.includes('quota')) {
          throw new Error('일일 API 할당량이 모두 소진되었습니다. 내일 다시 시도하거나 유료 플랜으로 전환해주세요.');
        }

        // 503 에러(서버 과부하) 감지 시 지수 백오프 대기 후 재시도
        const isOverloaded = status === 503 || errMsg.includes('overloaded') || errMsg.includes('unavailable');
        if (isOverloaded && retries < maxRetries) {
          const waitTime = Math.pow(2, retries) * 1500; // 3초, 6초...
          console.warn(`[서버 과부하 감지] ${waitTime/1000}초 후 자동 재시도 (${retries}/${maxRetries})`);
          await delay(waitTime);
        } else {
          throw err; 
        }
      }
    }

    if (!result) throw new Error('AI 분석에 실패했습니다.');

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