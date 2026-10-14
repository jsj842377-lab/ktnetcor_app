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
    <div className="login-root">
      <style jsx global>{`
        :root {
          --bg: #f8f7f4;
          --ink: #1a1a1a;
          --accent: #d4a373;
          --ink-faint: rgba(26, 26, 26, 0.12);
        }

        .login-root {
          background-color: var(--bg);
          color: var(--ink);
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          min-height: 100vh;
          display: grid;
          grid-template-columns: 1fr 450px;
          -webkit-font-smoothing: antialiased;
        }

        @media (max-width: 900px) {
          .login-root {
            grid-template-columns: 1fr;
            min-height: 100vh;
          }
        }

        .visual-side {
          background-color: #e9e7e2;
          border-right: 1.5px solid var(--ink);
          position: relative;
          padding: clamp(32px, 6vw, 60px);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          overflow: hidden;
          min-height: 380px;
        }

        @media (max-width: 900px) {
          .visual-side {
            border-right: none;
            border-bottom: 1.5px solid var(--ink);
            min-height: 300px;
          }
        }

        .visual-side::after {
          content: "";
          position: absolute;
          bottom: 60px;
          right: -1px;
          width: 120px;
          height: 1.5px;
          background: var(--ink);
        }

        @media (max-width: 900px) {
          .visual-side::after {
            display: none;
          }
        }

        .brand-heading {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: clamp(4rem, 10vw, 8rem);
          line-height: 0.82;
          font-style: italic;
          font-weight: 600;
          letter-spacing: -0.05em;
          color: var(--ink);
          user-select: none;
        }

        .form-side {
          padding: clamp(40px, 8vw, 80px) clamp(24px, 6vw, 60px);
          display: flex;
          flex-direction: column;
          justify-content: center;
          background-color: var(--bg);
          position: relative;
        }

        .meta-label {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.65rem;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          opacity: 0.6;
          margin-bottom: 1.75rem;
          display: block;
        }

        .form-title {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: clamp(2rem, 4vw, 2.5rem);
          font-weight: 600;
          margin-bottom: 0.75rem;
          letter-spacing: -0.02em;
          color: var(--ink);
          line-height: 1.2;
        }

        .instruction {
          font-size: 0.95rem;
          line-height: 1.6;
          color: rgba(26, 26, 26, 0.65);
          margin-bottom: 2.5rem;
          max-width: 320px;
        }

        .input-stack {
          display: flex;
          flex-direction: column;
          gap: 0;
          margin-bottom: 2rem;
        }

        .custom-input {
          width: 100%;
          padding: 18px 0;
          background: transparent;
          border: none;
          border-bottom: 1.5px solid var(--ink-faint);
          font-size: 1rem;
          color: var(--ink);
          outline: none;
          transition: border-color 0.2s, background-color 0.2s;
          border-radius: 0;
        }

        .custom-input::placeholder {
          color: rgba(26, 26, 26, 0.4);
          font-size: 0.92rem;
        }

        .custom-input:focus {
          border-bottom-color: var(--ink);
        }

        .login-submit-btn {
          align-self: flex-start;
          padding: 16px 44px;
          background: var(--ink);
          color: var(--bg);
          border: 1.5px solid var(--ink);
          border-radius: 999px;
          font-weight: 500;
          font-size: 0.9rem;
          cursor: pointer;
          transition: all 0.2s ease;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        .login-submit-btn:hover {
          background: #333333;
          transform: translateY(-1px);
        }

        .login-submit-btn:active {
          transform: translateY(0);
        }

        .bottom-nav {
          margin-top: 3rem;
          display: flex;
          justify-content: space-between;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.65rem;
          letter-spacing: 0.05em;
          color: rgba(26, 26, 26, 0.55);
        }

        .deco-svg {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          opacity: 0.06;
          width: 80%;
          max-width: 480px;
          pointer-events: none;
          color: var(--ink);
        }

        .quick-hints {
          margin-top: 1.5rem;
          display: flex;
          align-items: center;
          gap: 12px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.7rem;
          color: rgba(26, 26, 26, 0.5);
        }

        .quick-hint-btn {
          background: none;
          border: none;
          padding: 0;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.7rem;
          color: var(--ink);
          text-decoration: underline;
          cursor: pointer;
          opacity: 0.7;
          transition: opacity 0.15s;
        }

        .quick-hint-btn:hover {
          opacity: 1;
        }
      `}</style>

      {/* Visual Side */}
      <section className="visual-side">
        <div>
          <span className="meta-label">[ SECTION 01 ]</span>
          <h1 className="brand-heading">
            Safety<br />Report
          </h1>
        </div>

        <svg className="deco-svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="0.5" />
          <path d="M50 5 L50 95 M5 50 L95 50" stroke="currentColor" strokeWidth="0.5" />
        </svg>

        <div style={{ fontSize: '0.82rem', lineHeight: '1.6', color: 'rgba(26, 26, 26, 0.75)', zIndex: 1 }}>
          <strong style={{ fontWeight: 600, color: 'var(--ink)' }}>경기설계팀</strong><br />
          현장 안전점검 보고 시스템
        </div>
      </section>

      {/* Form Side */}
      <section className="form-side">
        <div>
          <span className="meta-label">Authentication</span>
          <h2 className="form-title">협력사관리시스템</h2>
          <p className="instruction">
            이름과 비밀번호를 입력하여 로그인하세요.
          </p>

          <form onSubmit={handleLogin}>
            <div className="input-stack">
              <input
                type="text"
                className="custom-input"
                placeholder="이름 (관리자 접속 시 '관리자' 입력)"
                value={workerName}
                onChange={e => {
                  setWorkerName(e.target.value);
                  if (errorMessage) setErrorMessage('');
                }}
                required
                autoComplete="name"
              />
              <input
                type="password"
                className="custom-input"
                placeholder="비밀번호 (관리자: 1234)"
                value={password}
                onChange={e => {
                  setPassword(e.target.value);
                  if (errorMessage) setErrorMessage('');
                }}
                required
                autoComplete="current-password"
              />
            </div>

            {errorMessage && (
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.75rem',
                  color: '#b91c1c',
                  marginBottom: '1.5rem',
                  letterSpacing: '0.02em',
                }}
              >
                * {errorMessage}
              </div>
            )}

            <button type="submit" className="login-submit-btn">
              현장 입장하기
              <span aria-hidden="true">→</span>
            </button>
          </form>

          {/* 빠른 입력 편의 버튼 */}
          <div className="quick-hints">
            <span>[QUICK]</span>
            <button
              type="button"
              className="quick-hint-btn"
              onClick={() => handleQuickFill('홍길동', '1234')}
            >
              작업자 로그인
            </button>
            <span>/</span>
            <button
              type="button"
              className="quick-hint-btn"
              onClick={() => handleQuickFill('관리자', '1234')}
            >
              관리자 모드
            </button>
          </div>
        </div>

        <div className="bottom-nav">
          <span>© 2024 SAFETY SYSTEM</span>
          <span>INDEX_NO: 771-B</span>
        </div>
      </section>
    </div>
  );
}