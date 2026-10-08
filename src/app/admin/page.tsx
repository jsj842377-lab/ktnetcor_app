'use client';

import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const router = useRouter();

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '40px 16px', fontFamily: "'Pretendard', sans-serif", textAlign: 'center' }}>
      <div style={{ background: '#ffffff', padding: '40px', borderRadius: '8px', border: '1px solid #cbd5e1', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
        <h2 style={{ margin: '0 0 16px 0', fontSize: '24px', color: '#0f172a' }}>
          ⚙️ 관리자 대시보드
        </h2>
        <p style={{ color: '#475569', fontSize: '15px', lineHeight: '1.6', marginBottom: '24px' }}>
          관리자 권한 확인 및 데이터베이스 제어 페이지입니다.<br />
          현재 기능 연동을 준비 중입니다.
        </p>
        
        <button 
          onClick={() => router.push('/')}
          style={{ 
            padding: '14px 24px', 
            background: '#2563eb', 
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
  );
}