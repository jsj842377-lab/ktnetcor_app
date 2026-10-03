'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import * as XLSX from 'xlsx-js-style';

export default function AdminPage() {
  const [password, setPassword] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [inspections, setInspections] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-10');

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
      const startDate = new Date(`${selectedMonth}-01T00:00:00.000Z`);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);

      const { data, error } = await supabase
        .from('inspections')
        .select(`
          *,
          workers ( worker_name ) 
        `)
        .gte('created_at', startDate.toISOString())
        .lt('created_at', endDate.toISOString())
        .order('created_at', { ascending: true });
        
      if (data) setInspections(data);
      setLoading(false);
    };

    fetchData();
  }, [selectedMonth, isAuthenticated]);

  // 마크다운 표에서 특정 항목의 내용을 파싱하는 유틸리티 함수
  const extractFromMarkdown = (text: string, key: string) => {
    // 예: | **공사번호** | 안산-설비-2026-0096 |
    const regex = new RegExp(`\\|\\s*\\*\\*${key}\\*\\*\\s*\\|\\s*([^\\|]+)\\s*\\|`);
    const match = text.match(regex);
    return match ? match[1].trim() : '';
  };

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

    // 추출된 고유 협력사 목록을 저장할 Set
    const companySet = new Set<string>();
    const dateMap = new Map();
    const monthMap = new Map();
    const detailRows: any[] = [];

    // 1차 순회: 데이터 추출 및 가공
    inspections.forEach((item) => {
      const dateObj = new Date(item.created_at);
      const yyyyMmDd = dateObj.toISOString().slice(0, 10);
      const yyyyMm = `${dateObj.getFullYear()}년 ${dateObj.getMonth() + 1}월`;
      const amPm = dateObj.getHours() < 12 ? '오전' : '오후';
      
      const aiText = item.ai_report_text || '';
      
      // AI 보고서에서 데이터 추출
      const projectNumber = extractFromMarkdown(aiText, '공사번호') || '미분류-0000';
      const companyName = projectNumber.split('-')[0] || '미상'; // 공사번호 맨 앞단어
      const workType = extractFromMarkdown(aiText, '작업공정') || '일반작업';
      const workerName = item.workers?.worker_name || '알수없음';
      
      // 안전점검 이행 여부 (불량이 하나라도 있으면 X)
      const isDanger = aiText.includes('불량') ? 'X' : 'O';

      companySet.add(companyName);

      // 안전점검 시트용 일자별 매핑
      if (!dateMap.has(yyyyMmDd)) dateMap.set(yyyyMmDd, {});
      // 불량이 하나라도 있으면 세모(△) 또는 엑스(X), 모두 양호면 동그라미(O) 처리
      dateMap.get(yyyyMmDd)[companyName] = isDanger === 'X' ? '△' : 'O';

      // 자재실사 시트용 월별 매핑
      if (!monthMap.has(yyyyMm)) monthMap.set(yyyyMm, {});
      monthMap.get(yyyyMm)[companyName] = 'O';

      // 세부 이력 시트용 행 데이터 생성
      detailRows.push([
        { v: yyyyMmDd }, { v: amPm }, { v: workerName }, { v: companyName }, 
        { v: projectNumber }, { v: workType }, { v: isDanger, s: { alignment: { horizontal: "center" } } }
      ]);
    });

    const companies = Array.from(companySet);

    // ★ 결과물 1: 협력사 관리 (자재실사 및 안전점검 크로스탭)
    const crossTabHeaders = ['', ...companies].map(text => ({ v: text, s: headerStyle }));
    
    // 자재실사 매트릭스 구성
    const crossTabSheetData = [
      [{ v: '자재 실사', s: { font: { bold: true } } }],
      crossTabHeaders
    ];
    Array.from(monthMap.keys()).forEach(month => {
      const rowData = companies.map(comp => ({ v: monthMap.get(month)[comp] || '-', s: { alignment: { horizontal: "center" } } }));
      crossTabSheetData.push([{ v: month, s: { alignment: { horizontal: "center" } } }, ...rowData]);
    });

    crossTabSheetData.push([]); // 빈 줄 삽입
    crossTabSheetData.push([{ v: '안전점검', s: { font: { bold: true } } }]);
    crossTabSheetData.push(crossTabHeaders);

    // 안전점검 매트릭스 구성
    Array.from(dateMap.keys()).forEach(date => {
      const rowData = companies.map(comp => ({ v: dateMap.get(date)[comp] || '-', s: { alignment: { horizontal: "center" } } }));
      crossTabSheetData.push([{ v: date, s: { alignment: { horizontal: "center" } } }, ...rowData]);
    });

    // ★ 결과물 2: 세부 이력 (날짜/시간/인원/공사유형 등)
    const detailHeaders = ['점검일자', '시간', '인원', '협력사', '공사번호', '공사유형', '안전작업 이행 여부'].map(text => ({ v: text, s: headerStyle }));
    const detailSheetData = [detailHeaders, ...detailRows];

    // 워크북 생성 및 시트 부착
    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.aoa_to_sheet(crossTabSheetData);
    const ws2 = XLSX.utils.aoa_to_sheet(detailSheetData);

    ws1['!cols'] = [{ wch: 15 }, ...companies.map(() => ({ wch: 15 }))];
    ws2['!cols'] = [{ wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 20 }, { wch: 20 }];

    XLSX.utils.book_append_sheet(wb, ws1, '협력사관리');
    XLSX.utils.book_append_sheet(wb, ws2, '세부이력');

    XLSX.writeFile(wb, `안전점검_종합결과물_${selectedMonth}.xlsx`);
  };

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
          <br/>AI 보고서의 마크다운 텍스트를 파싱하여 공사번호, 협력사명, 공사유형을 자동 추출하고 2가지 결과물(협력사관리, 세부이력)을 생성합니다.
        </p>
        
        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>데이터를 불러오는 중입니다...</div>
        ) : (
          <button 
            onClick={exportToExcel}
            style={{ marginTop: '20px', width: '100%', padding: '16px', background: '#10b981', color: 'white', fontSize: '18px', fontWeight: 'bold', border: 'none', borderRadius: '12px', cursor: 'pointer', transition: 'background-color 0.2s' }}
          >
            📊 {selectedMonth} 엑셀 결과물 다운로드
          </button>
        )}
      </div>
    </div>
  );
}