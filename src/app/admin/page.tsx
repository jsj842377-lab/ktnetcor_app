'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import * as XLSX from 'xlsx-js-style';

export default function AdminPage() {
  const [password, setPassword] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [inspections, setInspections] = useState<any[]>([]);
  
  // ★ 상태 추가: 데이터 로딩 및 프로그레스 바 상태
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
      setProgress(10); // 데이터 패칭 시작
      
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

      setProgress(40); // 조건 설정 완료

      const { data, error } = await supabase
        .from('inspections')
        .select(`*, workers ( worker_name )`)
        .gte('created_at', startDate.toISOString())
        .lt('created_at', endDate.toISOString())
        .order('created_at', { ascending: true });
        
      setProgress(80); // 데이터 수신 완료
      
      if (error) console.error('DB 불러오기 에러:', error);
      if (data) setInspections(data);
      
      setProgress(100);
      setTimeout(() => setLoading(false), 500); // 0.5초 대기 후 로딩 상태 해제
    };

    fetchData();
  }, [viewMode, selectedMonth, selectedYear, selectedQuarter, isAuthenticated]);

  const extractFromMarkdown = (text: string, key: string) => {
    const regex = new RegExp(`\\|\\s*\\*\\*${key}\\*\\*\\s*\\|\\s*([^\\|]+)\\s*\\|`);
    const match = text.match(regex);
    return match ? match[1].trim() : '';
  };

  const exportToExcel = async () => {
    if (inspections.length === 0) return alert('조회된 점검 기록이 없습니다.');

    setLoading(true);
    setProgress(20);

    // 대용량 처리를 위해 메인 스레드 블로킹을 방지(UI 렌더링 양보)하는 비동기 지연
    await new Promise(resolve => setTimeout(resolve, 100)); 
    setProgress(50);

    const headerStyle = {
      fill: { fgColor: { rgb: "E2E8F0" } },
      font: { bold: true, color: { rgb: "0F172A" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "thin", color: { rgb: "CBD5E1" } },
        bottom: { style: "thin", color: { rgb: "CBD5E1" } },
        left: { style: "thin", color: { rgb: "CBD5E1" } },
        right: { style: "thin", color: { rgb: "CBD5E1" } }
      }
    };
    const centerStyle = { alignment: { horizontal: "center", vertical: "center" } };

    const companySet = new Set<string>();
    const dateMap = new Map();
    const monthMap = new Map();
    const detailRows: any[] = [];

    inspections.forEach((item) => {
      const dateObj = new Date(item.created_at);
      const yyyyMmDd = dateObj.toISOString().slice(0, 10);
      const yyyyMm = `${dateObj.getFullYear()}년 ${dateObj.getMonth() + 1}월`;
      const amPm = dateObj.getHours() < 12 ? '오전' : '오후';
      
      const aiText = item.ai_report_text || '';
      const projectNumber = extractFromMarkdown(aiText, '공사번호') || '미분류-0000';
      const companyName = projectNumber.split('-')[0] || '미상'; 
      const workType = extractFromMarkdown(aiText, '작업공정') || '일반작업';
      const workerName = item.workers?.worker_name || '알수없음';
      const isDanger = aiText.includes('불량') ? 'X' : 'O';

      companySet.add(companyName);
      if (!dateMap.has(yyyyMmDd)) dateMap.set(yyyyMmDd, {});
      dateMap.get(yyyyMmDd)[companyName] = isDanger === 'X' ? '△' : 'O';

      if (!monthMap.has(yyyyMm)) monthMap.set(yyyyMm, {});
      monthMap.get(yyyyMm)[companyName] = 'O';

      detailRows.push([
        { v: yyyyMmDd, s: centerStyle }, { v: amPm, s: centerStyle }, 
        { v: workerName, s: centerStyle }, { v: companyName, s: centerStyle }, 
        { v: projectNumber, s: centerStyle }, { v: workType, s: centerStyle }, 
        { v: isDanger, s: centerStyle }
      ]);
    });

    setProgress(80);
    await new Promise(resolve => setTimeout(resolve, 100)); 

    const companies = Array.from(companySet);
    const crossTabHeaders = ['', ...companies].map(text => ({ v: text, s: headerStyle }));
    
    const crossTabSheetData: any[][] = [[{ v: '자재 실사', s: { font: { bold: true } } }], crossTabHeaders];
    Array.from(monthMap.keys()).forEach(month => {
      const rowData = companies.map(comp => ({ v: monthMap.get(month)[comp] || '-', s: centerStyle }));
      crossTabSheetData.push([{ v: month, s: centerStyle }, ...rowData]);
    });
    crossTabSheetData.push([]); 
    crossTabSheetData.push([{ v: '안전점검', s: { font: { bold: true } } }]);
    crossTabSheetData.push(crossTabHeaders);
    Array.from(dateMap.keys()).forEach(date => {
      const rowData = companies.map(comp => ({ v: dateMap.get(date)[comp] || '-', s: centerStyle }));
      crossTabSheetData.push([{ v: date, s: centerStyle }, ...rowData]);
    });

    const detailHeaders = ['점검일자', '시간', '인원', '협력사', '공사번호', '공사유형', '안전작업 이행 여부'].map(text => ({ v: text, s: headerStyle }));
    const detailSheetData = [detailHeaders, ...detailRows];

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.aoa_to_sheet(crossTabSheetData);
    const ws2 = XLSX.utils.aoa_to_sheet(detailSheetData);

    ws1['!cols'] = [{ wch: 15 }, ...companies.map(() => ({ wch: 15 }))];
    ws2['!cols'] = [{ wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 20 }, { wch: 20 }];

    // ★ 수정: 시트 이름을 동적으로 생성
    const timePrefix = viewMode === 'month' ? selectedMonth : `${selectedYear}년_${selectedQuarter}분기`;
    const sheetName1 = `${timePrefix}_협력사관리`.substring(0, 31); // 엑셀 시트명은 31자 제한
    const sheetName2 = `${timePrefix}_세부이력`.substring(0, 31);

    XLSX.utils.book_append_sheet(wb, ws1, sheetName1);
    XLSX.utils.book_append_sheet(wb, ws2, sheetName2);

    const exportFileName = `안전점검_종합결과물_${timePrefix}.xlsx`;
    XLSX.writeFile(wb, exportFileName);

    setProgress(100);
    setTimeout(() => setLoading(false), 500);
  };

  if (!isAuthenticated) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#f8fafc', padding: '20px' }}>
        <form onSubmit={handleLogin} style={{ backgroundColor: 'white', padding: '40px', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
          <h2 style={{ margin: '0 0 24px 0', color: '#0f172a', fontSize: '20px' }}>관리자 권한이 필요합니다</h2>
          <input type="password" placeholder="비밀번호를 입력하세요" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: '100%', padding: '14px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '16px', fontSize: '16px', boxSizing: 'border-box', outline: 'none' }} autoFocus />
          <button type="submit" style={{ width: '100%', padding: '14px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>접속하기</button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh', position: 'relative' }}>
      
      {/* ★ 프로그레스 바 오버레이 UI */}
      {loading && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '80%', maxWidth: '400px', background: 'white', padding: '30px', borderRadius: '16px', textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 20px 0', color: '#1e293b' }}>데이터 처리 중...</h3>
            <div style={{ width: '100%', height: '16px', background: '#e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ width: `${progress}%`, height: '100%', background: '#2563eb', transition: 'width 0.3s ease' }} />
            </div>
            <p style={{ marginTop: '12px', fontSize: '14px', color: '#64748b', fontWeight: 'bold' }}>{progress}% 진행됨</p>
          </div>
        </div>
      )}

      <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
        <h1 style={{ fontSize: '28px', borderBottom: '2px solid #2563eb', paddingBottom: '12px', marginTop: 0 }}>👨‍💼 현장 관리자 대시보드</h1>
        
        <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
          <button onClick={() => setViewMode('month')} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: viewMode === 'month' ? '#2563eb' : '#f8fafc', color: viewMode === 'month' ? 'white' : '#475569', fontWeight: 'bold', cursor: 'pointer' }}>월별 조회</button>
          <button onClick={() => setViewMode('quarter')} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: viewMode === 'quarter' ? '#2563eb' : '#f8fafc', color: viewMode === 'quarter' ? 'white' : '#475569', fontWeight: 'bold', cursor: 'pointer' }}>분기별 조회</button>
        </div>

        <div style={{ marginTop: '20px', padding: '20px', backgroundColor: '#f1f5f9', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          {viewMode === 'month' ? (
            <>
              <label style={{ fontWeight: 'bold', color: '#1e293b' }}>📅 조회 월 선택 :</label>
              <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '16px', outline: 'none' }} />
            </>
          ) : (
            <>
              <label style={{ fontWeight: 'bold', color: '#1e293b' }}>📅 조회 분기 선택 :</label>
              <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '16px', outline: 'none' }}>
                <option value="2025">2025년</option>
                <option value="2026">2026년</option>
                <option value="2027">2027년</option>
              </select>
              <select value={selectedQuarter} onChange={(e) => setSelectedQuarter(Number(e.target.value))} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '16px', outline: 'none' }}>
                <option value={1}>1분기 (1~3월)</option>
                <option value={2}>2분기 (4~6월)</option>
                <option value={3}>3분기 (7~9월)</option>
                <option value={4}>4분기 (10~12월)</option>
              </select>
            </>
          )}
        </div>

        <p style={{ color: '#475569', marginTop: '20px', lineHeight: '1.6' }}>
          <strong>{viewMode === 'month' ? selectedMonth : `${selectedYear}년 ${selectedQuarter}분기`}</strong> 기간에 해당하는 <strong>총 {inspections.length}건</strong>의 데이터를 스캔했습니다. 
        </p>
        
        <button 
          onClick={exportToExcel}
          disabled={loading || inspections.length === 0}
          style={{ marginTop: '20px', width: '100%', padding: '16px', background: inspections.length === 0 ? '#94a3b8' : '#10b981', color: 'white', fontSize: '18px', fontWeight: 'bold', border: 'none', borderRadius: '12px', cursor: inspections.length === 0 ? 'not-allowed' : 'pointer', transition: 'background-color 0.2s' }}
        >
          📊 엑셀 결과물 다운로드
        </button>
      </div>
    </div>
  );
}