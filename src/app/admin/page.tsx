'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/context/ThemeContext';

export default function AdminPage() {
  const router = useRouter();
  const { isDarkMode } = useTheme();

  // ★ 권한 상태 및 로그인 폼 상태 관리
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [adminName, setAdminName] = useState('');
  const [adminPwd, setAdminPwd] = useState('');

  // 다크모드 대응 테마
  const theme = isDarkMode ? {
    bg: '#0f172a', cardBg: '#1e293b', textMain: '#f8fafc', textSub: '#94a3b8',
    border: '#334155', btnPrimary: '#3b82f6', inputBg: '#0f172a'
  } : {
    bg: '#f8fafc', cardBg: '#ffffff', textMain: '#0f172a', textSub: '#475569',
    border: '#cbd5e1', btnPrimary: '#2563eb', inputBg: '#f8fafc'
  };

  // ★ 로그인 버튼 클릭 시 실행되는 검증 로직
  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault(); // 폼 제출 시 페이지 새로고침 방지
    
    // 요구하신 '전현진' / '1234' 하드코딩 검증
    if (adminName === '전현진' && adminPwd === '1234') {
      setIsAuthorized(true);
    } else {
      alert('관리자 이름 또는 비밀번호가 일치하지 않습니다.');
    }
  };

  // 🔒 로그인 성공 전(isAuthorized === false)에 보여줄 락커(Locker) 화면
  if (!isAuthorized) {
    return (
      <div style={{ minHeight: '100vh', background: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Pretendard', sans-serif" }}>
        <form onSubmit={handleAdminLogin} style={{ background: theme.cardBg, padding: '40px', borderRadius: '8px', border: `1px solid ${theme.border}`, width: '90%', maxWidth: '340px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>🛡️</div>
          <h2 style={{ margin: '0 0 24px 0', fontSize: '20px', color: theme.textMain }}>최고 관리자 로그인</h2>
          
          <input 
            type="text" 
            placeholder="관리자 이름 (예: 전현진)" 
            value={adminName} 
            onChange={e => setAdminName(e.target.value)} 
            style={{ width: '100%', padding: '14px', marginBottom: '12px', borderRadius: '4px', border: `1px solid ${theme.border}`, boxSizing: 'border-box', background: theme.inputBg, color: theme.textMain, fontSize: '14px' }} 
            required
          />
          <input 
            type="password" 
            placeholder="비밀번호" 
            value={adminPwd} 
            onChange={e => setAdminPwd(e.target.value)} 
            style={{ width: '100%', padding: '14px', marginBottom: '24px', borderRadius: '4px', border: `1px solid ${theme.border}`, boxSizing: 'border-box', background: theme.inputBg, color: theme.textMain, fontSize: '14px' }} 
            required
          />
          
          <button 
            type="submit" 
            style={{ width: '100%', padding: '16px', background: theme.btnPrimary, color: 'white', border: 'none', borderRadius: '4px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '12px' }}
          >
            관리자 접속
          </button>
          
          <button 
            type="button" 
            onClick={() => router.push('/')}
            style={{ width: '100%', padding: '12px', background: 'transparent', color: theme.textSub, border: 'none', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline' }}
          >
            일반 작업자 메인으로 돌아가기
          </button>
        </form>
      </div>
    );
  }

  // 🔓 로그인 성공 시 보여줄 진짜 관리자 대시보드 화면
  return (
    <div style={{ minHeight: '100vh', background: theme.bg, padding: '40px 16px', fontFamily: "'Pretendard', sans-serif" }}>
      <div style={{ maxWidth: '640px', margin: '0 auto', textAlign: 'center' }}>
        <div style={{ background: theme.cardBg, padding: '40px', borderRadius: '8px', border: `1px solid ${theme.border}`, boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
          <h2 style={{ margin: '0 0 16px 0', fontSize: '24px', color: theme.textMain }}>
            👑 전현진 관리자님, 환영합니다.
          </h2>
          <p style={{ color: theme.textSub, fontSize: '15px', lineHeight: '1.6', marginBottom: '24px' }}>
            전체 현장의 데이터베이스 제어 및 통계 확인이 가능한 관리자 전용 구역입니다.<br />
            현재 세부 관리 기능 연동을 준비 중입니다.
          </p>
          
          <button 
            onClick={() => router.push('/')}
            style={{ 
              padding: '14px 24px', 
              background: theme.btnPrimary, 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px', 
              fontSize: '15px',
              fontWeight: 'bold',
              cursor: 'pointer' 
            }}
          >
            메인 화면으로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
}