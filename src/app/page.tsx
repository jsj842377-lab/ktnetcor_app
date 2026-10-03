'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Home() {
  const [workerName, setWorkerName] = useState('');
  const router = useRouter();

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!workerName.trim()) return alert('작업자 이름을 입력해주세요.');
    // 입력한 작업자 이름을 URL 파라미터로 달아 대시보드로 이동
    router.push(`/dashboard?worker=${encodeURIComponent(workerName)}`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#f8fafc', position: 'relative' }}>
      
      {/* ★ 추가: 우측 상단 관리자 페이지 바로가기 버튼 */}
      <Link 
        href="/admin" 
        style={{ 
          position: 'absolute', 
          top: '24px', 
          right: '24px', 
          padding: '10px 16px', 
          backgroundColor: '#e2e8f0', 
          color: '#334155', 
          borderRadius: '8px', 
          textDecoration: 'none', 
          fontWeight: 'bold', 
          fontSize: '14px', 
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
          transition: 'background-color 0.2s' 
        }}
      >
        ⚙️ 관리자
      </Link>

      <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
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
            value={workerName}
            onChange={(e) => setWorkerName(e.target.value)}
            style={{ width: '100%', padding: '14px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '20px', fontSize: '16px', boxSizing: 'border-box', outline: 'none' }}
          />
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