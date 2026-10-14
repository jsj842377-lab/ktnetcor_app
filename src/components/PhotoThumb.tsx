'use client';

import { useState } from 'react';
import { ZoomIn, AlertCircle } from 'lucide-react';

interface PhotoThumbProps {
  url: string;
  index: number;
  theme?: {
    border?: string;
    textSub?: string;
    textMain?: string;
    thBg?: string;
    cardBg?: string;
  };
  onClick?: () => void;
  style?: React.CSSProperties;
  className?: string;
  alt?: string;
  height?: string | number;
  fitMode?: 'contain' | 'cover';
}

export function PhotoThumb({
  url,
  index,
  theme,
  onClick,
  style,
  className,
  alt,
  height = '220px',
  fitMode = 'contain',
}: PhotoThumbProps) {
  const [failed, setFailed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const borderColor = theme?.border || '#cbd5e1';
  const textSubColor = theme?.textSub || '#64748b';
  const bgColor = theme?.thBg || theme?.cardBg || '#f1f5f9';

  if (failed) {
    return (
      <div
        style={{
          border: `1px dashed ${borderColor}`,
          padding: '24px 8px',
          textAlign: 'center',
          color: textSubColor,
          fontSize: '12px',
          borderRadius: '4px',
          background: bgColor,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          minHeight: height,
          ...style,
        }}
        className={className}
      >
        <AlertCircle size={20} color={textSubColor} />
        <span>사진 {index + 1}을 불러오지 못했습니다</span>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      title="클릭하여 고화질 확대 및 상세 점검"
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'zoom-in',
        overflow: 'hidden',
        border: `1px solid ${isHovered ? '#3b82f6' : borderColor}`,
        borderRadius: '4px',
        background: bgColor,
        transition: 'all 0.2s ease',
        transform: isHovered ? 'translateY(-2px)' : 'none',
        boxShadow: isHovered ? '0 6px 14px rgba(0,0,0,0.15)' : 'none',
        height: typeof height === 'number' ? `${height}px` : height,
        ...style,
      }}
      className={className}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={alt || `현장 사진 ${index + 1}`}
        loading="lazy"
        onError={() => setFailed(true)}
        style={{
          maxWidth: '100%',
          maxHeight: '100%',
          width: fitMode === 'cover' ? '100%' : 'auto',
          height: fitMode === 'cover' ? '100%' : 'auto',
          objectFit: fitMode,
          display: 'block',
          margin: '0 auto',
          transition: 'transform 0.25s ease',
          transform: isHovered ? 'scale(1.03)' : 'scale(1)',
        }}
      />

      {/* Hover Overlay with Zoom Icon */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          color: '#ffffff',
          fontSize: '13px',
          fontWeight: 'bold',
          opacity: isHovered ? 1 : 0,
          transition: 'opacity 0.2s ease',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(0, 0, 0, 0.6)',
            padding: '6px 12px',
            borderRadius: '20px',
            boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
          }}
        >
          <ZoomIn size={16} />
          <span>상세 검사 (확대)</span>
        </div>
      </div>

      {/* Corner index badge */}
      <div
        style={{
          position: 'absolute',
          bottom: '8px',
          right: '8px',
          background: 'rgba(15, 23, 42, 0.75)',
          color: '#f8fafc',
          fontSize: '11px',
          padding: '2px 8px',
          borderRadius: '4px',
          pointerEvents: 'none',
          backdropFilter: 'blur(4px)',
        }}
      >
        사진 {index + 1}
      </div>
    </div>
  );
}

export default PhotoThumb;
