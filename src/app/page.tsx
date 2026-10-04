'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// ★ 저장 및 Vercel 갱신 확인용: 경기설계팀 10명 명단
const ALLOWED_WORKERS = ['전소정', '김철수', '이영희', '박지민', '최동훈', '정유진', '강민재', '조수빈', '윤건우', '홍길동'];

export default function HomePage() {
  const [name, setName] = useState('');
  const router = useRouter();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedName = name.trim();
    if (!trimmedName) {
      alert('이름을 입력해주세요.');
      return;
    }

    // 1. 관리자 접속 감지 (admin 포함)
    if (trimmedName === '관리자' || trimmedName.toLowerCase() === 'admin') {
      router.push('/admin');
    } 
    // 2. 화이트리스트에 있는 작업자 감지
    else if (ALLOWED_WORKERS.includes(trimmedName)) {
      router.push(`/dashboard?worker=${encodeURIComponent(trimmedName)}`);
    } 
    // 3. 그 외의 사용자 차단
    else {
      alert('경기설계팀 소속 팀원만 접근할 수 있습니다. 등록된 이름을 확인해주세요.');
      setName('');
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f8fafc', fontFamily: "'Pretendard', sans-serif" }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
        body { margin: 0; }
      `}} />
      
      <form onSubmit={handleLogin} style={{ background: 'white', padding: '40px', borderRadius: '16px', textAlign: 'center', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', width: '100%', maxWidth: '400px', margin: '20px', boxSizing: 'border-box' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>👷‍♂️</div>
        <h2 style={{ margin: '0 0 8px 0', color: '#0f172a', fontSize: '24px', fontWeight: 'bold' }}>안전점검 시스템</h2>
        <p style={{ color: '#64748b', marginBottom: '24px', fontSize: '14px' }}>작업자 이름을 입력하여 로그인하세요.</p>
        
        <input 
          type="text" 
          placeholder="이름을 입력하세요 (예: 전소정)"
          value={name} 
          onChange={e => setName(e.target.value)} 
          style={{ width: '100%', padding: '14px', marginBottom: '20px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '16px', boxSizing: 'border-box', outline: 'none' }} 
          autoFocus 
        />
        
        <button type="submit" style={{ padding: '14px', width: '100%', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>
          현장 입장하기
        </button>
      </form>
    </div>
  );
}