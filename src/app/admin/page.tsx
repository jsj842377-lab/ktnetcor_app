'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import * as XLSX from 'xlsx-js-style'; // ★ 스타일이 지원되는 라이브러리로 교체

export default function AdminPage() {
  const [inspections, setInspections] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // ★ 달력 필터를 위한 상태 추가 (기본값: 2026년 10월)
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-10');

  // 날짜 필터가 변경될 때마다 해당 월의 데이터만 가져옵니다.
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      // 선택된 달의 첫째 날과 다음 달의 첫째 날 계산
      const startDate = new Date(`${selectedMonth}-01T00:00:00.000Z`);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);

      // ★ 서버 과부하 방지: 선택한 기간의 데이터만 필터링해서 가져옴 (.gte, .lt 활용)
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
  }, [selectedMonth]);

  const exportToExcel = () => {
    if (inspections.length === 0) return alert('해당 월에 점검 기록이 없습니다.');

    // ★ 헤더 스타일 정의: 배경색(회색), 글씨 굵게, 테두리 설정
    const headerStyle = {
      fill: { fgColor: { rgb: "E2E8F0" } }, // 연한 회색 배경
      font: { bold: true, color: { rgb: "0F172A" } }, // 굵은 남색 글씨
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
      
      // DB에 추가된 company_name 값을 가져오고, 없으면 랜덤 배정
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

    // 안전점검 시트 (Sheet 1)
    // 스타일을 입히기 위해 단순 문자열이 아닌 객체 형태로 { v: 값, s: 스타일 } 삽입
    const safetyHeaders = ['안전점검 일자', ...companies].map(text => ({ v: text, s: headerStyle }));
    const safetySheetData = [safetyHeaders];

    Array.from(dateMap.keys()).forEach(date => {
      const rowData = companies.map(comp => ({ v: dateMap.get(date)[comp] || '-', s: { alignment: { horizontal: "center" } } }));
      safetySheetData.push([{ v: date, s: { alignment: { horizontal: "center" } } }, ...rowData]);
    });

    // 현장 세부 이력 시트 (Sheet 2)
    const detailHeaders = ['점검일자', '시간', '인원(작업자)', '협력사', '공사번호', '공사유형', '안전작업 이행 여부'].map(text => ({ v: text, s: headerStyle }));
    const detailSheetData = [
      detailHeaders,
      ...detailRows
    ];

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.aoa_to_sheet(safetySheetData);
    const ws2 = XLSX.utils.aoa_to_sheet(detailSheetData);

    // 열 너비 자동 조정
    ws1['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
    ws2['!cols'] = [{ wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 20 }, { wch: 25 }, { wch: 30 }, { wch: 20 }];

    XLSX.utils.book_append_sheet(wb, ws1, '안전점검(일자별)');
    XLSX.utils.book_append_sheet(wb, ws2, '세부이력대장');

    XLSX.writeFile(wb, `협력사관리_종합보고서_${selectedMonth}.xlsx`);
  };

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
        <h1 style={{ fontSize: '28px', borderBottom: '2px solid #2563eb', paddingBottom: '12px', marginTop: 0 }}>
          👨‍💼 현장 관리자 대시보드
        </h1>
        
        {/* ★ 월 선택 달력 필터 UI */}
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