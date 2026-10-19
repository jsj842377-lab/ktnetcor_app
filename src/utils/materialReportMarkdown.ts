import * as XLSX from 'xlsx';

export const MATERIAL_CHECK_ITEMS = [
  '외관 손상 및 변형 여부',
  '부식 및 오염 상태',
  '규격 및 라벨 식별 상태',
  '포장 및 적재 상태',
  '인증 마크 확인',
] as const;

export type MaterialInspectionStatus = 'ok' | 'danger' | 'unknown';

export interface MaterialCheckRow {
  name: string;
  result: string; // '양호' | '불량' | ''
  action: string;
  note: string;
}

export interface MaterialInspectionRecord {
  id: string;
  worker_id?: string;
  project_number: string;
  material_type: string;
  photo_location: string;
  inspector: string;
  photo_date: string;
  image_urls: string[];
  ai_report_text: string;
  status: '완료' | '진행중';
  overall_result: 'O (적합)' | 'X (부적합)';
  created_at: string;
}

const SEPARATOR_ROW = /^\|[\s:|-]+\|?$/;
const MATERIAL_CHECK_ITEM_SET: readonly string[] = MATERIAL_CHECK_ITEMS;

/** '| a | b | c |' → ['a', 'b', 'c'] */
const splitRow = (line: string): string[] =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());

/** '( )', '(AI 판정)' 같은 자리표시자 제거 */
const cleanCell = (cell: string): string =>
  cell.replace(/\(\s*AI\s*판정\s*\)/g, '').replace(/\(\s*\)/g, '').trim();

/** 표가 깨지지 않도록 줄바꿈과 | 문자 제거 */
const sanitizeCell = (text: string): string =>
  text.replace(/[\r\n]+/g, ' ').replace(/\|/g, '/').trim();

const normalizeResult = (cell: string): string => {
  if (cell.includes('불량')) return '불량';
  if (cell.includes('양호')) return '양호';
  return '';
};

/** 자재실사 보고서에서 5개 점검항목의 결과/조치사항/비고 파싱 */
export function parseMaterialCheckRows(md: string): MaterialCheckRow[] {
  const found = new Map<string, string[]>();

  for (const line of (md || '').replace(/\r/g, '').split('\n')) {
    const t = line.trim();
    if (!t.startsWith('|') || SEPARATOR_ROW.test(t)) continue;
    const cells = splitRow(t);
    const name = (cells[0] ?? '').replace(/\*/g, '').trim();
    if (MATERIAL_CHECK_ITEM_SET.includes(name)) found.set(name, cells);
  }

  return MATERIAL_CHECK_ITEMS.map((name) => {
    const cells = found.get(name) ?? [];
    return {
      name,
      result: normalizeResult(cells[1] ?? ''),
      action: cleanCell(cells[2] ?? ''),
      note: cleanCell(cells[3] ?? ''),
    };
  });
}

/** 보고서 마크다운에서 메타데이터 및 O/X 종합 판정 추출 */
export function extractMaterialInfoFromMarkdown(md: string): {
  projectNumber: string;
  materialType: string;
  photoLocation: string;
  photoDate: string;
  inspector: string;
  storageCondition: string;
  overallStatus: MaterialInspectionStatus;
  overallResultLabel: 'O (적합)' | 'X (부적합)';
  checks: MaterialCheckRow[];
  summaryNote: string;
} {
  const text = md || '';
  const projMatch = text.match(/\*\*공사번호\*\*\s*\|\s*([^|]+?)\s*\|/);
  const matMatch = text.match(/\*\*자재명\/규격\*\*\s*\|\s*([^|]+?)\s*\|/);
  const locMatch = text.match(/\*\*적재위치\*\*\s*\|\s*([^|]+?)\s*\|/);
  const dateMatch = text.match(/\*\*실사일자\*\*\s*\|\s*([^|]+?)\s*\|/);
  const inspMatch = text.match(/\*\*실사자\*\*\s*\|\s*([^|]+?)\s*\|/);
  const storageMatch = text.match(/\*\*보관상태\*\*\s*\|\s*([^|]+?)\s*\|/);

  const checks = parseMaterialCheckRows(text);
  const hasBad = checks.some((c) => c.result === '불량');
  const allGood = checks.length === 5 && checks.every((c) => c.result === '양호');

  let overallStatus: MaterialInspectionStatus = 'unknown';
  let overallResultLabel: 'O (적합)' | 'X (부적합)' = 'O (적합)';

  if (hasBad) {
    overallStatus = 'danger';
    overallResultLabel = 'X (부적합)';
  } else if (allGood) {
    overallStatus = 'ok';
    overallResultLabel = 'O (적합)';
  } else {
    // 텍스트에서 추가 검색
    if (text.includes('부적합') || text.includes('반품 및 교체 요망')) {
      overallStatus = 'danger';
      overallResultLabel = 'X (부적합)';
    } else {
      overallStatus = 'ok';
      overallResultLabel = 'O (적합)';
    }
  }

  // 종합 특이사항 추출
  const summaryMatch = text.match(/종합\s*특이사항\s*\|\s*([^|]+?)\s*\|/);
  const summaryNote = summaryMatch ? summaryMatch[1].replace(/[()]/g, '').trim() : '';

  return {
    projectNumber: projMatch ? projMatch[1].trim() : '안산-설비-2026-0096',
    materialType: matMatch ? matMatch[1].trim() : 'FR-CNCO-W 22kV 60㎟',
    photoLocation: locMatch ? locMatch[1].trim() : '안산 야외 적재장 A구역',
    photoDate: dateMatch ? dateMatch[1].trim() : new Date().toISOString().slice(0, 10),
    inspector: inspMatch ? inspMatch[1].trim() : '전현진',
    storageCondition: storageMatch ? storageMatch[1].trim() : '양호',
    overallStatus,
    overallResultLabel,
    checks,
    summaryNote,
  };
}

/** 수정된 체크 행 및 조치사항을 반영하여 마크다운 재구성 */
export function buildMaterialReportMarkdown(
  baseMd: string,
  updatedChecks: MaterialCheckRow[],
  newSummary?: string
): string {
  const info = extractMaterialInfoFromMarkdown(baseMd);
  const hasBad = updatedChecks.some((c) => c.result === '불량');
  const verdictText = hasBad
    ? '[ ] 적합 (사용 승인)   [V] 부적합 (반품 및 교체 요망)'
    : '[V] 적합 (사용 승인)   [ ] 부적합 (반품 및 교체 요망)';

  const checkTableRows = updatedChecks
    .map(
      (c) =>
        `| ${c.name} | ${c.result || '양호'} | ${sanitizeCell(c.action)} | ${sanitizeCell(c.note)} |`
    )
    .join('\n');

  return `### 자재실사 결과보고서

#### ■ 1. 자재 기본 정보
| 항목 | 내용 | 항목 | 내용 |
|---|---|---|---|
| **공사번호** | ${info.projectNumber} | **실사일자** | ${info.photoDate} |
| **자재명/규격** | ${info.materialType} | **실사자** | ${info.inspector} |
| **적재위치** | ${info.photoLocation} | **보관상태** | ${info.storageCondition} |

#### ■ 2. 자재 검수 항목 및 결과
| 검수항목 | 결과(양호/불량) | 조치사항 | 비고 |
|---|---|---|---|
${checkTableRows}

#### ■ 3. 종합 판정 및 특이사항
| 판정 결과 | ${verdictText} |
|---|---|
| 종합 특이사항 | (${newSummary !== undefined ? sanitizeCell(newSummary) : info.summaryNote || '특이사항 없음'}) |
`;
}

/** 엑셀 수식 인젝션 방지 */
const safeCell = (value: string) => (/^[=+\-@]/.test(value) ? `'${value}` : value);

/**
 * 표준 엑셀 파일(협력사관리_자재실사_YYYY년_Qx.xlsx) 생성기
 * 컬럼: [일자, 구분, 인원, 협력사, 공사번호, 자재명/규격, 적재위치, 자재 검수 결과]
 */
export function exportMaterialInspectionExcel(
  records: Array<{
    date: string;
    period?: string; // 오전 / 오후
    inspector: string;
    partnerName?: string;
    projectNumber: string;
    materialType: string;
    photoLocation: string;
    overallResult: string; // 'O (적합)' | 'X (부적합)'
  }>,
  fileName?: string
) {
  const rows = records.map((r) => {
    // '오후' 또는 '오전' 기본값
    const period = r.period || '오후';
    const partner = r.partnerName || '경기설계팀';
    return [
      safeCell(r.date),
      safeCell(period),
      safeCell(r.inspector),
      safeCell(partner),
      safeCell(r.projectNumber),
      safeCell(r.materialType),
      safeCell(r.photoLocation),
      safeCell(r.overallResult),
    ];
  });

  const headers = ['일자', '구분', '인원', '협력사', '공사번호', '자재명/규격', '적재위치', '자재 검수 결과'];
  const sheetData = [headers, ...rows];

  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  // 열 너비 지정
  ws['!cols'] = [
    { wch: 12 }, // 일자
    { wch: 8 },  // 구분
    { wch: 10 }, // 인원
    { wch: 14 }, // 협력사
    { wch: 22 }, // 공사번호
    { wch: 26 }, // 자재명/규격
    { wch: 20 }, // 적재위치
    { wch: 16 }, // 자재 검수 결과
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '자재실사결과');

  const now = new Date();
  const year = now.getFullYear();
  const quarter = `Q${Math.floor(now.getMonth() / 3) + 1}`;
  const outName = fileName || `협력사관리_자재실사_${year}년_${quarter}.xlsx`;

  XLSX.writeFile(wb, outName);
}
