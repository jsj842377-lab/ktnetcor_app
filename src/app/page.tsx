'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [workerName, setWorkerName] = useState('');
  const router = useRouter();

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault(); // 엔터 키 입력 시 새로고침 방지
    
    if (!workerName.trim()) {
      alert('작업자 이름을 입력해주세요.');
      return;
    }
    
    // 입력받은 이름을 파라미터로 달아 대시보드로 이동
    router.push(`/dashboard?worker=${encodeURIComponent(workerName)}`);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', padding: '20px', fontFamily: 'sans-serif' }}>
      <div style={{ width: '100%', maxWidth: '400px', backgroundColor: 'white', borderRadius: '16px', padding: '40px 24px', boxShadow: '0 10px 25px rgba(0, 0, 0, 0.05)', textAlign: 'center' }}>
        
        {/* 제목 영역: 단어 단위 줄바꿈 유지 및 KT 로고 색상(Red/Dark) 분리 적용 */}
        <h1 style={{ fontSize: '32px', fontWeight: 'bold', wordBreak: 'keep-all', lineHeight: '1.4', marginBottom: '16px' }}>
          <span style={{ color: '#ec1c24' }}>kt</span>
          <span style={{ color: '#1e293b' }}>netcore</span>
          <br />
          <span style={{ color: '#2563eb' }}>현장 관리</span>
        </h1>
        
        <p style={{ color: '#64748b', fontSize: '15px', lineHeight: '1.6', marginBottom: '40px', wordBreak: 'keep-all' }}>
          안전점검 및 자재실사 사진을 올리고<br />보고서를 자동 완성하여 캐릭터를 성장시키세요!
        </p>

        {/* 폼 영역: 모바일 환경을 고려한 터치 영역(padding) 확보 */}
        <form onSubmit={handleStart} style={{ textAlign: 'left' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', color: '#334155', marginBottom: '8px' }}>
            작업자 이름
          </label>
          <input
            type="text"
            value={workerName}
            onChange={(e) => setWorkerName(e.target.value)}
            placeholder="예: 전소정"
            style={{ 
              width: '100%', 
              padding: '14px', 
              fontSize: '16px', 
              border: '1px solid #cbd5e1', 
              borderRadius: '8px', 
              marginBottom: '24px', 
              outline: 'none', 
              boxSizing: 'border-box' 
            }}
          />
          
          <button
            type="submit"
            style={{ 
              width: '100%', 
              padding: '16px', 
              fontSize: '16px', 
              fontWeight: 'bold', 
              color: 'white', 
              backgroundColor: '#2563eb', 
              border: 'none', 
              borderRadius: '8px', 
              cursor: 'pointer', 
              transition: 'background-color 0.2s' 
            }}
          >
            시작하기
          </button>
        </form>

        <div style={{ marginTop: '32px', fontSize: '12px', color: '#94a3b8' }}>
          © 2026 ktnetcore Gamification Project
        </div>
      </div>
    </div>
  );
}