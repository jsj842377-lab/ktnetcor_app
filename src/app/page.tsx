'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';

const ALLOWED_WORKERS = ['전소정', '김철수', '이영희', '박지민', '최동훈', '정유진', '강민재', '조수빈', '윤건우', '홍길동'];

export default function HomePage() {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedName = name.trim();
    const trimmedPassword = password.trim();

    if (!trimmedName || !trimmedPassword) {
      alert('이름과 비밀번호를 모두 입력해주세요.');
      return;
    }

    if (trimmedName !== '전현진' && !ALLOWED_WORKERS.includes(trimmedName)) {
      alert('접근 권한이 없는 계정입니다.');
      return;
    }

    // DB에서 사용자 정보 가져오기
    let { data: worker } = await supabase.from('workers').select('*').eq('worker_name', trimmedName).single();

    // 등록되지 않은 새 사용자일 경우 초기 비밀번호(1234)인지 검사 후 DB에 자동 생성
    if (!worker) {
      if (trimmedPassword !== '1234') {
        alert('초기 비밀번호는 1234입니다.');
        return;
      }
      const { data: newWorker } = await supabase.from('workers').insert([{ worker_name: trimmedName, password: '1234', level: 1, exp: 0 }]).select().single();
      worker = newWorker;
    } 
    // 이미 존재하는 사용자라면 비밀번호 대조
    else {
      if (worker.password !== trimmedPassword) {
        alert('비밀번호가 일치하지 않습니다.');
        return;
      }
    }

    // 인증 완료 후 라우팅 (관리자 vs 작업자)
    if (trimmedName === '전현진') {
      router.push('/admin');
    } else {
      router.push(`/dashboard?worker=${encodeURIComponent(trimmedName)}`);
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
        <p style={{ color: '#64748b', marginBottom: '24px', fontSize: '14px' }}>이름과 비밀번호를 입력하여 로그인하세요.</p>
        
        <input 
          type="text" 
          placeholder="이름 (예: 홍길동)"
          value={name} 
          onChange={e => setName(e.target.value)} 
          style={{ width: '100%', padding: '14px', marginBottom: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '16px', boxSizing: 'border-box', outline: 'none' }} 
          autoFocus 
        />
        <input 
          type="password" 
          placeholder="비밀번호 (초기: 1234)"
          value={password} 
          onChange={e => setPassword(e.target.value)} 
          style={{ width: '100%', padding: '14px', marginBottom: '20px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '16px', boxSizing: 'border-box', outline: 'none' }} 
        />
        
        <button type="submit" style={{ padding: '14px', width: '100%', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>
          현장 입장하기
        </button>
      </form>
    </div>
  );
}