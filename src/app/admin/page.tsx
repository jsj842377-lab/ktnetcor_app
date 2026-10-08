'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/context/ThemeContext';

export default function AdminPage() {
  const router = useRouter();
  
  // 전역 상태에서 다크모드 여부와 현재 접속한 작업자 이름을 가져옵니다.
  const { isDarkMode, workerName } = useTheme();
  const [isAuthorized, setIsAuthorized] = useState(false);

  // 다크모드 상태에 따라 UI 색상을 동적으로 변경하는 테마 객체
  const theme = isDarkMode ? {
    bg: '#0f172a', cardBg: '#1e293b', textMain: '#f8fafc', textSub: '#94a3b8',
    border: '#334155', btnPrimary: '#3b82f6'
  } : {
    bg: '#f8fafc', cardBg: '#ffffff', textMain: '#0f172a', textSub: '#475569',
    border: '#cbd5e1', btnPrimary: '#2563eb'
  };

  // 컴포넌트가 렌더링될 때 딱 한 번 실행되는 보안 방어(Guard) 로직
  useEffect(() => {
    // 접속한 사용자의 이름이 'admin' 또는 '관리자'가 아니라면 강제로 튕겨냅니다.
    if (workerName !== 'admin' && workerName !== '관리자') {
      alert('관리자 권한이 없습니다. 메인 화면으로 돌아갑니다.');
      router.push('/');
    } else {
      // 통과한 사람만 화면을 볼 수 있도록 상태 변경
      setIsAuthorized(true);
    }
  }, [workerName, router]);

  // 권한 검사가 끝나기 전까지는 빈 화면(또는 로딩)을 보여주어 데이터 유출을 막습니다.
  if (!isAuthorized) {
    return <div style={{ padding: '60px', textAlign: 'center', fontFamily: "'Pretendard', sans-serif" }}>권한 확인 중...</div>;
  }

  return (
    <div style={{ minHeight: '100vh', background: theme.bg, padding: '40px 16px', fontFamily: "'Pretendard', sans-serif" }}>
      <div style={{ maxWidth: '640px', margin: '0 auto', textAlign: 'center' }}>
        <div style={{ background: theme.cardBg, padding: '40px', borderRadius: '8px', border: `1px solid ${theme.border}`, boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
          <h2 style={{ margin: '0 0 16px 0', fontSize: '24px', color: theme.textMain }}>
            ⚙️ 관리자 대시보드
          </h2>
          <p style={{ color: theme.textSub, fontSize: '15px', lineHeight: '1.6', marginBottom: '24px' }}>
            관리자 권한 확인 및 데이터베이스 제어 페이지입니다.<br />
            현재 기능 연동을 준비 중입니다.
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