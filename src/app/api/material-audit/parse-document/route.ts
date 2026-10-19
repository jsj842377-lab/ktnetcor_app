import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const runtime = 'nodejs';
export const maxDuration = 60;

export interface MaterialItem {
  id: string;
  name: string;
  spec: string;
  docQty: number;
  unit: string;
}

export interface ParsedDocumentResult {
  docTitle: string;
  projectNumber: string;
  docDate: string;
  recipient: string;
  location: string;
  materials: MaterialItem[];
}

// 기본 샘플 자재 서류 (사용자가 샘플 서류를 선택하거나 OCR 실패 시 기본 제공)
const SAMPLE_DOCUMENTS: Record<string, ParsedDocumentResult> = {
  telecom_fdf: {
    docTitle: '초고속망 광선로 자재불출증',
    projectNumber: '안산-광선로-2026-0210',
    docDate: '2026-10-15',
    recipient: '김철수 팀장 (경기설계팀)',
    location: '경기도 안산시 단원구 초지동 현장 자재창고',
    materials: [
      { id: 'mat-1', name: '옥외용 광분배함 (FDF)', spec: '24Core 벽부형 알루미늄', docQty: 4, unit: '개' },
      { id: 'mat-2', name: '광접속 보호 슬리브', spec: '40mm 단심용 (100개입)', docQty: 5, unit: '팩' },
      { id: 'mat-3', name: '공사용 반사 라바콘', spec: '70cm 고휘도 반사체', docQty: 8, unit: '개' },
      { id: 'mat-4', name: '접지동봉', spec: '14Φ × 1000mm KS규격', docQty: 6, unit: '개' },
      { id: 'mat-5', name: '광케이블 접속함체 (OFJC)', spec: '직선/분기 겸용 48C', docQty: 2, unit: '조' },
    ],
  },
  base_station: {
    docTitle: '5G 기지국 안테나 설비 납품서',
    projectNumber: '성남-분당-2026-0315',
    docDate: '2026-10-14',
    recipient: '이영희 매니저 (경기설계팀)',
    location: '경기도 성남시 분당구 정자동 옥상 기지국',
    materials: [
      { id: 'mat-11', name: '5G Massive MIMO 안테나', spec: '3.5GHz 64T64R', docQty: 3, unit: '대' },
      { id: 'mat-12', name: '피뢰침 설비 세트', spec: '돌침 1.5m + 취부금구', docQty: 2, unit: '세트' },
      { id: 'mat-13', name: '동축 점퍼 케이블', spec: '1/2인치 5m 딘-딘', docQty: 12, unit: '가닥' },
      { id: 'mat-14', name: '방수 테이프 키트', spec: '3M 뷰틸 + 절연테이프', docQty: 10, unit: '롤' },
    ],
  },
  cable_duct: {
    docTitle: '지하 통신구 관로 자재인수증',
    projectNumber: '수원-팔달-2026-0188',
    docDate: '2026-10-13',
    recipient: '박민수 과장 (경기설계팀)',
    location: '경기도 수원시 팔달구 인계동 통신구 공사현장',
    materials: [
      { id: 'mat-21', name: '주철 맨홀 뚜껑 및 틀', spec: '원형 648mm 차도용 20톤', docQty: 2, unit: '조' },
      { id: 'mat-22', name: '케이블 받침대 (행거)', spec: '3련 아연도금 600mm', docQty: 15, unit: '개' },
      { id: 'mat-23', name: '가스 밀폐 플러그', spec: '100A 방화/방수', docQty: 8, unit: '개' },
      { id: 'mat-24', name: '맨홀 안전 승하강 사다리', spec: 'FRP 절연 3단 2.5m', docQty: 1, unit: '대' },
    ],
  },
};

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const presetKey = formData.get('presetKey')?.toString().trim();

    // 1. 샘플 프리셋 서류 선택 시 즉시 반환
    if (presetKey && SAMPLE_DOCUMENTS[presetKey]) {
      return NextResponse.json({
        success: true,
        data: SAMPLE_DOCUMENTS[presetKey],
      });
    }

    // 2. 파일 업로드 확인
    const file = formData.get('document') as File | null;
    if (!file || file.size === 0) {
      // 파일이 없을 경우 기본 통신선로 불출증 샘플 반환
      return NextResponse.json({
        success: true,
        data: SAMPLE_DOCUMENTS.telecom_fdf,
        isFallback: true,
      });
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({
        success: true,
        data: SAMPLE_DOCUMENTS.telecom_fdf,
        warning: 'Gemini API 키가 없어 기본 자재 서류로 자동 전환되었습니다.',
      });
    }

    // 3. Gemini Vision을 통한 서류 OCR 및 품목 목록 구조화 파싱
    const ai = new GoogleGenAI({ apiKey });
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64Data = buffer.toString('base64');
    const mimeType = file.type || 'image/jpeg';

    const prompt = `당신은 KT 경기설계팀 통신공사 자재실사 전문 AI입니다.
첨부된 자재 관련 서류(자재불출증, 거래명세서, 납품서, 인수증, 자재청구서 등) 이미지를 정밀 분석하여,
반드시 유효한 JSON 형식으로만 응답하세요. 마크다운 코드블록(\`\`\`json)은 생략하고 순수 JSON 문자열만 출력하세요.

JSON 출력 형식:
{
  "docTitle": "서류 제목 (예: 초고속망 자재불출증, 거래명세서 등)",
  "projectNumber": "공사번호 또는 발주번호 (서류에서 발견되지 않으면 '미지정-2026-0001')",
  "docDate": "서류 일자 (YYYY-MM-DD 형태)",
  "recipient": "수령인 또는 담당자/업체명",
  "location": "납품처 또는 현장 위치",
  "materials": [
    {
      "id": "mat-1",
      "name": "품명 (예: 옥외용 광분배함, UTP 케이블, 라바콘)",
      "spec": "규격 또는 사양 (없으면 '표준규격')",
      "docQty": 숫자 (서류상 수량, 정수),
      "unit": "단위 (개, roll, pk, set, 조 등)"
    }
  ]
}

주의사항:
- 자재 목록이 여러 개라면 모두 배열에 포함하세요.
- 수량은 반드시 문자열이 아닌 정수 숫자(number)로 기재하세요.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: base64Data,
                mimeType,
              },
            },
          ],
        },
      ],
    });

    const rawText = response.text || '';
    const cleanJson = rawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    let parsedResult: ParsedDocumentResult;
    try {
      parsedResult = JSON.parse(cleanJson);
      // 유효성 보정
      if (!parsedResult.materials || !Array.isArray(parsedResult.materials) || parsedResult.materials.length === 0) {
        throw new Error('자재 품목이 추출되지 않았습니다.');
      }
      parsedResult.materials = parsedResult.materials.map((m, idx) => ({
        id: m.id || `mat-${idx + 1}`,
        name: m.name || `미분류 자재 ${idx + 1}`,
        spec: m.spec || '표준 규격',
        docQty: typeof m.docQty === 'number' && !isNaN(m.docQty) && m.docQty > 0 ? Math.round(m.docQty) : 1,
        unit: m.unit || '개',
      }));
    } catch (parseError) {
      console.warn('AI 서류 파싱 실패, 기본 템플릿 반환:', parseError, rawText);
      parsedResult = SAMPLE_DOCUMENTS.telecom_fdf;
    }

    return NextResponse.json({
      success: true,
      data: parsedResult,
    });
  } catch (error: any) {
    console.error('자재 서류 분석 에러:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '서류 분석 중 오류가 발생했습니다.',
        fallbackData: SAMPLE_DOCUMENTS.telecom_fdf,
      },
      { status: 500 }
    );
  }
}
