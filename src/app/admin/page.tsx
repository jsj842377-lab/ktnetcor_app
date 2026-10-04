'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTheme } from '@/context/ThemeContext';

export default function AdminPage() {
  const router = useRouter();
  const { isDarkMode, toggleTheme } = useTheme();

  const [workers, setWorkers] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 직사각형 UI 및 다크모드 테마 색상 적용
  const theme = isDarkMode ? {
    bg: '#0f172a', cardBg: '#1e293b', textMain: '#f8fafc', textSub: '#94a3b8',
    border: '#334155', inputBg: '#0f172a', mdTableHead: '#334155', btnCancel: '#334155'
  } : {
    bg: '#f8fafc', cardBg: '#ffffff', textMain: '#0f172a', textSub: '#475569',
    border: '#cbd5e1', inputBg: '#f8fafc', mdTableHead: '#f1f5f9', btnCancel: '#e2e8f0'
  };

  useEffect(() => {
    const fetchAdminData = async () => {
      setLoading(true);

      // 1. 모든 작업자 정보 조회 (레벨 및 경험치 높은 순 정렬)
      const { data: workersData } = await supabase
        .from('workers')
        .select('*')
        .neq('worker_name', '작업자') // 유령 계정 제외
        .order('level', { ascending: false })
        .order('exp', { ascending: false });

      if (workersData) {
        // 이름 기준 중복 제거 (과거 버그로 생성된 중복 계정 찌꺼기 방지)
        const uniqueWorkers = Array.from(new Map(workersData.map(item => [item.worker_name, item])).values());
        setWorkers(uniqueWorkers);
      }

      // 2. 전체 점검 보고서 조회 (작업자 이름 매핑)
      const { data: reportsData } = await supabase
        .from('inspections')
        .select(`
          *,
          workers ( worker_name, level )
        `)
        .order('created_at', { ascending: false });

      if (reportsData) setReports(reportsData);
      setLoading(false);
    };

    fetchAdminData();
  }, []);

  const mdComps = {
    table: (props: any) => <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', border: `1px solid ${theme.border}` }} {...props} /></div>,
    th: (props: any) => <th style={{ border: `1px solid ${theme.border}`, background: theme.mdTableHead, padding: '10px', textAlign: 'center', fontSize: '13px', color: theme.textMain }} {...props} />,
    td: (props: any) => <td style={{ border: `1px solid ${theme.border}`, padding: '10px', fontSize: '13px', textAlign: 'center', color: theme.textMain }} {...props} />,
  };

  if (loading) return <div style={{ padding: '60px', textAlign: 'center', fontFamily: "'Pretendard', sans-serif" }}>관리자 데이터를 불러오는 중입니다...</div>;

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px', fontFamily: "'Pretendard', sans-serif" }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ margin: 0, color: theme.textMain, fontSize: '24px' }}>🛡️ 시스템 관리자 대시보드</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={toggleTheme} style={{ padding: '10px 16px', background: theme.btnCancel, color: theme.textMain, border: 'none', borderRadius: '0', cursor: 'pointer', fontWeight: 'bold' }}>
            {isDarkMode ? '☀️ 라이트 모드' : '🌙 다크 모드'}
          </button>
          <button onClick={() => router.push('/')} style={{ padding: '10px 16px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '0', cursor: 'pointer', fontWeight: 'bold' }}>
            메인으로
          </button>
        </div>
      </div>

      {/* 작업자 레벨 리더보드 */}
      <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: '0', padding: '20px', marginBottom: '32px' }}>
        <h2 style={{ margin: '0 0 16px 0', color: theme.textMain, fontSize: '18px' }}>🏆 작업자 레벨 현황</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ border: `1px solid ${theme.border}`, background: theme.mdTableHead, padding: '12px', color: theme.textMain }}>순위</th>
                <th style={{ border: `1px solid ${theme.border}`, background: theme.mdTableHead, padding: '12px', color: theme.textMain }}>작업자 성명</th>
                <th style={{ border: `1px solid ${theme.border}`, background: theme.mdTableHead, padding: '12px', color: theme.textMain }}>현재 레벨</th>
                <th style={{ border: `1px solid ${theme.border}`, background: theme.mdTableHead, padding: '12px', color: theme.textMain }}>누적 경험치(EXP)</th>
              </tr>
            </thead>
            <tbody>
              {workers.map((w, idx) => (
                <tr key={w.id} style={{ background: idx === 0 ? 'rgba(250, 204, 21, 0.1)' : 'transparent' }}>
                  <td style={{ border: `1px solid ${theme.border}`, padding: '12px', textAlign: 'center', color: theme.textMain, fontWeight: 'bold' }}>{idx + 1}위</td>
                  <td style={{ border: `1px solid ${theme.border}`, padding: '12px', textAlign: 'center', color: theme.textMain, fontWeight: 'bold' }}>{w.worker_name}</td>
                  <td style={{ border: `1px solid ${theme.border}`, padding: '12px', textAlign: 'center', color: '#2563eb', fontWeight: 'bold' }}>Lv.{w.level}</td>
                  <td style={{ border: `1px solid ${theme.border}`, padding: '12px', textAlign: 'center', color: theme.textSub }}>{w.exp} EXP</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 전체 보고서 현황 */}
      <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: '0', padding: '20px' }}>
        <h2 style={{ margin: '0 0 16px 0', color: theme.textMain, fontSize: '18px' }}>📋 전체 현장 점검 기록 ({reports.length}건)</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
          {reports.map((report) => (
            <div key={report.id} style={{ border: `1px solid ${theme.border}`, padding: '16px', borderRadius: '0', background: theme.bg }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', borderBottom: `1px solid ${theme.border}`, paddingBottom: '8px' }}>
                <strong style={{ color: '#2563eb' }}>{report.workers?.worker_name} (Lv.{report.workers?.level})</strong>
                <span style={{ fontSize: '12px', color: theme.textSub }}>{new Date(report.created_at).toLocaleDateString()}</span>
              </div>
              <div style={{ maxHeight: '150px', overflowY: 'auto', fontSize: '13px' }}>
                <ReactMarkdown components={mdComps} remarkPlugins={[remarkGfm]}>{report.ai_report_text}</ReactMarkdown>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}