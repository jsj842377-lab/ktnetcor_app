'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import * as XLSX from 'xlsx-js-style';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const router = useRouter();
  const [inspections, setInspections] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  
  // 탭 상태 추가 (dashboard, tips, settings)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'tips' | 'settings'>('dashboard');

  const [viewMode, setViewMode] = useState<'month' | 'quarter'>('month');
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-10');
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [selectedQuarter, setSelectedQuarter] = useState<number>(4);

  const [tips, setTips] = useState<any[]>([]);
  const [newTip, setNewTip] = useState<string>('');

  // 비밀번호 변경용 상태
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');

  const fetchTips = async () => {
    const { data } = await supabase.from('safety_tips').select('*').order('created_at', { ascending: false });
    if (data) setTips(data);
  };

  const handleAddTip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTip.trim()) return;
    await supabase.from('safety_tips').insert([{ content: newTip, is_active: true }]);
    setNewTip(''); fetchTips();
  };

  const toggleTipActive = async (id: number, currentStatus: boolean) => {
    await supabase.from('safety_tips').update({ is_active: !currentStatus }).eq('id', id);
    fetchTips();
  };

  const deleteTip = async (id: number) => {
    if(window.confirm('완전히 삭제하시겠습니까?')) {
      await supabase.from('safety_tips').delete().eq('id', id);
      fetchTips();
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPwd || !newPwd) return alert('모두 입력해주세요.');
    const { data } = await supabase.from('workers').select('password').eq('worker_name', '전현진').single();
    if (data?.password !== oldPwd) return alert('현재 비밀번호가 틀립니다.');
    
    await supabase.from('workers').update({ password: newPwd }).eq('worker_name', '전현진');
    alert('비밀번호가 성공적으로 변경되었습니다.');
    setOldPwd(''); setNewPwd('');
  };

  useEffect(() => {
    if (activeTab === 'tips') { fetchTips(); return; }
    if (activeTab === 'settings') return;

    const fetchData = async () => {
      setLoading(true); setProgress(10);
      let startDate: Date, endDate: Date;
      if (viewMode === 'month') {
        startDate = new Date(`${selectedMonth}-01T00:00:00.000Z`);
        endDate = new Date(startDate); endDate.setMonth(endDate.getMonth() + 1);
      } else {
        const startMonth = String((selectedQuarter - 1) * 3 + 1).padStart(2, '0');
        startDate = new Date(`${selectedYear}-${startMonth}-01T00:00:00.000Z`);
        endDate = new Date(startDate); endDate.setMonth(endDate.getMonth() + 3);
      }
      setProgress(40);
      const { data } = await supabase.from('inspections').select(`*, workers ( worker_name )`).gte('created_at', startDate.toISOString()).lt('created_at', endDate.toISOString()).order('created_at', { ascending: true });
      setProgress(80);
      if (data) setInspections(data);
      setProgress(100); setTimeout(() => setLoading(false), 500);
    };
    fetchData();
  }, [viewMode, selectedMonth, selectedYear, selectedQuarter, activeTab]);

  const exportToExcel = async () => { /* 기존 엑셀 추출 로직 동일 (분량상 생략 없이 유지 필요하나, 핵심 기능이므로 유지) */
    if (inspections.length === 0) return alert('기록이 없습니다.');
    setLoading(true); setProgress(20); await new Promise(r => setTimeout(r, 100)); setProgress(50);
    const headerStyle = { fill: { fgColor: { rgb: "E2E8F0" } }, font: { name: 'Pretendard', bold: true }, alignment: { horizontal: "center", vertical: "center" }, border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } } };
    const centerStyle = { font: { name: 'Pretendard' }, alignment: { horizontal: "center", vertical: "center" } };
    const companySet = new Set<string>(); const dateMap = new Map(); const monthMap = new Map(); const detailRows: any[] = [];
    const extractMatch = (text: string, key: string) => (text.match(new RegExp(`\\|\\s*\\*\\*${key}\\*\\*\\s*\\|\\s*([^\\|]+)\\s*\\|`)) || [])[1]?.trim() || '';

    inspections.forEach((item) => {
      const d = new Date(item.created_at); const yyyyMmDd = d.toISOString().slice(0, 10); const yyyyMm = `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
      const txt = item.ai_report_text || ''; const pNum = extractMatch(txt, '공사번호') || '미분류'; const cName = pNum.split('-')[0] || '미상'; const isDgr = txt.includes('불량') ? 'X' : 'O';
      companySet.add(cName); if (!dateMap.has(yyyyMmDd)) dateMap.set(yyyyMmDd, {}); dateMap.get(yyyyMmDd)[cName] = isDgr === 'X' ? '△' : 'O';
      if (!monthMap.has(yyyyMm)) monthMap.set(yyyyMm, {}); monthMap.get(yyyyMm)[cName] = 'O';
      detailRows.push([{ v: yyyyMmDd, s: centerStyle }, { v: d.getHours() < 12 ? '오전' : '오후', s: centerStyle }, { v: item.workers?.worker_name || '알수없음', s: centerStyle }, { v: cName, s: centerStyle }, { v: pNum, s: centerStyle }, { v: extractMatch(txt, '작업공정'), s: centerStyle }, { v: isDgr, s: centerStyle }]);
    });
    setProgress(80); await new Promise(r => setTimeout(r, 100)); 
    const comps = Array.from(companySet); const hds = ['', ...comps].map(t => ({ v: t, s: headerStyle }));
    const s1Data: any[][] = [[{ v: '자재 실사', s: { font: { name: 'Pretendard', bold: true } } }], hds];
    Array.from(monthMap.keys()).forEach(m => s1Data.push([{ v: m, s: centerStyle }, ...comps.map(c => ({ v: monthMap.get(m)[c] || '-', s: centerStyle }))]));
    s1Data.push([], [{ v: '안전점검', s: { font: { name: 'Pretendard', bold: true } } }], hds);
    Array.from(dateMap.keys()).forEach(d => s1Data.push([{ v: d, s: centerStyle }, ...comps.map(c => ({ v: dateMap.get(d)[c] || '-', s: centerStyle }))]));
    const s2Data = [['점검일자', '시간', '인원', '협력사', '공사번호', '공사유형', '안전작업 이행 여부'].map(t => ({ v: t, s: headerStyle })), ...detailRows];
    const wb = XLSX.utils.book_new(); const ws1 = XLSX.utils.aoa_to_sheet(s1Data); const ws2 = XLSX.utils.aoa_to_sheet(s2Data);
    ws1['!cols'] = [{ wch: 15 }, ...comps.map(() => ({ wch: 15 }))]; ws2['!cols'] = [{ wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 20 }, { wch: 20 }];
    const prefix = viewMode === 'month' ? selectedMonth : `${selectedYear}년_${selectedQuarter}분기`;
    XLSX.utils.book_append_sheet(wb, ws1, `${prefix}_협력사관리`.substring(0, 31)); XLSX.utils.book_append_sheet(wb, ws2, `${prefix}_세부이력`.substring(0, 31));
    XLSX.writeFile(wb, `안전점검_${prefix}.xlsx`);
    setProgress(100); setTimeout(() => setLoading(false), 500);
  };

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', background: '#f8fafc', minHeight: '100vh', fontFamily: "'Pretendard', sans-serif" }}>
      {loading && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', padding: '30px', borderRadius: '16px', textAlign: 'center', width: '300px' }}>
            <h3>데이터 처리 중...</h3>
            <div style={{ background: '#e2e8f0', borderRadius: '8px', height: '16px', marginTop: '10px' }}>
              <div style={{ width: `${progress}%`, background: '#2563eb', height: '100%', transition: 'width 0.3s' }} />
            </div>
            <p>{progress}%</p>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ margin: 0 }}>👨‍💼 관리자 대시보드</h1>
        <button onClick={() => router.push('/')} style={{ padding: '8px 16px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>로그아웃</button>
      </div>
      
      <div style={{ background: 'white', padding: '30px', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', marginBottom: '20px' }}>
          <button onClick={() => setActiveTab('dashboard')} style={{ padding: '12px 24px', background: 'none', border: 'none', borderBottom: activeTab === 'dashboard' ? '3px solid #2563eb' : 'none', fontWeight: activeTab === 'dashboard' ? 'bold' : 'normal', color: activeTab === 'dashboard' ? '#2563eb' : '#64748b', cursor: 'pointer', fontSize: '16px' }}>보고서 추출</button>
          <button onClick={() => setActiveTab('tips')} style={{ padding: '12px 24px', background: 'none', border: 'none', borderBottom: activeTab === 'tips' ? '3px solid #2563eb' : 'none', fontWeight: activeTab === 'tips' ? 'bold' : 'normal', color: activeTab === 'tips' ? '#2563eb' : '#64748b', cursor: 'pointer', fontSize: '16px' }}>명언 관리</button>
          <button onClick={() => setActiveTab('settings')} style={{ padding: '12px 24px', background: 'none', border: 'none', borderBottom: activeTab === 'settings' ? '3px solid #2563eb' : 'none', fontWeight: activeTab === 'settings' ? 'bold' : 'normal', color: activeTab === 'settings' ? '#2563eb' : '#64748b', cursor: 'pointer', fontSize: '16px' }}>설정 (비밀번호)</button>
        </div>

        {activeTab === 'dashboard' && (
          <>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <button onClick={() => setViewMode('month')} style={{ flex: 1, padding: '10px', background: viewMode === 'month' ? '#2563eb' : '#f8fafc', color: viewMode === 'month' ? '#fff' : '#000', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer' }}>월별 조회</button>
              <button onClick={() => setViewMode('quarter')} style={{ flex: 1, padding: '10px', background: viewMode === 'quarter' ? '#2563eb' : '#f8fafc', color: viewMode === 'quarter' ? '#fff' : '#000', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer' }}>분기별 조회</button>
            </div>
            <div style={{ background: '#f1f5f9', padding: '20px', borderRadius: '12px' }}>
              {viewMode === 'month' ? (
                <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
              ) : (
                <>
                  <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} style={{ padding: '10px', marginRight: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                    <option value="2025">2025년</option><option value="2026">2026년</option><option value="2027">2027년</option>
                  </select>
                  <select value={selectedQuarter} onChange={e => setSelectedQuarter(Number(e.target.value))} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                    <option value={1}>1분기</option><option value={2}>2분기</option><option value={3}>3분기</option><option value={4}>4분기</option>
                  </select>
                </>
              )}
            </div>
            <button onClick={exportToExcel} style={{ width: '100%', padding: '15px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', marginTop: '20px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>엑셀 다운로드 (총 {inspections.length}건)</button>
          </>
        )}

        {activeTab === 'tips' && (
          <>
            <form onSubmit={handleAddTip} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <input type="text" value={newTip} onChange={e => setNewTip(e.target.value)} placeholder="새로운 안전 명언 입력" style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
              <button type="submit" style={{ padding: '0 20px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>추가하기</button>
            </form>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {tips.map(tip => (
                <div key={tip.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: tip.is_active ? '#f8fafc' : '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '8px', opacity: tip.is_active ? 1 : 0.5 }}>
                  <span style={{ fontSize: '15px', color: '#1e293b' }}>{tip.content}</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => toggleTipActive(tip.id, tip.is_active)} style={{ padding: '8px 12px', background: tip.is_active ? '#eab308' : '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>{tip.is_active ? '숨기기' : '노출하기'}</button>
                    <button onClick={() => deleteTip(tip.id)} style={{ padding: '8px 12px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>삭제</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === 'settings' && (
          <form onSubmit={handleChangePassword} style={{ background: '#f8fafc', padding: '30px', borderRadius: '12px' }}>
            <h3 style={{ margin: '0 0 20px 0' }}>관리자 비밀번호 변경</h3>
            <input type="password" placeholder="현재 비밀번호" value={oldPwd} onChange={e => setOldPwd(e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
            <input type="password" placeholder="새 비밀번호" value={newPwd} onChange={e => setNewPwd(e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '20px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
            <button type="submit" style={{ width: '100%', padding: '12px', background: '#0f172a', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>비밀번호 변경 저장</button>
          </form>
        )}
      </div>
    </div>
  );
}