/**
 * 보고서 파일 다운로드 및 저장 유틸리티
 */

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 보고서를 마크다운(.md) 파일로 저장 */
export function saveReportAsMarkdown(reportMarkdown: string, filename = '현장안전점검보고서.md') {
  downloadFile(reportMarkdown, filename, 'text/markdown;charset=utf-8');
}

/** 보고서를 일반 텍스트(.txt) 파일로 저장 */
export function saveReportAsText(reportMarkdown: string, filename = '현장안전점검보고서.txt') {
  const plainText = reportMarkdown
    .replace(/###\s+/g, '')
    .replace(/####\s+/g, '\n')
    .replace(/\*\*/g, '')
    .replace(/\|/g, ' ')
    .trim();
  downloadFile(plainText, filename, 'text/plain;charset=utf-8');
}

/** 보고서를 독립 실행형 단일 HTML 파일로 저장 */
export function saveReportAsHtml(
  reportHtmlContent: string,
  title = '현장 안전점검 결과보고서',
  filename = '현장안전점검보고서_1장.html'
) {
  const fullHtml = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
    @page { size: A4 portrait; margin: 8mm 10mm; }
    body { font-family: 'Pretendard', sans-serif; margin: 20px auto; max-width: 740px; color: #0f172a; background: #fff; line-height: 1.4; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; border: 1.5px solid #1e293b; }
    th { border: 1px solid #cbd5e1; background: #f1f5f9; padding: 4px 6px; font-size: 11px; text-align: center; }
    td { border: 1px solid #cbd5e1; padding: 4px 6px; font-size: 11px; }
    h2 { font-size: 18px; margin: 0 0 10px 0; border-bottom: 2px solid #0f172a; padding-bottom: 6px; }
    h3 { font-size: 15px; margin: 10px 0 6px 0; }
    h4 { font-size: 12px; margin: 8px 0 4px 0; color: #1e293b; }
    img { max-width: 100%; border-radius: 4px; }
  </style>
</head>
<body>
  ${reportHtmlContent}
</body>
</html>`;

  downloadFile(fullHtml, filename, 'text/html;charset=utf-8');
}
