'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ZoomIn } from 'lucide-react';

interface OnePageReportProps {
  id?: string;
  reportText: string;
  photoUrls: string[];
  workerName: string;
  dateStr: string;
  onPhotoClick?: (index: number) => void;
  className?: string;
  isPrintVersion?: boolean;
}

export default function OnePageReport({
  id,
  reportText,
  photoUrls,
  workerName,
  dateStr,
  onPhotoClick,
  className = '',
  isPrintVersion = false,
}: OnePageReportProps) {
  // 1페이지 A4 규격에 맞춘 초슬림 마크다운 렌더러 컴포넌트
  const compactMdComps = {
    table: (props: any) => (
      <div style={{ width: '100%', overflow: 'hidden', marginBottom: '8px' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            border: '1.5px solid #1e293b',
            tableLayout: 'fixed',
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
          padding: '4px 6px',
          textAlign: 'center',
          fontSize: '11px',
          fontWeight: 'bold',
          color: '#0f172a',
          lineHeight: 1.25,
          wordBreak: 'keep-all',
        }}
        {...props}
      />
    ),
    td: ({ children, ...props }: any) => {
      const text = typeof children === 'string' ? children : '';
      const isGood = text === '양호' || (Array.isArray(children) && children.includes('양호'));
      const isBad = text === '불량' || (Array.isArray(children) && children.includes('불량'));

      let cellColor = '#0f172a';
      let cellFontWeight = 'normal';
      if (isGood) {
        cellColor = '#059669';
        cellFontWeight = 'bold';
      } else if (isBad) {
        cellColor = '#dc2626';
        cellFontWeight = 'bold';
      }

      return (
        <td
          style={{
            border: '1px solid #cbd5e1',
            padding: '4px 6px',
            fontSize: '11px',
            textAlign: isGood || isBad ? 'center' : 'left',
            color: cellColor,
            fontWeight: cellFontWeight,
            lineHeight: 1.25,
            wordBreak: 'break-word',
          }}
          {...props}
        >
          {children}
        </td>
      );
    },
    h3: (props: any) => (
      <h3
        style={{
          fontSize: '17px',
          fontWeight: 'bold',
          color: '#0f172a',
          margin: '0 0 10px 0',
          paddingBottom: '6px',
          borderBottom: '2px solid #0f172a',
          textAlign: 'center',
          letterSpacing: '-0.5px',
        }}
        {...props}
      />
    ),
    h4: (props: any) => (
      <div
        style={{
          fontSize: '12px',
          fontWeight: 'bold',
          color: '#1e293b',
          margin: '8px 0 4px 0',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}
        {...props}
      />
    ),
    p: (props: any) => (
      <p style={{ margin: '2px 0', fontSize: '11px', color: '#0f172a', lineHeight: 1.3 }} {...props} />
    ),
    strong: (props: any) => <strong style={{ color: '#0f172a', fontWeight: 'bold' }} {...props} />,
  };

  // 사진 개수에 따른 1페이지 최적화 배치 그리드
  const photoCount = photoUrls.length;

  const getPhotoHeight = () => {
    if (photoCount === 1) return '150px';
    if (photoCount === 2) return '135px';
    if (photoCount === 3) return '120px';
    if (photoCount === 4) return '105px';
    return '95px'; // 5장
  };

  const getGridTemplate = () => {
    if (photoCount === 1) return 'minmax(0, 360px)';
    if (photoCount === 2) return 'repeat(2, minmax(0, 1fr))';
    if (photoCount === 3) return 'repeat(3, minmax(0, 1fr))';
    if (photoCount === 4) return 'repeat(4, minmax(0, 1fr))';
    return 'repeat(5, minmax(0, 1fr))'; // 5장 한 줄 배치로 세로 공간 최소화
  };

  const photoHeight = getPhotoHeight();
  const gridTemplate = getGridTemplate();

  return (
    <div
      id={id}
      className={`one-page-report-root ${className}`}
      style={{
        background: '#ffffff',
        color: '#0f172a',
        width: '100%',
        maxWidth: '740px',
        margin: '0 auto',
        padding: isPrintVersion ? '16px 20px' : '20px 24px',
        boxSizing: 'border-box',
        fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        border: isPrintVersion ? 'none' : '1px solid #cbd5e1',
        borderRadius: isPrintVersion ? '0' : '6px',
        boxShadow: isPrintVersion ? 'none' : '0 4px 12px rgba(0,0,0,0.06)',
      }}
    >
      {/* 상단 공식 헤더 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          borderBottom: '2.5px solid #0f172a',
          paddingBottom: '8px',
          marginBottom: '10px',
        }}
      >
        <div>
          <span
            style={{
              fontSize: '10.5px',
              fontWeight: 'bold',
              color: '#2563eb',
              display: 'inline-block',
              marginBottom: '2px',
              letterSpacing: '0.5px',
            }}
          >
            KT 경기설계팀 현장 안전관리
          </span>
          <h2
            style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: 800,
              color: '#0f172a',
              letterSpacing: '-0.5px',
            }}
          >
            현장 안전점검 결과보고서
          </h2>
        </div>

        <div style={{ textAlign: 'right', fontSize: '11px', color: '#475569', lineHeight: 1.4 }}>
          <div>
            <strong>점검일:</strong> {dateStr}
          </div>
          <div>
            <strong>점검자:</strong> {workerName}
          </div>
        </div>
      </div>

      {/* 보고서 마크다운 표 영역 (1페이지 맞춤 초슬림 렌더러) */}
      <div className="report-markdown-body" style={{ color: '#0f172a' }}>
        <ReactMarkdown components={compactMdComps} remarkPlugins={[remarkGfm]}>
          {reportText}
        </ReactMarkdown>
      </div>

      {/* ■ 4. 현장 사진 (첨부) 영역 - 1페이지 맞춤 고정형 슬림 그리드 */}
      {photoCount > 0 && (
        <div style={{ marginTop: '10px', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid #cbd5e1',
              paddingBottom: '4px',
              marginBottom: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#1e293b' }}>
                📸 현장 증빙 사진 (총 {photoCount}장)
              </div>
              <span
                style={{
                  fontSize: '10px',
                  color: '#059669',
                  background: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  padding: '1px 6px',
                  borderRadius: '3px',
                  fontWeight: '600',
                }}
              >
                전체 사진 원본 비율 유지 · 잘림 방지
              </span>
            </div>
            {!isPrintVersion && (
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                사진을 클릭하면 원본 고화질로 확대 검사할 수 있습니다
              </span>
            )}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: gridTemplate,
              gap: '8px',
              justifyContent: photoCount === 1 ? 'center' : 'stretch',
            }}
          >
            {photoUrls.map((url, idx) => (
              <div
                key={`${url}-${idx}`}
                onClick={() => onPhotoClick?.(idx)}
                style={{
                  position: 'relative',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  background: '#f8fafc',
                  cursor: onPhotoClick ? 'zoom-in' : 'default',
                  height: photoHeight,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '2px',
                  boxSizing: 'border-box',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  crossOrigin="anonymous"
                  alt={`현장 사진 ${idx + 1}`}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    width: 'auto',
                    height: 'auto',
                    objectFit: 'contain',
                    display: 'block',
                    margin: '0 auto',
                  }}
                />

                {/* 사진 인덱스 라벨 */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: '3px',
                    right: '3px',
                    background: 'rgba(15, 23, 42, 0.75)',
                    color: '#ffffff',
                    fontSize: '9.5px',
                    padding: '1px 5px',
                    borderRadius: '2px',
                    fontWeight: 'bold',
                    pointerEvents: 'none',
                    backdropFilter: 'blur(2px)',
                  }}
                >
                  사진 {idx + 1}
                </div>

                {/* 화면 보기 모드일 때 클릭 돋보기 힌트 */}
                {!isPrintVersion && onPhotoClick && (
                  <div
                    className="photo-hover-badge"
                    style={{
                      position: 'absolute',
                      top: '3px',
                      left: '3px',
                      background: 'rgba(15, 23, 42, 0.65)',
                      color: 'white',
                      padding: '2px 3px',
                      borderRadius: '2px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      pointerEvents: 'none',
                    }}
                  >
                    <ZoomIn size={12} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 하단 점검 승인 및 서명란 (공식 양식 마감) */}
      <div
        style={{
          marginTop: '12px',
          paddingTop: '8px',
          borderTop: '1px dashed #cbd5e1',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '10px',
          color: '#64748b',
        }}
      >
        <span>※ 본 보고서는 산업안전보건법 및 KT 안전보건관리규정에 따라 작성되었습니다.</span>
        <span>
          점검책임자: <strong>{workerName}</strong> (인/서명)
        </span>
      </div>
    </div>
  );
}
