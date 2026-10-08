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
    const photoLocation = formData.get('photoLocation') as string || '위치 정보 없음'; 
    const projectNumber = formData.get('projectNumber') as string || '미상';
    const workType = formData.get('workType') as string || '일반작업';
    const workDesc = formData.get('workDesc') as string || '현장 점검';
    const inspector = formData.get('inspector') as string || '미상';

    if (!files || files.length === 0) {
      return NextResponse.json({ error: '사진 파일이 전송되지 않았습니다.' }, { status: 400 });
    }

    const imageParts = await Promise.all(
      files.map(async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        return { inlineData: { data: buffer.toString('base64'), mimeType: file.type || 'image/jpeg' } };
      })
    );

    const modelListRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const modelListData = await modelListRes.json();
    
    let targetModelName = '';

    if (modelListData.models) {
      const availableModels = modelListData.models
        .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m: any) => m.name.replace('models/', ''));
        
      targetModelName = 
        availableModels.find((m: string) => m.includes('3.8-flash')) ||
        availableModels.find((m: string) => m.includes('2.5-flash')) || 
        availableModels.find((m: string) => m.includes('1.5-flash')) ||
        availableModels.find((m: string) => m.includes('flash')) || 
        availableModels[0]; 
    }

    if (!targetModelName) {
      throw new Error('이 API 키로는 사용할 수 있는 AI 모델이 아예 없습니다.');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: targetModelName });
    
    // ★ 변경점: 포멀한 어투 지시 및 '3. 종합 특이사항' 섹션 추가
    const prompt = `당신은 B2B 산업 현장 안전점검 AI입니다. 첨부된 사진들을 꼼꼼히 분석하여, 반드시 아래의 [현장 안전점검 결과보고서] 양식과 100% 동일한 마크다운(Markdown) 형태로 결과를 작성해주세요.

[작성 지침]
1. 어투: 공공기관 및 대기업 제출용으로 적합한 매우 딱딱하고 격식 있는 보고서 어투를 사용하세요.
2. 조치사항 및 비고, 종합 특이사항 란은 사람이 직접 검토하고 수기 작성할 예정이므로 AI는 절대로 임의의 내용을 채우지 말고 빈칸( )으로 두세요.
3. 결과(양호/불량): 지정된 점검항목에 대해 사진을 분석하여 양호 또는 불량 단답으로 작성하세요.
4. 시간적 순서 파악: 제공된 여러 장의 사진은 왼쪽부터 시간 순서입니다. 마지막 사진을 기준으로 최종 판정하세요.

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

    let result;
    let retries = 0;
    const maxRetries = 2;
    
    while (retries < maxRetries) {
      try {
        result = await model.generateContent([prompt, ...imageParts]);
        break; 
      } catch (err: any) {
        const status = err.status || err.response?.status;
        if (status === 429) throw new Error('일일 API 할당량이 소진되었습니다.');
        if (status === 503 && retries < maxRetries - 1) {
          retries++;
          await delay(Math.pow(2, retries) * 1500);
          continue;
        }
        throw err; 
      }
    }
    
    if (!result) throw new Error('AI 분석 결과를 받아오지 못했습니다.');

    const response = await result.response;
    return NextResponse.json({ report: response.text() });

  } catch (error: any) {
    console.error('AI API 에러:', error);
    return NextResponse.json({ error: error.message || '서버 오류 발생' }, { status: 500 });
  }
}