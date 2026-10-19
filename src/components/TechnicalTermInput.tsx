'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Tag,
  CornerDownLeft,
  X,
  BookOpen,
} from 'lucide-react';
import {
  getTermSuggestions,
  detectTypoSuggestions,
  AutocompleteResult,
  TypoSuggestion,
} from '@/utils/technicalGlossary';

interface TechnicalTermInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  isTextarea?: boolean;
  rows?: number;
  fieldType?: 'action' | 'note' | 'general';
  theme?: {
    inputBg?: string;
    border?: string;
    textMain?: string;
    textSub?: string;
    cardBg?: string;
    btnCancel?: string;
  };
  style?: React.CSSProperties;
  className?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  disabled?: boolean;
  showQuickPills?: boolean;
}

export default function TechnicalTermInput({
  value,
  onChange,
  placeholder = '전문 용어 입력...',
  isTextarea = false,
  rows = 3,
  fieldType = 'general',
  theme,
  style,
  className = '',
  onKeyDown,
  disabled = false,
  showQuickPills = true,
}: TechnicalTermInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [justFixed, setJustFixed] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // 현재 커서 부근의 마지막 단어 또는 전체 검색어 추출
  const currentQuery = useMemo(() => {
    if (!value) return '';
    // 마지막 띄어쓰기 뒤의 단어 기준 (예: "현장 광분" -> "광분")
    const words = value.trim().split(/\s+/);
    return words[words.length - 1] || '';
  }, [value]);

  // 실시간 전문 용어 자동완성 목록
  const suggestions: AutocompleteResult[] = useMemo(() => {
    return getTermSuggestions(currentQuery || value, fieldType);
  }, [currentQuery, value, fieldType]);

  // 실시간 오타 감지 및 교정 제안
  const typos: TypoSuggestion[] = useMemo(() => {
    return detectTypoSuggestions(value);
  }, [value]);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 교정 성공 토스트 타이머
  useEffect(() => {
    if (justFixed) {
      const timer = setTimeout(() => setJustFixed(null), 2500);
      return () => clearTimeout(timer);
    }
  }, [justFixed]);

  // 오타 1클릭 교정 처리
  const handleFixTypo = (typo: TypoSuggestion) => {
    // 단어 경계 또는 전역 치환
    const regex = new RegExp(typo.wrongWord, 'g');
    const newValue = value.replace(regex, typo.suggestedTerm);
    onChange(newValue);
    setJustFixed(`'${typo.wrongWord}' → '${typo.suggestedTerm}' 교정 완료!`);
    inputRef.current?.focus();
  };

  // 모든 오타 일괄 교정
  const handleFixAllTypos = () => {
    let updated = value;
    typos.forEach((t) => {
      const regex = new RegExp(t.wrongWord, 'g');
      updated = updated.replace(regex, t.suggestedTerm);
    });
    onChange(updated);
    setJustFixed(`${typos.length}건의 전문 용어 오타가 표준어로 일괄 교정되었습니다.`);
    inputRef.current?.focus();
  };

  // 자동완성 단어 선택 적용
  const handleSelectTerm = (term: string) => {
    if (!value.trim()) {
      onChange(term + ' ');
    } else {
      // 마지막 입력 단어를 교체하거나 끝에 추가
      const words = value.split(/\s+/);
      if (words.length > 0 && currentQuery && words[words.length - 1].toLowerCase().includes(currentQuery.toLowerCase())) {
        words[words.length - 1] = term;
        onChange(words.join(' ') + ' ');
      } else {
        onChange((value.trim() + ' ' + term).trim() + ' ');
      }
    }
    setIsOpen(false);
    inputRef.current?.focus();
  };

  // 완성형 조치/비고 템플릿 문구 즉시 적용
  const handleSelectPhrase = (phrase: string) => {
    if (!value.trim()) {
      onChange(phrase);
    } else {
      // 기존 텍스트 뒤에 쉼표나 마침표로 연결
      onChange((value.trim() + ', ' + phrase).trim());
    }
    setIsOpen(false);
    inputRef.current?.focus();
  };

  // 키보드 조작 (위/아래 화살표, 엔터, ESC)
  const handleInternalKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (onKeyDown) onKeyDown(e);

    if (!isOpen || suggestions.length === 0) {
      if (e.key === 'ArrowDown' && (e.ctrlKey || e.altKey)) {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter' && !e.shiftKey && !isTextarea) {
      if (isOpen && suggestions[selectedIndex]) {
        e.preventDefault();
        handleSelectTerm(suggestions[selectedIndex].term);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  // 테마 기본값
  const colors = {
    bg: theme?.inputBg || '#f8fafc',
    border: theme?.border || '#cbd5e1',
    text: theme?.textMain || '#0f172a',
    sub: theme?.textSub || '#64748b',
    popoverBg: theme?.cardBg || '#ffffff',
  };

  // 자주 쓰는 빠른 태그 뱃지 (통신 및 안전 핵심어)
  const quickTerms = useMemo(() => {
    if (fieldType === 'action') {
      return ['광분배함', '5G 안테나', '볼트 재조임', '광점퍼코드', '접지선', '안전모 턱끈'];
    }
    if (fieldType === 'note') {
      return ['외관 정상', '봉인 라벨', '광접속함체', '사양 일치', '5G AAU', 'IP68 방수'];
    }
    return ['광분배함', '5G 안테나', '광접속함체', '접지선', '서지보호기', '개구부 덮개'];
  }, [fieldType]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${className}`}
      style={{ position: 'relative', width: '100%' }}
    >
      {/* 1. 오타 감지 알림 배너 (오타가 발견되었을 때 상단에 표시) */}
      {typos.length > 0 && (
        <div
          style={{
            marginBottom: '6px',
            padding: '6px 10px',
            background: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: '5px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '6px',
            fontSize: '11.5px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#b45309' }}>
            <AlertTriangle size={14} className="shrink-0 text-amber-600" />
            <span>
              <strong>전문 용어 오타 감지:</strong>{' '}
              {typos.map((t, i) => (
                <span key={i} style={{ marginRight: '6px' }}>
                  <span style={{ textDecoration: 'line-through', color: '#dc2626' }}>{t.wrongWord}</span>
                  {' → '}
                  <button
                    type="button"
                    onClick={() => handleFixTypo(t)}
                    style={{
                      background: '#dbeafe',
                      color: '#1d4ed8',
                      border: '1px solid #bfdbfe',
                      borderRadius: '3px',
                      padding: '1px 5px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      fontSize: '11px',
                    }}
                    title="클릭 시 올바른 전문 용어로 즉시 교정"
                  >
                    {t.suggestedTerm} (교정)
                  </button>
                </span>
              ))}
            </span>
          </div>

          {typos.length > 1 && (
            <button
              type="button"
              onClick={handleFixAllTypos}
              style={{
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '4px',
                padding: '2px 8px',
                fontSize: '10.5px',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              전체 일괄 교정
            </button>
          )}
        </div>
      )}

      {/* 2. 교정 완료 토스트 알림 */}
      {justFixed && (
        <div
          style={{
            marginBottom: '5px',
            padding: '4px 8px',
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            borderRadius: '4px',
            color: '#047857',
            fontSize: '11px',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            fontWeight: 'bold',
          }}
        >
          <CheckCircle2 size={13} color="#059669" />
          <span>{justFixed}</span>
        </div>
      )}

      {/* 3. 본 입력 필드 (Input 또는 Textarea) */}
      <div style={{ position: 'relative', width: '100%' }}>
        {isTextarea ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleInternalKeyDown}
            placeholder={placeholder}
            rows={rows}
            disabled={disabled}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '8px 30px 8px 10px',
              backgroundColor: colors.bg,
              border: `1px solid ${colors.border}`,
              color: colors.text,
              fontSize: '12.5px',
              fontFamily: 'inherit',
              borderRadius: '4px',
              outline: 'none',
              resize: 'vertical',
              ...style,
            }}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleInternalKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '8px 28px 8px 10px',
              backgroundColor: colors.bg,
              border: `1px solid ${colors.border}`,
              color: colors.text,
              fontSize: '12.5px',
              fontFamily: 'inherit',
              borderRadius: '4px',
              outline: 'none',
              ...style,
            }}
          />
        )}

        {/* 우측 인라인 자동완성 토글 버튼 */}
        <button
          type="button"
          onClick={() => {
            setIsOpen(!isOpen);
            inputRef.current?.focus();
          }}
          style={{
            position: 'absolute',
            right: '6px',
            top: isTextarea ? '8px' : '50%',
            transform: isTextarea ? 'none' : 'translateY(-50%)',
            background: 'none',
            border: 'none',
            color: isOpen ? '#2563eb' : colors.sub,
            cursor: 'pointer',
            padding: '2px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="전문 용어 자동 완성 사전 열기"
        >
          <Sparkles size={14} />
        </button>
      </div>

      {/* 4. 빠른 태그 칩 (입력창 하단에 상시 배치되어 현장 작업자 편의 제공) */}
      {showQuickPills && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            flexWrap: 'wrap',
            marginTop: '4px',
          }}
        >
          <span style={{ fontSize: '10px', color: colors.sub, display: 'flex', alignItems: 'center', gap: '2px' }}>
            <Tag size={10} /> 빠른용어:
          </span>
          {quickTerms.map((term, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSelectTerm(term)}
              style={{
                fontSize: '10.5px',
                padding: '1px 6px',
                background: theme?.btnCancel || '#e2e8f0',
                color: colors.text,
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                lineHeight: 1.3,
              }}
            >
              +{term}
            </button>
          ))}
        </div>
      )}

      {/* 5. 전문 용어 자동 완성 플로팅 드롭다운 */}
      {isOpen && suggestions.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 1050,
            marginTop: '4px',
            background: colors.popoverBg,
            border: '1px solid #94a3b8',
            borderRadius: '6px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.18)',
            maxHeight: '320px',
            overflowY: 'auto',
          }}
        >
          {/* 드롭다운 헤더 */}
          <div
            style={{
              padding: '6px 10px',
              background: '#f1f5f9',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '11px',
              color: '#475569',
              fontWeight: 'bold',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <BookOpen size={12} color="#2563eb" />
              <span>전문 용어 자동 완성 & 표준 조치/비고 템플릿</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
            >
              <X size={12} />
            </button>
          </div>

          {/* 추천 항목 목록 */}
          <div style={{ padding: '4px 0' }}>
            {suggestions.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const categoryColor =
                item.category === 'telecom'
                  ? '#2563eb'
                  : item.category === 'electric'
                  ? '#d97706'
                  : item.category === 'safety'
                  ? '#dc2626'
                  : '#059669';

              return (
                <div
                  key={idx}
                  style={{
                    padding: '8px 10px',
                    borderBottom: idx < suggestions.length - 1 ? '1px solid #f1f5f9' : 'none',
                    background: isSelected ? '#eff6ff' : 'transparent',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  {/* 상단: 단어명 + 영문약어 + 분야 뱃지 */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '3px',
                    }}
                    onClick={() => handleSelectTerm(item.term)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <strong style={{ fontSize: '13px', color: '#0f172a' }}>
                        {item.term}
                      </strong>
                      {item.english && (
                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                          ({item.english})
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: '9.5px',
                          padding: '1px 5px',
                          borderRadius: '3px',
                          color: '#ffffff',
                          background: categoryColor,
                          fontWeight: 'bold',
                        }}
                      >
                        {item.categoryLabel}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: '#2563eb' }}>
                      <span>단어 삽입</span>
                      <CornerDownLeft size={10} />
                    </div>
                  </div>

                  {/* 중단: 간단 설명 */}
                  <div
                    style={{ fontSize: '10.5px', color: '#475569', marginBottom: '5px' }}
                    onClick={() => handleSelectTerm(item.term)}
                  >
                    {item.description}
                  </div>

                  {/* 하단: 원클릭 추천 조치사항/비고 완성 문구 */}
                  {item.suggestedPhrases && item.suggestedPhrases.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      {item.suggestedPhrases.slice(0, 2).map((phrase, pIdx) => (
                        <button
                          key={pIdx}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectPhrase(phrase);
                          }}
                          style={{
                            textAlign: 'left',
                            fontSize: '11px',
                            color: '#1e293b',
                            background: '#f8fafc',
                            border: '1px dashed #cbd5e1',
                            borderRadius: '3px',
                            padding: '3px 6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '4px',
                          }}
                          title="클릭하여 완성 문구 전체 입력"
                        >
                          <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            💡 {phrase}
                          </span>
                          <span style={{ fontSize: '9.5px', color: '#059669', flexShrink: 0, fontWeight: 'bold' }}>
                            +문구적용
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 안내 푸터 */}
          <div
            style={{
              padding: '4px 10px',
              background: '#f8fafc',
              borderTop: '1px solid #e2e8f0',
              fontSize: '10px',
              color: '#64748b',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>초성 검색 지원 (예: &apos;ㄱㅂㅎ&apos;=광분배함, &apos;5g&apos;, &apos;ㅇㅌㄴ&apos;)</span>
            <span>Tab / Enter 선택</span>
          </div>
        </div>
      )}
    </div>
  );
}
