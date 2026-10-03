'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Home() {
  const [workerName, setWorkerName] = useState('');
  // ★ 추가: 로그인 상태 유지 체크박스를 관리하는 상태
  const [keepLoggedIn, setKeepLoggedIn] = useState(false); 
  const router = useRouter();

  useEffect(() => {
    const savedWorker = localStorage.getItem('ktnetcore_worker');
    if (savedWorker) {
      router.push(`/dashboard?worker=${encodeURIComponent(savedWorker)}`);
    }
  }, [router]);

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!workerName.trim()) return alert('작업자 이름을 입력해주세요.');
    
    // ★ 수정: 체크박스가 선택되었을 때만 로컬 스토리지에 저장
    if (keepLoggedIn) {
      localStorage.setItem('ktnetcore_worker', workerName);
    } else {
      // 체크를 풀고 접속하는 경우 기존 저장 기록을 확실히 지워줌
      localStorage.removeItem('ktnetcore_worker'); 
    }
    
    router.push(`/dashboard?worker=${encodeURIComponent(workerName)}`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#f8fafc', position: 'relative', overflow: 'hidden' }}>
      
      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 600px) {
          .admin-text { display: none; }
        }
      `}} />

      <Link 
        href="/admin" 
        style={{ 
          position: 'absolute', 
          top: '20px', 
          right: '20px', 
          padding: '10px 16px', 
          backgroundColor: '#e2e8f0', 
          color: '#334155', 
          borderRadius: '8px', 
          textDecoration: 'none', 
          fontWeight: 'bold', 
          fontSize: '14px', 
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
          transition: 'background-color 0.2s',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          zIndex: 1000
        }}
      >
        <span>⚙️</span>
        <span className="admin-text">관리자</span>
      </Link>

      <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', width: '100%', maxWidth: '400px', textAlign: 'center', zIndex: 1 }}>
        <h1 style={{ margin: '0 0 10px 0', fontSize: '32px', fontWeight: '900' }}>
          <span style={{ color: '#000' }}>kt </span><span style={{ color: '#ec1c24' }}>netcore</span>
        </h1>
        <h2 style={{ margin: '0 0 20px 0', color: '#2563eb', fontSize: '24px', fontWeight: 'bold' }}>현장 관리</h2>
        
        <p style={{ color: '#64748b', fontSize: '14px', lineHeight: '1.6', marginBottom: '30px', wordBreak: 'keep-all' }}>
          안전점검 및 자재실사 사진을 올리고<br/>보고서를 자동 완성하여 캐릭터를 성장시키세요!
        </p>

        <form onSubmit={handleStart} style={{ textAlign: 'left' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#334155', fontSize: '14px' }}>작업자 이름</label>
          <input 
            type="text" 
            placeholder="예: 홍길동"
            value={workerName}
            onChange={(e) => setWorkerName(e.target.value)}
            style={{ width: '100%', padding: '14px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '16px', fontSize: '16px', boxSizing: 'border-box', outline: 'none' }}
          />

          {/* ★ 추가: 로그인 상태 유지 체크박스 UI */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', cursor: 'pointer', fontSize: '14px', color: '#475569' }}>
            <input 
              type="checkbox" 
              checked={keepLoggedIn}
              onChange={(e) => setKeepLoggedIn(e.target.checked)}
              style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#2563eb' }}
            />
            <span>자동 로그인 상태 유지</span>
          </label>

          <button type="submit" style={{ width: '100%', padding: '14px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>
            시작하기
          </button>
        </form>

        <div style={{ marginTop: '30px', fontSize: '12px', color: '#94a3b8' }}>
          © 2026 ktnetcore Gamification Project
        </div>
      </div>
    </div>
  );
}