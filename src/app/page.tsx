'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [workerName, setWorkerName] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!workerName.trim()) {
      alert('이름을 입력해주세요.');
      return;
    }
    if (!password.trim()) {
      alert('비밀번호를 입력해주세요.');
      return;
    }
    
    // ★ 관리자 다이렉트 라우팅 로직: 전현진/1234 입력 시 관리자 페이지로 즉시 이동
    if (workerName === '전현진' && password === '1234') {
      router.push('/admin');
      return;
    }

    // 일반 작업자 로그인 시 대시보드로 이동
    localStorage.setItem('kt_current_worker', workerName);
    router.push(`/dashboard?worker=${encodeURIComponent(workerName)}`);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Pretendard', sans-serif" }}>
      <form 
        onSubmit={handleLogin} 
        style={{ background: '#ffffff', padding: '40px', borderRadius: '12px', width: '90%', maxWidth: '360px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', textAlign: 'center' }}
      >
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>👷</div>
        
        {/* ★ 수정된 부분: "안전점검 시스템" -> "협력사관리시스템" */}
        <h2 style={{ margin: '0 0 8px 0', fontSize: '22px', color: '#0f172a', fontWeight: 'bold' }}>
          협력사 관리 시스템
        </h2>
        
        <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '30px' }}>
          이름과 비밀번호를 입력하여 로그인하세요.
        </p>
        
        <input 
          type="text" 
          placeholder="이름" 
          value={workerName} 
          onChange={e => setWorkerName(e.target.value)} 
          style={{ width: '100%', padding: '14px', marginBottom: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', background: '#f1f5f9', color: '#0f172a', fontSize: '15px' }} 
          required
        />
        <input 
          type="password" 
          placeholder="비밀번호" 
          value={password} 
          onChange={e => setPassword(e.target.value)} 
          style={{ width: '100%', padding: '14px', marginBottom: '24px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', background: '#f1f5f9', color: '#0f172a', fontSize: '15px' }} 
          required
        />
        
        <button 
          type="submit" 
          style={{ width: '100%', padding: '16px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          현장 입장하기
        </button>
      </form>
    </div>
  );
}