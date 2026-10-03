import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: NextRequest) {
  try {
    // 1. API 키 검증
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: '서버에 Gemini API 키가 설정되지 않았습니다. .env.local을 확인하세요.' },
        { status: 500 }
      );
    }

    // 2. 폼 데이터에서 '다중 이미지' 파일 배열 추출
    // 팩트 체크: 프론트엔드가 'images'라는 키로 여러 장을 보내므로 getAll('images')로 정확히 받아야 합니다.
    const formData = await req.formData();
    const files = formData.getAll('images') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: '사진 파일이 전송되지 않았습니다.' },
        { status: 400 }
      );
    }

    // 3. 다중 이미지를 AI가 읽을 수 있는 Base64 파트 배열로 각각 변환
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

    // 4. Gemini AI 모델 초기화 (에러 로그에서 권장한 최신 3.8-flash 모델 적용)
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.8-flash' });
    
    const prompt = `당신은 B2B 산업 현장 안전점검 AI입니다. 첨부된 사진을 꼼꼼히 분석하여 다음 형식의 마크다운(Markdown)으로 보고서를 작성해주세요.
1. **점검 대상 및 개요**: 글머리 기호(-)를 사용하여 핵심만 요약
2. **세부 점검 결과**: 반드시 표(Table) 형식을 사용하여 '구분', '상태', '위험 요소', '조치 권고사항'을 정리할 것
3. **종합 판정**: [정상], [주의], [위험] 중 하나를 명확히 기재`;

    // 5. AI 호출 및 결과 추출 (여러 장의 이미지가 담긴 imageParts 배열을 그대로 전달)
    const result = await model.generateContent([prompt, ...imageParts]);
    const response = await result.response;
    const text = response.text();

    // 6. 정상 처리 결과 반환
    return NextResponse.json({ report: text });

  } catch (error: any) {
    console.error('AI 분석 백엔드 에러:', error);
    return NextResponse.json(
      { error: error.message || 'AI 분석 중 서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}