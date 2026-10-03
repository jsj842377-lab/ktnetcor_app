'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import * as XLSX from 'xlsx-js-style';

export default function AdminPage() {
  // ★ 비밀번호 인증을 위한 상태 추가
  const [password, setPassword] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  const [inspections, setInspections] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-10');

  // ★ 관리자 로그인 처리 함수
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault(); // 폼 제출 시 새로고침 방지
    // 원하는 관리자 비밀번호로 변경하세요 (현재: admin1234)
    if (password === 'admin1234') {
      setIsAuthenticated(true);
    } else {
      alert('비밀번호가 일치하지 않습니다.');
      setPassword('');
    }
  };

  // 로그인에 성공(isAuthenticated === true)했을 때만 DB에서 데이터를 불러옵니다.
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchData = async () => {
      setLoading(true);
      
      const startDate = new Date(`${selectedMonth}-01T00:00:00.000Z`);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);

      const { data, error } = await supabase
        .from('inspections')
        .select(`
          *,
          workers ( worker_name, company_name ) 
        `)
        .gte('created_at', startDate.toISOString())
        .lt('created_at', endDate.toISOString())
        .order('created_at', { ascending: true });
        
      if (data) setInspections(data);
      setLoading(false);
    };

    fetchData();
  }, [selectedMonth, isAuthenticated]);

  const exportToExcel = () => {
    if (inspections.length === 0) return alert('해당 월에 점검 기록이 없습니다.');

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

    const companies = ['남두(안산)', '동양(동안산,시흥)', '득진(시화,대부)', '동산(안양)', '대경(군포)', '득진(부천)', '세하(부평)'];
    
    const dateMap = new Map();
    const detailRows: any[] = [];

    inspections.forEach((item, index) => {
      const dateObj = new Date(item.created_at);
      const yyyyMmDd = dateObj.toISOString().slice(0, 10);
      
      const workerName = item.workers?.worker_name || '알수없음';
      const companyName = item.workers?.company_name || companies[index % companies.length];
      
      if (!dateMap.has(yyyyMmDd)) dateMap.set(yyyyMmDd, {});
      dateMap.get(yyyyMmDd)[companyName] = 'O';

      const amPm = dateObj.getHours() < 12 ? '오전' : '오후';
      const aiText = item.ai_report_text || '';
      const isDanger = aiText.includes('위험') ? 'X' : 'O';
      
      detailRows.push([
        { v: yyyyMmDd }, { v: amPm }, { v: workerName }, { v: companyName }, 
        { v: `설비-2026-${String(index + 1).padStart(4, '0')}` }, { v: '광케이블 포설 및 안전점검' }, { v: isDanger, s: { alignment: { horizontal: "center" } } }
      ]);
    });

    const safetyHeaders = ['안전점검 일자', ...companies].map(text => ({ v: text, s: headerStyle }));
    const safetySheetData = [safetyHeaders];

    Array.from(dateMap.keys()).forEach(date => {
      const rowData = companies.map(comp => ({ v: dateMap.get(date)[comp] || '-', s: { alignment: { horizontal: "center" } } }));
      safetySheetData.push([{ v: date, s: { alignment: { horizontal: "center" } } }, ...rowData]);
    });

    const detailHeaders = ['점검일자', '시간', '인원(작업자)', '협력사', '공사번호', '공사유형', '안전작업 이행 여부'].map(text => ({ v: text, s: headerStyle }));
    const detailSheetData = [detailHeaders, ...detailRows];

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.aoa_to_sheet(safetySheetData);
    const ws2 = XLSX.utils.aoa_to_sheet(detailSheetData);

    ws1['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
    ws2['!cols'] = [{ wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 20 }, { wch: 25 }, { wch: 30 }, { wch: 20 }];

    XLSX.utils.book_append_sheet(wb, ws1, '안전점검(일자별)');
    XLSX.utils.book_append_sheet(wb, ws2, '세부이력대장');

    XLSX.writeFile(wb, `협력사관리_종합보고서_${selectedMonth}.xlsx`);
  };

  // ★ 인증되지 않았을 때 보여줄 로그인 화면 UI
  if (!isAuthenticated) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#f8fafc', padding: '20px' }}>
        <form onSubmit={handleLogin} style={{ backgroundColor: 'white', padding: '40px', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
          <h2 style={{ margin: '0 0 24px 0', color: '#0f172a', fontSize: '20px' }}>관리자 권한이 필요합니다</h2>
          <input 
            type="password" 
            placeholder="비밀번호를 입력하세요" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', padding: '14px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '16px', fontSize: '16px', boxSizing: 'border-box', outline: 'none' }}
            autoFocus
          />
          <button type="submit" style={{ width: '100%', padding: '14px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>
            접속하기
          </button>
        </form>
      </div>
    );
  }

  // 인증 성공 시 보여줄 기존 대시보드 UI
  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
        <h1 style={{ fontSize: '28px', borderBottom: '2px solid #2563eb', paddingBottom: '12px', marginTop: 0 }}>
          👨‍💼 현장 관리자 대시보드
        </h1>
        
        <div style={{ marginTop: '24px', padding: '20px', backgroundColor: '#f1f5f9', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <label style={{ fontWeight: 'bold', color: '#1e293b' }}>📅 조회 월 선택 :</label>
          <input 
            type="month" 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '16px', outline: 'none' }}
          />
        </div>

        <p style={{ color: '#475569', marginTop: '20px', lineHeight: '1.6' }}>
          <strong>{selectedMonth}</strong>에 해당하는 <strong>총 {inspections.length}건</strong>의 데이터를 스캔했습니다. 
          <br/>추출된 데이터를 기반으로 협력사별 이행 여부 및 세부 작업 내역이 포함된 규격화된 엑셀(.xlsx) 종합 보고서를 생성합니다.
        </p>
        
        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>데이터를 불러오는 중입니다...</div>
        ) : (
          <button 
            onClick={exportToExcel}
            style={{ marginTop: '20px', width: '100%', padding: '16px', background: '#10b981', color: 'white', fontSize: '18px', fontWeight: 'bold', border: 'none', borderRadius: '12px', cursor: 'pointer', transition: 'background-color 0.2s' }}
          >
            📊 {selectedMonth} 협력사 종합 관리 엑셀 다운로드
          </button>
        )}
      </div>
    </div>
  );
}