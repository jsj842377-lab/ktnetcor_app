import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: '서버에 Gemini API 키가 설정되지 않았습니다.' }, { status: 500 });
    }

    const formData = await req.formData();
    const files = formData.getAll('images') as File[];
    
    // ★ 추가: 두 가지 날짜 데이터를 모두 추출
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
    const model = genAI.getGenerativeModel({ model: 'gemini-3.8-flash' });
    
    // ★ 수정: 점검 개요 최상단에 두 날짜가 무조건 고정으로 출력되도록 프롬프트 강화
    const prompt = `당신은 B2B 산업 현장 안전점검 AI입니다. 첨부된 사진을 꼼꼼히 분석하여 다음 형식의 마크다운(Markdown)으로 보고서를 작성해주세요.

### 1. 점검 개요
- **사진 촬영 일시**: ${photoDate}
- **보고서 작성 일시**: ${reportDate}
- **점검 대상 및 내용**: (분석한 사진의 핵심 대상과 내용을 1~2줄로 요약할 것)

### 2. 세부 점검 결과
반드시 표(Table) 형식을 사용하여 '구분', '상태', '위험 요소', '조치 권고사항'을 정리할 것.

### 3. 종합 판정
[정상], [주의], [위험] 중 하나를 명확히 기재하고 짧은 총평을 덧붙일 것.`;

    const result = await model.generateContent([prompt, ...imageParts]);
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