'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [workerName, setWorkerName] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

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

    // 관리자 계정: '관리자' / '1234' 입력 시 최고 관리자 페이지로 이동
    if (trimmedName === '관리자' && trimmedPw === '1234') {
      router.push('/admin');
      return;
    }

    // 일반 작업자 로그인 시 대시보드로 이동
    localStorage.setItem('kt_current_worker', trimmedName);
    router.push(`/dashboard?worker=${encodeURIComponent(trimmedName)}`);
  };

  const handleQuickFill = (name: string, pw: string) => {
    setWorkerName(name);
    setPassword(pw);
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
              <span className="icon-seal" role="img" aria-label="안전모 작업자">👷</span>
              <h1 className="v3-title">
                협력사<br />관리시스템
              </h1>
              <p className="description">
                경기설계팀 현장 안전점검 보고 시스템.<br />
                이름과 비밀번호를 입력하여 입장하십시오.
              </p>
            </div>

            {/* Divider */}
            <div className="divider" />

            {/* Form Area (Right) */}
            <div className="form-area">
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
                  현장 입장하기 — ENTER SITE
                </button>

                {/* 빠른 채우기 보조 버튼 */}
                <div className="quick-nav">
                  <span>[QUICK]</span>
                  <button
                    type="button"
                    className="quick-link"
                    onClick={() => handleQuickFill('홍길동', '1234')}
                  >
                    작업자
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