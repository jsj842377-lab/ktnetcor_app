'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import * as XLSX from 'xlsx-js-style';

export default function AdminPage() {
  const [password, setPassword] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [inspections, setInspections] = useState<any[]>([]);
  
  const [loading, setLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  
  const [viewMode, setViewMode] = useState<'month' | 'quarter'>('month');
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-10');
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [selectedQuarter, setSelectedQuarter] = useState<number>(4);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'admin1234') {
      setIsAuthenticated(true);
    } else {
      alert('비밀번호가 일치하지 않습니다.');
      setPassword('');
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchData = async () => {
      setLoading(true);
      setProgress(10);
      
      let startDate: Date;
      let endDate: Date;

      if (viewMode === 'month') {
        startDate = new Date(`${selectedMonth}-01T00:00:00.000Z`);
        endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 1);
      } else {
        const startMonth = String((selectedQuarter - 1) * 3 + 1).padStart(2, '0');
        startDate = new Date(`${selectedYear}-${startMonth}-01T00:00:00.000Z`);
        endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 3);
      }
      setProgress(40);

      const { data, error } = await supabase
        .from('inspections')
        .select(`*, workers ( worker_name )`)
        .gte('created_at', startDate.toISOString())
        .lt('created_at', endDate.toISOString())
        .order('created_at', { ascending: true });
        
      setProgress(80);
      if (error) console.error(error);
      if (data) setInspections(data);
      
      setProgress(100);
      setTimeout(() => setLoading(false), 500);
    };

    fetchData();
  }, [viewMode, selectedMonth, selectedYear, selectedQuarter, isAuthenticated]);

  const exportToExcel = async () => {
    if (inspections.length === 0) return alert('기록이 없습니다.');
    setLoading(true);
    setProgress(20);
    await new Promise(r => setTimeout(r, 100)); 
    setProgress(50);

    const headerStyle = { fill: { fgColor: { rgb: "E2E8F0" } }, font: { bold: true }, alignment: { horizontal: "center", vertical: "center" }, border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } } };
    const centerStyle = { alignment: { horizontal: "center", vertical: "center" } };

    const companySet = new Set<string>();
    const dateMap = new Map();
    const monthMap = new Map();
    const detailRows: any[] = [];

    const extractMatch = (text: string, key: string) => (text.match(new RegExp(`\\|\\s*\\*\\*${key}\\*\\*\\s*\\|\\s*([^\\|]+)\\s*\\|`)) || [])[1]?.trim() || '';

    inspections.forEach((item) => {
      const d = new Date(item.created_at);
      const yyyyMmDd = d.toISOString().slice(0, 10);
      const yyyyMm = `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
      const txt = item.ai_report_text || '';
      const pNum = extractMatch(txt, '공사번호') || '미분류';
      const cName = pNum.split('-')[0] || '미상'; 
      const isDgr = txt.includes('불량') ? 'X' : 'O';

      companySet.add(cName);
      if (!dateMap.has(yyyyMmDd)) dateMap.set(yyyyMmDd, {});
      dateMap.get(yyyyMmDd)[cName] = isDgr === 'X' ? '△' : 'O';
      if (!monthMap.has(yyyyMm)) monthMap.set(yyyyMm, {});
      monthMap.get(yyyyMm)[cName] = 'O';

      detailRows.push([
        { v: yyyyMmDd, s: centerStyle }, { v: d.getHours() < 12 ? '오전' : '오후', s: centerStyle }, 
        { v: item.workers?.worker_name || '알수없음', s: centerStyle }, { v: cName, s: centerStyle }, 
        { v: pNum, s: centerStyle }, { v: extractMatch(txt, '작업공정'), s: centerStyle }, { v: isDgr, s: centerStyle }
      ]);
    });

    setProgress(80);
    await new Promise(r => setTimeout(r, 100)); 

    const comps = Array.from(companySet);
    const hds = ['', ...comps].map(t => ({ v: t, s: headerStyle }));
    
    const s1Data: any[][] = [[{ v: '자재 실사', s: { font: { bold: true } } }], hds];
    Array.from(monthMap.keys()).forEach(m => s1Data.push([{ v: m, s: centerStyle }, ...comps.map(c => ({ v: monthMap.get(m)[c] || '-', s: centerStyle }))]));
    s1Data.push([], [{ v: '안전점검', s: { font: { bold: true } } }], hds);
    Array.from(dateMap.keys()).forEach(d => s1Data.push([{ v: d, s: centerStyle }, ...comps.map(c => ({ v: dateMap.get(d)[c] || '-', s: centerStyle }))]));

    const s2Data = [['점검일자', '시간', '인원', '협력사', '공사번호', '공사유형', '안전작업 이행 여부'].map(t => ({ v: t, s: headerStyle })), ...detailRows];

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.aoa_to_sheet(s1Data);
    const ws2 = XLSX.utils.aoa_to_sheet(s2Data);
    ws1['!cols'] = [{ wch: 15 }, ...comps.map(() => ({ wch: 15 }))];
    ws2['!cols'] = [{ wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 20 }, { wch: 20 }];

    const prefix = viewMode === 'month' ? selectedMonth : `${selectedYear}년_${selectedQuarter}분기`;
    XLSX.utils.book_append_sheet(wb, ws1, `${prefix}_협력사관리`.substring(0, 31));
    XLSX.utils.book_append_sheet(wb, ws2, `${prefix}_세부이력`.substring(0, 31));

    XLSX.writeFile(wb, `안전점검_${prefix}.xlsx`);
    setProgress(100);
    setTimeout(() => setLoading(false), 500);
  };

  if (!isAuthenticated) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f8fafc' }}>
      <form onSubmit={handleLogin} style={{ background: 'white', padding: '40px', borderRadius: '16px', textAlign: 'center' }}>
        <h2>관리자 로그인</h2>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ padding: '10px', marginBottom: '10px', width: '100%', boxSizing: 'border-box' }} autoFocus />
        <button type="submit" style={{ padding: '10px', width: '100%', background: '#2563eb', color: 'white', border: 'none' }}>접속</button>
      </form>
    </div>
  );

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', background: '#f8fafc', minHeight: '100vh' }}>
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

      <div style={{ background: 'white', padding: '30px', borderRadius: '16px' }}>
        <h1>👨‍💼 대시보드</h1>
        <div style={{ display: 'flex', gap: '10px', margin: '20px 0' }}>
          <button onClick={() => setViewMode('month')} style={{ flex: 1, padding: '10px', background: viewMode === 'month' ? '#2563eb' : '#fff', color: viewMode === 'month' ? '#fff' : '#000' }}>월별 조회</button>
          <button onClick={() => setViewMode('quarter')} style={{ flex: 1, padding: '10px', background: viewMode === 'quarter' ? '#2563eb' : '#fff', color: viewMode === 'quarter' ? '#fff' : '#000' }}>분기별 조회</button>
        </div>
        
        <div style={{ background: '#f1f5f9', padding: '20px', borderRadius: '12px' }}>
          {viewMode === 'month' ? (
            <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} style={{ padding: '10px' }} />
          ) : (
            <>
              <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} style={{ padding: '10px', marginRight: '10px' }}>
                <option value="2025">2025년</option><option value="2026">2026년</option><option value="2027">2027년</option>
              </select>
              <select value={selectedQuarter} onChange={e => setSelectedQuarter(Number(e.target.value))} style={{ padding: '10px' }}>
                <option value={1}>1분기</option><option value={2}>2분기</option><option value={3}>3분기</option><option value={4}>4분기</option>
              </select>
            </>
          )}
        </div>

        <button onClick={exportToExcel} style={{ width: '100%', padding: '15px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', marginTop: '20px', fontSize: '16px', fontWeight: 'bold' }}>
          엑셀 다운로드 (총 {inspections.length}건)
        </button>
      </div>
    </div>
  );
}