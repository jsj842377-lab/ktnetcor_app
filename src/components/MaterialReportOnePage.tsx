'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ZoomIn } from 'lucide-react';

interface MaterialReportOnePageProps {
  id?: string;
  reportText: string;
  photoUrls: string[];
  workerName: string;
  dateStr: string;
  materialName?: string;
  matchRate?: number;
  measuredQty?: number;
  docQty?: number;
  unit?: string;
  onPhotoClick?: (index: number) => void;
  className?: string;
  isPrintVersion?: boolean;
}

export default function MaterialReportOnePage({
  id,
  reportText,
  photoUrls,
  workerName,
  dateStr,
  matchRate,
  measuredQty,
  docQty,
  unit = '개',
  onPhotoClick,
  className = '',
  isPrintVersion = false,
}: MaterialReportOnePageProps) {
  // 중복 제목 제거
  const cleanedReportText = (reportText || '')
    .replace(/^#+\s*현장\s*자재실사\s*(?:결과)?보고서\s*\n+/i, '')
    .replace(/^#+\s*자재실사\s*(?:결과)?보고서\s*\n+/i, '')
    .trim();

  // A4 1페이지 규격에 최적화된 마크다운 컴포넌트 (모바일 가독성 보정)
  const compactMdComps = {
    table: (props: any) => (
      <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch', marginBottom: '6px' }}>
        <table
          style={{
            width: '100%',
            minWidth: isPrintVersion ? '100%' : '520px',
            borderCollapse: 'collapse',
            border: '1.5px solid #1e293b',
          }}
          {...props}
        />
      </div>
    ),
    thead: (props: any) => <thead style={{ background: '#f1f5f9' }} {...props} />,
    th: (props: any) => (
      <th
        style={{
          border: '1px solid #cbd5e1',
          background: '#f1f5f9',
          padding: isPrintVersion ? '3px 4px' : '6px 8px',
          textAlign: 'center',
          fontSize: isPrintVersion ? '10px' : '12.5px',
          fontWeight: 'bold',
          color: '#0f172a',
          lineHeight: 1.3,
          whiteSpace: 'nowrap',
        }}
        {...props}
      />
    ),
    td: ({ children, ...props }: any) => {
      const text = typeof children === 'string' ? children : '';
      const isMatch = text.includes('100%') || text.includes('일치') || text.includes('적합');
      const isShort = text.includes('부족') || text.includes('경고') || text.includes('미흡');

      let cellColor = '#0f172a';
      let cellFontWeight = 'normal';
      if (isMatch) {
        cellColor = '#059669';
        cellFontWeight = 'bold';
      } else if (isShort) {
        cellColor = '#dc2626';
        cellFontWeight = 'bold';
      }

      return (
        <td
          style={{
            border: '1px solid #cbd5e1',
            padding: isPrintVersion ? '3px 5px' : '6px 8px',
            fontSize: isPrintVersion ? '9.5px' : '12px',
            textAlign: isMatch || isShort ? 'center' : 'left',
            color: cellColor,
            fontWeight: cellFontWeight,
            lineHeight: 1.35,
          }}
          {...props}
        >
          {children}
        </td>
      );
    },
    h3: ({ children, ...props }: any) => {
      const text = typeof children === 'string' ? children : '';
      if (text.includes('자재실사') && text.includes('보고서')) return null;
      return (
        <h3
          style={{
            fontSize: isPrintVersion ? '13.5px' : '16px',
            fontWeight: 'bold',
            color: '#0f172a',
            margin: '0 0 6px 0',
            paddingBottom: '4px',
            borderBottom: '1.5px solid #0f172a',
            textAlign: 'center',
          }}
          {...props}
        >
          {children}
        </h3>
      );
    },
    h4: (props: any) => (
      <div
        style={{
          fontSize: isPrintVersion ? '10.5px' : '13px',
          fontWeight: 'bold',
          color: '#1e293b',
          margin: '6px 0 3px 0',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}
        {...props}
      />
    ),
    p: (props: any) => (
      <p style={{ margin: '2px 0', fontSize: isPrintVersion ? '9.5px' : '12px', color: '#0f172a', lineHeight: 1.35 }} {...props} />
    ),
    strong: (props: any) => <strong style={{ color: '#0f172a', fontWeight: 'bold' }} {...props} />,
  };

  const displayPhotos = photoUrls.slice(0, 4);
  const photoCount = displayPhotos.length;

  const getPhotoHeight = () => {
    if (photoCount === 1) return '145px';
    if (photoCount === 2) return '130px';
    if (photoCount === 3) return '115px';
    return '100px';
  };

  const getGridTemplate = () => {
    if (photoCount === 1) return 'minmax(0, 360px)';
    if (photoCount === 2) return 'repeat(2, minmax(0, 1fr))';
    if (photoCount === 3) return 'repeat(3, minmax(0, 1fr))';
    return 'repeat(4, minmax(0, 1fr))';
  };

  return (
    <div
      id={id}
      className={`one-page-report-root ${className}`}
      style={{
        width: '100%',
        maxWidth: '194mm',
        margin: '0 auto',
        padding: isPrintVersion ? '10px 14px 6px 14px' : '16px 20px',
        backgroundColor: '#ffffff',
        color: '#0f172a',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', sans-serif",
        boxSizing: 'border-box',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        lineHeight: 1.25,
        minHeight: isPrintVersion ? '268mm' : 'auto',
        maxHeight: isPrintVersion ? '282mm' : 'none',
        overflow: 'hidden',
      }}
    >
      <div>
        {/* 공식 관공서/기업 스타일 상단 결재란 헤더 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            borderBottom: '2px solid #0f172a',
            paddingBottom: '6px',
            marginBottom: '8px',
          }}
        >
          <div>
            <div style={{ fontSize: '8.5px', color: '#64748b', fontWeight: 'bold', letterSpacing: '0.5px' }}>
              KT NETCOR CO., LTD. // GYEONGGI DESIGN DIVISION
            </div>
            <h2
              style={{
                fontSize: '17px',
                fontWeight: '900',
                color: '#0f172a',
                margin: '2px 0 0 0',
                letterSpacing: '-0.4px',
              }}
            >
              현장 자재실사 결과보고서
            </h2>
          </div>

          {/* 결재란 및 일치율 뱃지 */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {matchRate !== undefined && (
              <div
                style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  background: matchRate >= 100 ? '#ecfdf5' : '#fef2f2',
                  border: `1.5px solid ${matchRate >= 100 ? '#10b981' : '#ef4444'}`,
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '8px', color: matchRate >= 100 ? '#047857' : '#b91c1c', fontWeight: 'bold' }}>
                  AI 실측 일치율
                </div>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: '900',
                    color: matchRate >= 100 ? '#059669' : '#dc2626',
                  }}
                >
                  {matchRate}%
                </div>
                {measuredQty !== undefined && docQty !== undefined && (
                  <div style={{ fontSize: '7.5px', color: '#64748b', marginTop: '1px' }}>
                    실측 {measuredQty} / {docQty} {unit}
                  </div>
                )}
              </div>
            )}

            {/* 결재 도장 박스 */}
            <table
              style={{
                borderCollapse: 'collapse',
                border: '1px solid #64748b',
                fontSize: '8.5px',
                textAlign: 'center',
              }}
            >
              <tbody>
                <tr>
                  <td style={{ border: '1px solid #cbd5e1', padding: '2px 6px', background: '#f8fafc', color: '#64748b' }}>
                    실사자
                  </td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '2px 6px', background: '#f8fafc', color: '#64748b' }}>
                    관리팀장
                  </td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #cbd5e1', padding: '4px 8px', fontWeight: 'bold' }}>
                    {workerName}
                  </td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '4px 8px', color: '#059669', fontWeight: 'bold' }}>
                    (인/승인)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 보고서 마크다운 본문 (표 및 분석 결과) */}
        <div style={{ width: '100%', marginBottom: '4px' }}>
          <ReactMarkdown components={compactMdComps} remarkPlugins={[remarkGfm]}>
            {cleanedReportText}
          </ReactMarkdown>
        </div>

        {/* 현장 증빙 사진 섹션 (절대 잘리지 않는 object-fit contain 적용) */}
        {photoCount > 0 && (
          <div
            style={{
              marginTop: '4px',
              paddingTop: '4px',
              borderTop: '1px dashed #cbd5e1',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
              <div style={{ fontSize: '10.5px', fontWeight: 'bold', color: '#1e293b' }}>
                📸 현장 자재 시각 계측 증빙 사진 (총 {photoCount}장)
              </div>
              {!isPrintVersion && (
                <span style={{ fontSize: '9px', color: '#64748b' }}>
                  (클릭 시 고화질 확대 검사 가능)
                </span>
              )}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: getGridTemplate(),
                gap: '5px',
                width: '100%',
                justifyContent: photoCount === 1 ? 'center' : 'stretch',
              }}
            >
              {displayPhotos.map((url, i) => (
                <div
                  key={i}
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: getPhotoHeight(),
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: '3px',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: onPhotoClick ? 'zoom-in' : 'default',
                    boxSizing: 'border-box',
                    padding: '2px',
                  }}
                  onClick={() => onPhotoClick && onPhotoClick(i)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`자재 실사 증빙 사진 ${i + 1}`}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      width: 'auto',
                      height: 'auto',
                      objectFit: 'contain',
                      display: 'block',
                      margin: 'auto',
                    }}
                  />

                  {/* 사진 좌상단 인덱스 뱃지 */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '3px',
                      left: '3px',
                      background: 'rgba(15, 23, 42, 0.75)',
                      color: '#ffffff',
                      fontSize: '8.5px',
                      fontWeight: 'bold',
                      padding: '1px 5px',
                      borderRadius: '2px',
                      lineHeight: 1.2,
                      zIndex: 2,
                    }}
                  >
                    증빙 {i + 1}
                  </div>

                  {!isPrintVersion && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '3px',
                        right: '3px',
                        background: 'rgba(15, 23, 42, 0.65)',
                        color: '#ffffff',
                        padding: '2px',
                        borderRadius: '2px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <ZoomIn size={11} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 보고서 최하단 공식 문서 푸터 (A4 1페이지 규격 보증) */}
      <div
        style={{
          marginTop: '6px',
          paddingTop: '4px',
          borderTop: '1px solid #94a3b8',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '8.5px',
          color: '#64748b',
        }}
      >
        <div>
          <span>실사일시: {dateStr}</span>
          <span style={{ margin: '0 6px' }}>|</span>
          <span>실사자: {workerName}</span>
          <span style={{ margin: '0 6px' }}>|</span>
          <span>경기설계팀 자재관리부</span>
        </div>
        <div style={{ fontWeight: 'bold' }}>
          [자재실사 증빙용] A4 단일 페이지 규격
        </div>
      </div>
    </div>
  );
}
