'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [serviceType, setServiceType] = useState<'safety' | 'material'>('safety');
  const [workerName, setWorkerName] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    try {
      const savedService = localStorage.getItem('kt_last_selected_service');
      if (savedService === 'material' || savedService === 'safety') {
        setServiceType(savedService);
      }
      const savedWorker = localStorage.getItem('kt_current_worker');
      if (savedWorker && savedWorker !== '관리자') {
        setWorkerName(savedWorker);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const trimmedName = workerName.trim();
    const trimmedPw = password.trim();

    if (!trimmedName) {
      setErrorMessage('이름을 입력해주세요.');
      return;
    }
    if (!trimmedPw) {
      setErrorMessage('비밀번호를 입력해주세요.');
      return;
    }

    try {
      localStorage.setItem('kt_last_selected_service', serviceType);
    } catch {
      // ignore
    }

    // 관리자 계정: '관리자' / '1234' 입력 시 최고 관리자 페이지로 이동
    if (trimmedName === '관리자' && trimmedPw === '1234') {
      localStorage.setItem('kt_current_worker', '관리자');
      router.push('/admin');
      return;
    }

    // 일반 작업자 로그인: 선택한 시스템(안전점검 vs 자재실사)으로 직행
    localStorage.setItem('kt_current_worker', trimmedName);
    if (serviceType === 'material') {
      router.push(`/material?worker=${encodeURIComponent(trimmedName)}`);
    } else {
      router.push(`/dashboard?worker=${encodeURIComponent(trimmedName)}`);
    }
  };

  const handleQuickFill = (name: string, pw: string, targetService?: 'safety' | 'material') => {
    setWorkerName(name);
    setPassword(pw);
    if (targetService) {
      setServiceType(targetService);
    }
    setErrorMessage('');
  };

  return (
    <div className="v3-page-wrapper">
      <style jsx global>{`
        :root {
          --bg: #fdfdfc;
          --ink: #1a1a1a;
          --accent: #a37c5d;
          --ink-faint: rgba(26, 26, 26, 0.08);
          --ink-muted: rgba(26, 26, 26, 0.5);
        }

        .v3-page-wrapper {
          background-color: var(--bg);
          color: var(--ink);
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          -webkit-font-smoothing: antialiased;
          min-height: 100vh;
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        @media (max-width: 860px) {
          .v3-page-wrapper {
            height: auto;
            min-height: 100vh;
            overflow-y: auto;
            align-items: stretch;
          }
        }

        .v3-container {
          width: 100%;
          height: 100%;
          display: grid;
          grid-template-rows: auto 1fr auto;
          padding: 40px;
          box-sizing: border-box;
        }

        @media (max-width: 860px) {
          .v3-container {
            padding: 24px 20px;
            display: flex;
            flex-direction: column;
            gap: 32px;
          }
        }

        header.v3-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1.5px solid var(--ink);
          padding-bottom: 20px;
        }

        .mono {
          font-family: 'Geist Mono', 'JetBrains Mono', monospace;
          font-size: 0.65rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--ink-muted);
        }

        main.v3-main {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px 0;
        }

        .v3-card {
          width: 100%;
          max-width: 900px;
          display: grid;
          grid-template-columns: 1fr 1px 360px;
          gap: 60px;
          align-items: center;
        }

        @media (max-width: 860px) {
          .v3-card {
            grid-template-columns: 1fr;
            gap: 36px;
          }
        }

        .divider {
          background-color: var(--ink-faint);
          height: 240px;
          width: 1px;
        }

        @media (max-width: 860px) {
          .divider {
            width: 100%;
            height: 1px;
          }
        }

        .content-area {
          text-align: right;
        }

        @media (max-width: 860px) {
          .content-area {
            text-align: left;
          }
        }

        .icon-seal {
          font-size: 2.5rem;
          margin-bottom: 1rem;
          display: inline-block;
          line-height: 1;
        }

        h1.v3-title {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: clamp(3.2rem, 6.5vw, 5rem);
          font-weight: 300;
          line-height: 0.88;
          letter-spacing: -0.02em;
          margin-bottom: 1.5rem;
          color: var(--ink);
        }

        .description {
          font-weight: 300;
          font-size: 1rem;
          color: var(--ink-muted);
          line-height: 1.6;
        }

        .form-area {
          width: 100%;
        }

        .v3-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .input-group {
          border-bottom: 1px solid var(--ink);
          padding: 8px 0;
          transition: border-color 0.2s;
        }

        .input-group:focus-within {
          border-bottom-width: 1.5px;
        }

        .input-group input {
          width: 100%;
          border: none;
          background: none;
          padding: 12px 0;
          font-family: inherit;
          font-size: 1rem;
          color: var(--ink);
          outline: none;
          border-radius: 0;
        }

        .input-group input::placeholder {
          color: var(--ink-muted);
          opacity: 0.6;
          font-style: italic;
        }

        .submit-btn {
          margin-top: 10px;
          padding: 18px;
          background: var(--ink);
          color: var(--bg);
          border: none;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 500;
          font-size: 0.9rem;
          letter-spacing: 0.02em;
          cursor: pointer;
          transition: opacity 0.2s, transform 0.15s ease;
          width: 100%;
          text-align: center;
        }

        .submit-btn:hover {
          opacity: 0.9;
          transform: translateY(-1px);
        }

        .submit-btn:active {
          transform: translateY(0);
        }

        .error-banner {
          font-family: 'Geist Mono', 'JetBrains Mono', monospace;
          font-size: 0.75rem;
          color: #dc2626;
          letter-spacing: 0.03em;
          padding-top: 4px;
        }

        .quick-nav {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 14px;
          font-family: 'Geist Mono', 'JetBrains Mono', monospace;
          font-size: 0.68rem;
          color: var(--ink-muted);
        }

        .quick-link {
          background: none;
          border: none;
          padding: 0;
          font-family: inherit;
          font-size: inherit;
          color: var(--accent);
          text-decoration: underline;
          cursor: pointer;
          transition: opacity 0.15s;
        }

        .quick-link:hover {
          opacity: 0.75;
        }

        .service-selector-wrapper {
          margin-bottom: 22px;
        }

        .service-selector {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .service-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          border: 1.5px solid var(--ink-faint);
          background: #ffffff;
          border-radius: 8px;
          cursor: pointer;
          text-align: left;
          transition: all 0.2s ease;
        }

        .service-btn:hover {
          border-color: var(--ink-muted);
          background: var(--bg);
        }

        .service-btn.active {
          border-color: var(--ink);
          background: var(--ink);
          color: var(--bg);
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
        }

        .service-icon {
          font-size: 1.45rem;
          line-height: 1;
          flex-shrink: 0;
        }

        .service-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
          overflow: hidden;
        }

        .service-name {
          font-size: 0.9rem;
          font-weight: 700;
          letter-spacing: -0.01em;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .service-desc {
          font-size: 0.68rem;
          opacity: 0.75;
          letter-spacing: -0.01em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .service-btn.active .service-desc {
          opacity: 0.85;
          color: rgba(255, 255, 255, 0.85);
        }

        .service-tag {
          font-size: 0.58rem;
          padding: 1px 4px;
          border-radius: 3px;
          background: #10b981;
          color: #ffffff;
          font-weight: 700;
        }

        footer.v3-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-top: 1.5px solid var(--ink);
          padding-top: 20px;
        }

        ::selection {
          background: var(--accent);
          color: white;
        }
      `}</style>

      <div className="v3-container">
        {/* Header */}
        <header className="v3-header">
          <div className="mono">Site Control Unit // Seoul Branch</div>
          <div className="mono">경기설계팀</div>
        </header>

        {/* Main Section with Card */}
        <main className="v3-main">
          <div className="v3-card">
            {/* Content Area (Left) */}
            <div className="content-area">
              <span className="icon-seal" role="img" aria-label={serviceType === 'safety' ? '안전모 작업자' : '자재 박스'}>
                {serviceType === 'safety' ? '👷' : '📦'}
              </span>
              <h1 className="v3-title">
                {serviceType === 'safety' ? (
                  <>
                    현장<br />안전점검
                  </>
                ) : (
                  <>
                    자재품질<br />실사시스템
                  </>
                )}
              </h1>
              <p className="description">
                {serviceType === 'safety'
                  ? '경기설계팀 현장 안전점검 및 위험요소 실시간 판정 시스템. 이름과 비밀번호를 입력하여 입장하십시오.'
                  : '경기설계팀 현장 반입 자재 규격 OCR 교차 검증 및 5대 검수 품질 실사 시스템. 이름과 비밀번호를 입력하여 입장하십시오.'}
              </p>
            </div>

            {/* Divider */}
            <div className="divider" />

            {/* Form Area (Right) */}
            <div className="form-area">
              {/* 시스템 사전 선택 (로그인 전 선택) */}
              <div className="service-selector-wrapper">
                <div className="mono" style={{ marginBottom: '8px', color: 'var(--accent)', fontWeight: 600 }}>
                  Select Target System // 접속 대상 시스템 선택
                </div>
                <div className="service-selector">
                  <button
                    type="button"
                    className={`service-btn ${serviceType === 'safety' ? 'active' : ''}`}
                    onClick={() => setServiceType('safety')}
                  >
                    <span className="service-icon">🛡️</span>
                    <div className="service-info">
                      <span className="service-name">안전점검</span>
                      <span className="service-desc">보호구 및 위험요소</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`service-btn ${serviceType === 'material' ? 'active' : ''}`}
                    onClick={() => setServiceType('material')}
                  >
                    <span className="service-icon">📦</span>
                    <div className="service-info">
                      <span className="service-name">
                        자재실사
                        <span className="service-tag">QC</span>
                      </span>
                      <span className="service-desc">규격 OCR 및 일치율</span>
                    </div>
                  </button>
                </div>
              </div>

              <form onSubmit={handleLogin} className="v3-form">
                <div className="input-group">
                  <div className="mono" style={{ marginBottom: '4px', opacity: 1, color: 'var(--accent)' }}>
                    Name
                  </div>
                  <input
                    type="text"
                    placeholder="이름 (관리자 접속 시 '관리자' 입력)"
                    value={workerName}
                    onChange={(e) => {
                      setWorkerName(e.target.value);
                      if (errorMessage) setErrorMessage('');
                    }}
                    autoComplete="name"
                    required
                  />
                </div>

                <div className="input-group">
                  <div className="mono" style={{ marginBottom: '4px', opacity: 1, color: 'var(--accent)' }}>
                    Key
                  </div>
                  <input
                    type="password"
                    placeholder="비밀번호"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errorMessage) setErrorMessage('');
                    }}
                    autoComplete="current-password"
                    required
                  />
                </div>

                {errorMessage && (
                  <div className="error-banner">
                    ! {errorMessage}
                  </div>
                )}

                <button type="submit" className="submit-btn">
                  {serviceType === 'safety'
                    ? '🛡️ 안전점검 시스템 입장 — ENTER SAFETY'
                    : '📦 자재실사(QC) 시스템 입장 — ENTER MATERIAL QC'}
                </button>

                {/* 빠른 채우기 보조 버튼 */}
                <div className="quick-nav">
                  <span>[QUICK]</span>
                  <button
                    type="button"
                    className="quick-link"
                    onClick={() => handleQuickFill('홍길동', '1234', 'safety')}
                  >
                    안전점검(홍길동)
                  </button>
                  <span>/</span>
                  <button
                    type="button"
                    className="quick-link"
                    onClick={() => handleQuickFill('전현진', '1234', 'material')}
                  >
                    자재실사(전현진)
                  </button>
                  <span>/</span>
                  <button
                    type="button"
                    className="quick-link"
                    onClick={() => handleQuickFill('관리자', '1234')}
                  >
                    관리자
                  </button>
                </div>
              </form>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="v3-footer">
          <div className="mono">Status: Secure Layer Active</div>
          <div className="mono">© 2024 SAFETY REPORTING SYSTEM</div>
        </footer>
      </div>
    </div>
  );
}