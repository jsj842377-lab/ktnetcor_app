// 저장 위치 예: src/utils/reportMarkdown.ts  (import 경로: '@/utils/reportMarkdown')

export const CHECK_ITEMS = [
  '보호구 착용 상태',
  '안전표지 설치',
  '사다리 및 장비 상태',
  '적정 공법 적용 상태',
  '정리정돈 상태',
] as const;

export type SafetyStatus = 'ok' | 'danger' | 'unknown';

export interface CheckRow {
  name: string;
  result: string; // '양호' | '불량' | ''
  action: string;
  note: string;
}

const SEPARATOR_ROW = /^\|[\s:|-]+\|?$/;
const CHECK_ITEM_SET: readonly string[] = CHECK_ITEMS;

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

/** 보고서에서 5개 점검항목의 결과/조치사항/비고를 읽어옵니다. */
export function parseCheckRows(md: string): CheckRow[] {
  const found = new Map<string, string[]>();

  for (const line of (md || '').replace(/\r/g, '').split('\n')) {
    const t = line.trim();
    if (!t.startsWith('|') || SEPARATOR_ROW.test(t)) continue;
    const cells = splitRow(t);
    const name = (cells[0] ?? '').replace(/\*/g, '').trim();
    if (CHECK_ITEM_SET.includes(name)) found.set(name, cells);
  }

  return CHECK_ITEMS.map((name) => {
    const cells = found.get(name) ?? [];
    return {
      name,
      result: normalizeResult(cleanCell(cells[1] ?? '')),
      action: cleanCell(cells[2] ?? ''),
      note: cleanCell(cells[3] ?? ''),
    };
  });
}

/** '종합 특이사항' 표의 내용을 읽어옵니다. */
export function parseSummary(md: string): string {
  const section = (md || '').split(/종합\s*특이사항/)[1];
  if (!section) return '';

  const rows = section
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('|') && !SEPARATOR_ROW.test(l));

  // 첫 줄은 머리글('내용')
  const body = rows.slice(1).map((r) => splitRow(r).join(' '));
  return cleanCell(body.join(' ')).trim();
}

/**
 * 수정 폼의 값을 원본 보고서에 반영한 새 마크다운을 만듭니다.
 * (점검표 5개 행 + 종합 특이사항만 바꾸고 나머지는 그대로 유지)
 */
export function buildReportMarkdown(md: string, rows: CheckRow[], summary: string): string {
  const byName = new Map(rows.map((r) => [r.name, r]));

  const lines = (md || '')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => {
      const t = line.trim();
      if (!t.startsWith('|')) return line;
      const name = (splitRow(t)[0] ?? '').replace(/\*/g, '').trim();
      const row = byName.get(name);
      if (!row || !CHECK_ITEM_SET.includes(name)) return line;
      return `| ${name} | ${sanitizeCell(row.result) || '( )'} | ${sanitizeCell(row.action)} | ${sanitizeCell(row.note)} |`;
    });

  const summaryCell = sanitizeCell(summary) || '( )';
  const h = lines.findIndex((l) => /종합\s*특이사항/.test(l));

  if (h === -1) {
    lines.push('', '#### ■ 3. 종합 특이사항', '| 내용 |', '|---|', `| ${summaryCell} |`);
    return lines.join('\n');
  }

  let rowCount = 0;
  let lastTable = -1;
  for (let i = h + 1; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t.startsWith('|')) {
      if (lastTable !== -1) break;
      continue;
    }
    lastTable = i;
    if (SEPARATOR_ROW.test(t)) continue;
    rowCount++;
    if (rowCount === 2) {
      lines[i] = `| ${summaryCell} |`;
      return lines.join('\n');
    }
  }

  if (lastTable === -1) lines.splice(h + 1, 0, '| 내용 |', '|---|', `| ${summaryCell} |`);
  else lines.splice(lastTable + 1, 0, `| ${summaryCell} |`);
  return lines.join('\n');
}

/**
 * 안전점검 판정.
 * 주의: 표 머리글 '결과(양호/불량)'에 '불량'이 들어 있으므로
 * 문자열 전체에서 includes('불량')로 판정하면 항상 위험으로 나옵니다.
 */
export function analyzeReport(md: string): SafetyStatus {
  const results = parseCheckRows(md).map((r) => r.result);
  if (results.some((r) => r === '불량')) return 'danger';
  if (results.every((r) => r === '양호')) return 'ok';
  return 'unknown';
}

/** 누적 경험치로 레벨/진행도 계산 (레벨마다 필요 경험치 2배: 100, 200, 400 ...) */
export function calcLevelInfo(totalExp: number) {
  let level = 1;
  let remaining = Math.max(0, Math.floor(totalExp || 0));
  let required = 100;
  while (remaining >= required) {
    remaining -= required;
    level++;
    required *= 2;
  }
  return { level, current: remaining, required };
}
