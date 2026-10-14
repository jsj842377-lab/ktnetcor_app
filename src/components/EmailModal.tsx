'use client';

import React, { useState } from 'react';
import {
  X,
  Mail,
  Send,
  Copy,
  Check,
  Share2,
  FileText,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';

interface EmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportMarkdown: string;
  photoUrls: string[];
  workerName: string;
  dateStr: string;
}

export default function EmailModal({
  isOpen,
  onClose,
  reportMarkdown,
  photoUrls,
  workerName,
  dateStr,
}: EmailModalProps) {
  const [toEmail, setToEmail] = useState('');
  const [memo, setMemo] = useState('');
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [recentEmails, setRecentEmails] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem('kt_recent_emails');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // 공사번호 추출 (제목 자동 생성용)
  const projMatch = reportMarkdown.match(/\*\*공사번호\*\*\s*\|\s*([^|]+?)\s*\|/);
  const projNumber = projMatch ? projMatch[1].trim() : '';

  const defaultSubject = `[현장 안전점검 보고서] ${projNumber ? `${projNumber} - ` : ''}${workerName} (${dateStr})`;
  const [subject, setSubject] = useState(defaultSubject);
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

  if (isOpen && !prevIsOpen) {
    setPrevIsOpen(true);
    setSubject(defaultSubject);
    setSendResult(null);
    setCopied(false);
  } else if (!isOpen && prevIsOpen) {
    setPrevIsOpen(false);
  }

  // 이메일 본문 생성 (텍스트 규격)
  const generateEmailBody = () => {
    const lines: string[] = [];

    lines.push(`=========================================`);
    lines.push(`       KT 현장 안전점검 결과보고서       `);
    lines.push(`=========================================`);
    lines.push(`■ 점검일자: ${dateStr}`);
    lines.push(`■ 점검책임자: ${workerName}`);
    if (projNumber) lines.push(`■ 공사번호: ${projNumber}`);
    lines.push(``);

    if (memo.trim()) {
      lines.push(`[작업자 전달사항]`);
      lines.push(memo.trim());
      lines.push(`-----------------------------------------`);
      lines.push(``);
    }

    lines.push(`[보고서 본문]`);
    // 마크다운 표 및 굵은 글씨를 이메일에서 읽기 쉬운 텍스트 형식으로 가공
    const cleanedReport = reportMarkdown
      .replace(/###\s+/g, '')
      .replace(/####\s+/g, '\n')
      .replace(/\*\*/g, '')
      .trim();

    lines.push(cleanedReport);
    lines.push(``);

    if (photoUrls.length > 0) {
      lines.push(`-----------------------------------------`);
      lines.push(`[첨부된 현장 증빙 사진 (${photoUrls.length}장)]`);
      photoUrls.forEach((url, i) => {
        lines.push(`- 사진 ${i + 1}: ${url}`);
      });
      lines.push(``);
    }

    lines.push(`=========================================`);
    lines.push(`* 본 메일은 협력사 안전점검 시스템을 통해 발송되었습니다.`);

    return lines.join('\n');
  };

  const saveRecentEmail = (email: string) => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) return;
    try {
      const updated = Array.from(new Set([trimmed, ...recentEmails])).slice(0, 5);
      setRecentEmails(updated);
      localStorage.setItem('kt_recent_emails', JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  // 1. 기본 메일 앱 (mailto:) 실행
  const handleOpenMailClient = () => {
    const body = generateEmailBody();
    if (toEmail) saveRecentEmail(toEmail);

    const mailtoUrl = `mailto:${encodeURIComponent(toEmail.trim())}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;

    window.location.href = mailtoUrl;
  };

  // 2. 이메일 본문 클립보드 복사
  const handleCopyBody = async () => {
    const body = generateEmailBody();
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      alert('클립보드 복사에 실패했습니다. 브라우저 권한을 확인해주세요.');
    }
  };

  // 3. 서버 직접 발송 (SMTP 설정된 경우)
  const handleServerSend = async () => {
    if (!toEmail.trim()) {
      alert('수신자 이메일 주소를 입력해주세요.');
      return;
    }

    setSending(true);
    setSendResult(null);

    try {
      saveRecentEmail(toEmail);
      const text = generateEmailBody();

      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: toEmail.trim(),
          subject: subject.trim(),
          text,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (data.ok) {
        setSendResult({ ok: true, message: '이메일이 성공적으로 발송되었습니다.' });
      } else if (data.code === 'SMTP_NOT_CONFIGURED') {
        // 서버 SMTP가 미설정된 경우, 친절한 안내와 함께 mailto 앱을 자동 연동
        setSendResult({
          ok: false,
          message: '서버 SMTP가 설정되지 않아, 기기 메일 앱(mailto:)으로 연결합니다.',
        });
        setTimeout(() => {
          handleOpenMailClient();
        }, 800);
      } else {
        setSendResult({ ok: false, message: data.error || '이메일 발송에 실패했습니다.' });
      }
    } catch (err: any) {
      setSendResult({ ok: false, message: err.message || '네트워크 오류가 발생했습니다.' });
    } finally {
      setSending(false);
    }
  };

  // 4. 모바일/브라우저 시스템 공유 (Web Share)
  const handleSystemShare = async () => {
    const body = generateEmailBody();
    if (navigator.share) {
      try {
        await navigator.share({
          title: subject,
          text: body,
        });
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.warn('공유 실패:', err);
        }
      }
    } else {
      handleCopyBody();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        userSelect: 'none',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        style={{
          background: '#ffffff',
          borderRadius: '8px',
          width: '100%',
          maxWidth: '560px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
          overflow: 'hidden',
          fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif",
          color: '#0f172a',
        }}
      >
        {/* 모달 상단 헤더 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 20px',
            borderBottom: '1px solid #e2e8f0',
            background: '#f8fafc',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                background: '#eff6ff',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Mail size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#0f172a' }}>
                안전점검 보고서 이메일 전송
              </h3>
              <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>
                담당 관리자나 감독관에게 보고서를 메일로 전달합니다
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            title="닫기"
            style={{
              background: 'transparent',
              border: 'none',
              padding: '6px',
              borderRadius: '4px',
              cursor: 'pointer',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* 폼 입력 영역 */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* 수신자 이메일 입력 */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px', color: '#334155' }}>
              수신자 이메일 주소 <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="email"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              placeholder="예: manager@kt.com, inspector@partner.com"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                boxSizing: 'border-box',
                fontSize: '14px',
                color: '#0f172a',
                background: '#ffffff',
              }}
            />
            {recentEmails.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', color: '#64748b' }}>최근 수신처:</span>
                {recentEmails.map((email) => (
                  <button
                    key={email}
                    type="button"
                    onClick={() => setToEmail(email)}
                    style={{
                      background: '#f1f5f9',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '2px 8px',
                      fontSize: '11px',
                      color: '#334155',
                      cursor: 'pointer',
                    }}
                  >
                    {email}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 이메일 제목 입력 */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px', color: '#334155' }}>
              이메일 제목
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                boxSizing: 'border-box',
                fontSize: '14px',
                color: '#0f172a',
                background: '#ffffff',
              }}
            />
          </div>

          {/* 추가 전달 메모 */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px', color: '#334155' }}>
              추가 전달사항 (선택사항)
            </label>
            <textarea
              rows={2}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="예: 오늘 안산-설비 현장 안전점검 완료건 보고드립니다. 특이사항 없습니다."
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                boxSizing: 'border-box',
                fontSize: '13px',
                color: '#0f172a',
                resize: 'none',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* 본문 미리보기 아코디언 */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              style={{
                width: '100%',
                padding: '10px 14px',
                background: '#f8fafc',
                border: 'none',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 'bold',
                color: '#475569',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileText size={15} />
                <span>발송될 이메일 본문 미리보기</span>
              </div>
              <span>{showPreview ? '▲ 접기' : '▼ 펼치기'}</span>
            </button>
            {showPreview && (
              <pre
                style={{
                  margin: 0,
                  padding: '12px',
                  background: '#f8fafc',
                  borderTop: '1px solid #e2e8f0',
                  fontSize: '11px',
                  color: '#334155',
                  maxHeight: '160px',
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'monospace',
                }}
              >
                {generateEmailBody()}
              </pre>
            )}
          </div>

          {/* 발송 결과 메시지 */}
          {sendResult && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: sendResult.ok ? '#ecfdf5' : '#fef2f2',
                color: sendResult.ok ? '#065f46' : '#991b1b',
                border: `1px solid ${sendResult.ok ? '#a7f3d0' : '#fecaca'}`,
              }}
            >
              <AlertCircle size={16} />
              <span>{sendResult.message}</span>
            </div>
          )}
        </div>

        {/* 하단 액션 버튼 바 */}
        <div
          style={{
            padding: '14px 20px',
            background: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {/* 주 발송 액션 버튼들 */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleOpenMailClient}
              title="아웃룩, 기본 메일 앱으로 열기"
              style={{
                flex: 1.5,
                padding: '12px',
                background: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <ExternalLink size={16} />
              <span>메일 앱으로 보내기</span>
            </button>

            <button
              onClick={handleServerSend}
              disabled={sending}
              title="서버를 통해 직접 메일 전송"
              style={{
                flex: 1,
                padding: '12px',
                background: sending ? '#94a3b8' : '#0284c7',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 'bold',
                cursor: sending ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <Send size={16} />
              <span>{sending ? '발송 중...' : '직접 발송'}</span>
            </button>
          </div>

          {/* 보조 액션 버튼들: 본문 복사 & 모바일 공유 */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleCopyBody}
              style={{
                flex: 1,
                padding: '10px',
                background: copied ? '#10b981' : '#ffffff',
                color: copied ? 'white' : '#334155',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.15s ease',
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span>{copied ? '이메일 본문 복사됨!' : '이메일 본문 복사'}</span>
            </button>

            <button
              onClick={handleSystemShare}
              style={{
                padding: '10px 14px',
                background: '#ffffff',
                color: '#334155',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <Share2 size={14} />
              <span>공유</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
