import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userMessage,
      conversationHistory = [],
      excelSummary,
      availableMaterials = [],
      selectedItem,
      countResult,
      currentReportText,
      workerName = '실사관',
    } = body;

    if (!userMessage || typeof userMessage !== 'string') {
      return NextResponse.json({ error: '메시지가 입력되지 않았습니다.' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      // API 키 부재 시 스마트 룰베이스 응답
      return NextResponse.json({
        reply: `[안내] '${userMessage}'에 대한 처리: 현재 API 키 연동을 확인 중입니다. 엑셀에서 자재를 선택하시거나 사진을 올려주시면 즉시 계측과 보고서 작성이 진행됩니다.`,
        action: 'none',
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    // 간결한 자재 목록 프리뷰 (순번, 자재코드, 클래스 소분류, 전산/실사 수량 중심)
    const materialsPreview = (availableMaterials || []).slice(0, 50).map((m: any, idx: number) => {
      const seq = m.seq || (idx + 1);
      const code = m.materialCode || `MAT-${String(seq).padStart(4, '0')}`;
      const subCat = m.classSubcategory || m.category || '기본자재';
      const act = m.actualQty !== null && m.actualQty !== undefined ? `${m.actualQty}${m.unit || '개'}` : '미계측(수량없음)';
      return `[순번 ${seq} ↔ 사진 #${seq}] 자재코드: ${code} | 클래스 소분류: ${subCat} | 품명: ${m.name} | 전산: ${m.docQty}${m.unit || '개'} | 실사: ${act}`;
    }).join('\n');

    const prompt = `당신은 KT 경기설계팀의 전문 AI 현장 자재실사 어시스턴트입니다.
사용자(${workerName} 실사관)는 방금 현장 자재 서류(대용량 엑셀 파일 등)를 업로드하였고, 당신과 대화하면서 대상 자재를 탐색/선택하고 현장 사진을 계측하여 1장 규격의 [현장 자재실사 결과보고서]를 완성하려고 합니다.

[현재 세션 콘텍스트]
1. 엑셀 파일 요약:
${excelSummary || '업로드된 엑셀 서류 분석 중'}

2. 추출된 주요 자재 품목 목록 (순번은 현장 사진 순번과 1:1 매칭):
${materialsPreview || '검출된 자재 품목 없음'}

3. 현재 선택된 실사 대상 자재:
${selectedItem ? JSON.stringify(selectedItem) : '아직 선택되지 않음 (사용자가 대화나 클릭으로 선택 가능)'}

4. 현재 수량 계측 결과:
${countResult ? JSON.stringify(countResult) : '아직 계측 전 (사진 업로드 대기)'}

5. 작성 중인 보고서 마크다운:
${currentReportText ? '보고서 작성되어 있음' : '아직 생성 전'}

[사용자 입력 메시지]
"${userMessage}"

[당신의 핵심 역할 및 엄격 준수 지침]
★ 지침 1. [체크 항목의 엄격한 한정]
   - 당신(챗봇)은 자재실사 시 **오직 3가지 항목만을 체크**합니다:
     ① **자재코드** (Material Code, 예: MAT-0101)
     ② **클래스 소분류** (Class Subcategory, 예: 광분배함류, 5G안테나류)
     ③ **실사 수량** (전산수량 대비 실제 현장 수량 일치 여부)
   - 불필요한 잡다한 컬럼은 생략하고, 안내 시 반드시 이 3개 핵심 항목을 요약해서 명확히 체크하세요.
     (서식 예시):
     📋 **[자재실사 3대 핵심 체크 항목]**
     - 자재코드: **[자재코드]**
     - 클래스 소분류: **[클래스 소분류]**
     - 실사 수량: **[실사수량]** (전산수량: [전산수량])

★ 지침 2. [실사 수량이 없을 시 필수 질문]
   - 대상 자재의 실사 수량이 없거나 0, 미계측(null) 상태인 경우:
   - 반드시 **"실사 수량 계측을 실시하시겠습니까?"**라고 먼저 정중히 물어보세요.
   - 그리고 바로 이어서: **"현장 자재 사진을 업로드해 주시면 AI 비전 계측을 통해 실사 수량을 자동으로 측정해 드립니다. 📸"**라고 사진 업로드를 요청하세요.
   - action은 "prompt_photo_upload" 또는 "select_material"로 설정하세요.

★ 지침 3. [실사 수량 불일치 시 사유 질문]
   - 전산수량과 실사수량이 일치하지 않을 때(부족 또는 초과 등):
   - 반드시 사용자에게 불일치 사유를 구체적으로 질문하세요:
     "⚠️ **[실사 수량 불일치 확인]**
     자재코드: **{자재코드}**, 클래스 소분류: **{클래스 소분류}**의 전산 수량({전산수량})과 실사 수량({실사수량})이 불일치합니다.
     **불일치 사유(예: 시공 현장 투입, 포장 파손, 단순 오입고, 인근 공구 긴급 대여 등)를 말씀해 주시겠습니까?**"
   - 사용자가 불일치 사유를 답변하면, 그 사유를 보고서의 [현장 실사 및 계측 특이사항 / 불일치 사유]에 기록하고 action을 "update_report"로 지정하세요.

★ 지침 4. [대화형 수량/비고 수정 및 보고서 완성]
   - 사용자가 수량을 바꾸거나(예: "세어보니 3개야"), 비고를 추가하는 경우 즉시 수치와 보고서를 갱신하세요.
   - 사용자가 "보고서 완성해줘", "보고서 보여줘"라고 하거나 실사가 마무리될 때 action을 "complete_report"로 지정하고 완성된 마크다운 보고서를 반환하세요.

반드시 유효한 JSON 포맷으로만 응답하세요. (마크다운 코드블록 생략하고 순수 JSON만 반환)

JSON 반환 포맷:
{
  "reply": "사용자에게 전할 친절하고 명확한 대화 답변 (마크다운 서식 활용)",
  "action": "none" | "select_material" | "update_count" | "update_report" | "complete_report" | "prompt_photo_upload",
  "selectedItem": { "id": "...", "seq": 1, "materialCode": "...", "classSubcategory": "...", "name": "...", "spec": "...", "docQty": 숫자, "actualQty": 숫자 또는 null, "unit": "..." } 또는 null,
  "updatedCount": { "measuredQty": 숫자, "matchRate": 숫자, "status": "MATCH"|"SHORTAGE"|"EXCESS", "statusLabel": "일치 (적합)"|"수량 부족 (경고)"|"수량 초과 (확인필요)" } 또는 null,
  "discrepancyReason": "감지된 불일치 사유" 또는 null,
  "requiresPhotoUpload": true | false,
  "reportMarkdown": "업데이트할 마크다운 보고서 전문 (필요시)" 또는 null
}`;

    // 대화 히스토리 구성
    const contents: any[] = [];
    const recentHistory = (conversationHistory || []).slice(-6);
    for (const h of recentHistory) {
      contents.push({
        role: h.role === 'assistant' || h.role === 'bot' ? 'model' : 'user',
        parts: [{ text: h.text }],
      });
    }
    contents.push({
      role: 'user',
      parts: [{ text: prompt }],
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents,
    });

    const rawText = response.text || '';
    const cleanJson = rawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    try {
      const parsed = JSON.parse(cleanJson);
      return NextResponse.json(parsed);
    } catch {
      return NextResponse.json({
        reply: rawText || '요청하신 내용을 처리했습니다. 추가로 확인이 필요하신 사항을 말씀해주세요.',
        action: 'none',
      });
    }
  } catch (err: any) {
    console.error('Material Audit Chat API Error:', err);
    return NextResponse.json(
      { error: err.message || '챗봇 대화 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
