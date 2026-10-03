'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';

export default function Home() {
  const [workerName, setWorkerName] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // 작업자 등록 및 로그인 처리 함수
  const handleLogin = async () => {
    // 1. 이름 입력 예외 처리 (공백 방지)
    if (!workerName.trim()) {
      alert('이름을 입력해주세요.');
      return;
    }
    
    setLoading(true);
    
    // 2. Supabase 데이터베이스 연동 (workers 테이블에 데이터 삽입)
    const { data, error } = await supabase
      .from('workers')
      .insert([{ worker_name: workerName }])
      .select();

    setLoading(false);

    // 3. 결과 처리 및 페이지 이동
    if (error) {
      console.error("DB Error:", error);
      alert('데이터베이스 연결 오류: ' + error.message);
    } else {
      alert(`환영합니다, ${workerName}님! 캐릭터 육성을 시작합니다.`);
      // URL 파라미터로 이름을 안전하게 전달 (한글 깨짐 방지)
      router.push(`/dashboard?worker=${encodeURIComponent(workerName)}`); 
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-6">
      <div className="z-10 max-w-md w-full flex flex-col items-center gap-6 bg-white p-10 rounded-3xl shadow-xl border border-gray-100">
        
        {/* 타이틀 및 기획 의도 설명 영역 */}
        <div className="text-center">
          <h1 className="text-4xl font-extrabold text-blue-600 mb-4 tracking-tight">
            ktnetcore 현장 관리
          </h1>
          <p className="text-gray-500 leading-relaxed text-sm break-keep">
            안전점검 및 자재실사 사진을 올리고<br/>
            보고서를 자동 완성하여 캐릭터를 성장시키세요!
          </p>
        </div>
        
        {/* 작업자 이름 입력 영역 */}
        <div className="flex flex-col w-full gap-4 mt-2">
          <div className="flex flex-col gap-2">
            <label htmlFor="workerName" className="font-semibold text-gray-700 text-sm">
              작업자 이름
            </label>
            <input 
              id="workerName"
              type="text" 
              value={workerName}
              onChange={(e) => setWorkerName(e.target.value)}
              // 엔터 키(Enter)를 누르면 바로 handleLogin 함수가 실행되도록 연결
              onKeyDown={(e) => { if (e.key === 'Enter') handleLogin(); }}
              className="border border-gray-300 p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-black transition-all"
              placeholder="예: 전소정"
              disabled={loading}
            />
          </div>
          
          <button 
            onClick={handleLogin}
            disabled={loading}
            className={`w-full py-3 mt-2 rounded-xl font-bold text-white transition-all duration-200 ${
              loading 
                ? 'bg-blue-300 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg'
            }`}
          >
            {loading ? '데이터베이스 저장 중...' : '시작하기'}
          </button>
        </div>

        {/* 하단 푸터 */}
        <div className="mt-4 text-xs text-gray-400 text-center">
          © 2026 ktnetcore Gamification Project
        </div>
      </div>
    </main>
  );
}