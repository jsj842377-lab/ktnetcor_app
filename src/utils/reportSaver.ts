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
    @page { size: A4 portrait; margin: 6mm 8mm; }
    body { font-family: 'Pretendard', sans-serif; margin: 12px auto; max-width: 740px; color: #0f172a; background: #fff; line-height: 1.25; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 4px; border: 1.5px solid #1e293b; }
    th { border: 1px solid #cbd5e1; background: #f1f5f9; padding: 3px 4px; font-size: 10px; text-align: center; }
    td { border: 1px solid #cbd5e1; padding: 2.5px 5px; font-size: 9.5px; }
    h2 { font-size: 16px; margin: 0 0 6px 0; border-bottom: 2px solid #0f172a; padding-bottom: 4px; }
    h3 { font-size: 14px; margin: 6px 0 4px 0; }
    h4 { font-size: 11px; margin: 4px 0 2px 0; color: #1e293b; }
    img { max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 3px; display: block; margin: 0 auto; }
  </style>
</head>
<body>
  ${reportHtmlContent}
</body>
</html>`;

  downloadFile(fullHtml, filename, 'text/html;charset=utf-8');
}
