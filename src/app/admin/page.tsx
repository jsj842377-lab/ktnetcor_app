'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/utils/supabase';
import * as XLSX from 'xlsx';

export default function AdminPage() {
  const router = useRouter();
  const { isDarkMode } = useTheme();

  // 로그인 및 권한 상태
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [adminName, setAdminName] = useState('');
  const [adminPwd, setAdminPwd] = useState('');

  // 데이터 관리 상태
  const [allReports, setAllReports] = useState<any[]>([]);
  const [filteredReports, setFilteredReports] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // 필터링 상태 (연도, 분기, 이름 검색)
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
  const [selectedQuarter, setSelectedQuarter] = useState<string>('ALL');
  const [searchName, setSearchName] = useState<string>(''); 

  // 다크모드 대응 테마
  const theme = isDarkMode ? {
    bg: '#0f172a', cardBg: '#1e293b', textMain: '#f8fafc', textSub: '#94a3b8',
    border: '#334155', btnPrimary: '#3b82f6', inputBg: '#0f172a', thBg: '#334155'
  } : {
    bg: '#f8fafc', cardBg: '#ffffff', textMain: '#0f172a', textSub: '#475569',
    border: '#cbd5e1', btnPrimary: '#2563eb', inputBg: '#f8fafc', thBg: '#f1f5f9'
  };

  // ★ 관리자 내부 로그인 로직 (조건 변경: 관리자 / 1234)
  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminName === '관리자' && adminPwd === '1234') {
      setIsAuthorized(true);
      fetchReports();
    } else {
      alert('관리자 이름 또는 비밀번호가 일치하지 않습니다.');
    }
  };

  // DB에서 모든 보고서 가져오기
  const fetchReports = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('inspections')
        .select(`
          *,
          workers (
            worker_name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) {
        setAllReports(data);
        applyFilters(data, selectedYear, selectedQuarter, searchName);
      }
    } catch (err: any) {
      alert(`데이터를 불러오지 못했습니다: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 필터링 로직
  const applyFilters = (data: any[], year: string, quarter: string, nameSearch: string) => {
    let filtered = data.filter(item => {
      const itemDate = new Date(item.created_at);
      const itemYear = itemDate.getFullYear().toString();
      return itemYear === year;
    });

    if (quarter !== 'ALL') {
      filtered = filtered.filter(item => {
        const month = new Date(item.created_at).getMonth() + 1; 
        if (quarter === 'Q1') return month >= 1 && month <= 3;
        if (quarter === 'Q2') return month >= 4 && month <= 6;
        if (quarter === 'Q3') return month >= 7 && month <= 9;
        if (quarter === 'Q4') return month >= 10 && month <= 12;
        return true;
      });
    }

    if (nameSearch.trim() !== '') {
      filtered = filtered.filter(item => {
        const workerName = item.workers?.worker_name || '';
        return workerName.includes(nameSearch.trim());
      });
    }

    setFilteredReports(filtered);
  };

  useEffect(() => {
    if (isAuthorized) {
      applyFilters(allReports, selectedYear, selectedQuarter, searchName);
    }
  }, [selectedYear, selectedQuarter, searchName, allReports, isAuthorized]);

  const extractInfoFromMarkdown = (md: string) => {
    const mdString = md || '';
    const projNumMatch = mdString.match(/\*\*공사번호\*\*\s*\|\s*([^|]+?)\s*\|/);
    const workTypeMatch = mdString.match(/\*\*작업공정\*\*\s*\|\s*([^|]+?)\s*\|/);
    
    return {
      projNum: projNumMatch ? projNumMatch[1].trim() : '미상',
      workType: workTypeMatch ? workTypeMatch[1].trim() : '미상',
      hasDanger: mdString.includes('불량')
    };
  };

  const handleDownloadExcel = (reportType: '자재실사' | '안전점검') => {
    if (filteredReports.length === 0) return alert('다운로드할 데이터가 없습니다.');

    const exportData = filteredReports.map((report) => {
      const { projNum, workType, hasDanger } = extractInfoFromMarkdown(report.ai_report_text);
      
      const dateObj = new Date(report.created_at);
      const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
      const ampm = dateObj.getHours() < 12 ? '오전' : '오후';
      
      const safetyStatus = hasDanger ? 'X' : 'O';
      
      return {
        '일자': dateStr,
        '구분': ampm,
        '인원': report.workers?.worker_name || '미상',
        '협력사': '경기설계팀', 
        '공사번호': projNum,
        '공사유형': workType,
        '안전작업 이행 여부': safetyStatus
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, reportType);
    
    const nameStr = searchName.trim() ? `_${searchName}` : '';
    const fileName = `협력사관리_${reportType}_${selectedYear}년_${selectedQuarter === 'ALL' ? '전체' : selectedQuarter}${nameStr}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  // 🔒 로그인 화면
  if (!isAuthorized) {
    return (
      <div style={{ minHeight: '100vh', background: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Pretendard', sans-serif" }}>
        <form onSubmit={handleAdminLogin} style={{ background: theme.cardBg, padding: '40px', borderRadius: '8px', border: `1px solid ${theme.border}`, width: '90%', maxWidth: '340px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>🛡️</div>
          <h2 style={{ margin: '0 0 24px 0', fontSize: '20px', color: theme.textMain }}>최고 관리자 로그인</h2>
          
          <input type="text" placeholder="관리자 이름 (예: 관리자)" value={adminName} onChange={e => setAdminName(e.target.value)} style={{ width: '100%', padding: '14px', marginBottom: '12px', borderRadius: '4px', border: `1px solid ${theme.border}`, boxSizing: 'border-box', background: theme.inputBg, color: theme.textMain, fontSize: '14px' }} required />
          <input type="password" placeholder="비밀번호" value={adminPwd} onChange={e => setAdminPwd(e.target.value)} style={{ width: '100%', padding: '14px', marginBottom: '24px', borderRadius: '4px', border: `1px solid ${theme.border}`, boxSizing: 'border-box', background: theme.inputBg, color: theme.textMain, fontSize: '14px' }} required />
          
          <button type="submit" style={{ width: '100%', padding: '16px', background: theme.btnPrimary, color: 'white', border: 'none', borderRadius: '4px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '12px' }}>관리자 접속</button>
          <button type="button" onClick={() => router.push('/')} style={{ width: '100%', padding: '12px', background: 'transparent', color: theme.textSub, border: 'none', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline' }}>일반 작업자 메인으로 돌아가기</button>
        </form>
      </div>
    );
  }

  // 🔓 관리자 대시보드
  return (
    <div style={{ minHeight: '100vh', background: theme.bg, padding: '40px 16px', fontFamily: "'Pretendard', sans-serif" }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            {/* ★ 문구 변경 완료 */}
            <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', color: theme.textMain }}>👑 최고 관리자님</h2>
            <p style={{ margin: 0, color: theme.textSub, fontSize: '14px' }}>협력사 관리 및 현장 점검 기록을 통합 제어합니다.</p>
          </div>
          <button onClick={() => router.push('/')} style={{ padding: '10px 20px', background: theme.btnPrimary, color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>메인으로 나가기</button>
        </div>

        <div style={{ background: theme.cardBg, padding: '20px', borderRadius: '8px', border: `1px solid ${theme.border}`, marginBottom: '24px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <input 
              type="text" 
              placeholder="직원 이름 검색..." 
              value={searchName} 
              onChange={(e) => setSearchName(e.target.value)} 
              style={{ padding: '10px', borderRadius: '4px', border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.textMain, fontWeight: 'bold', width: '160px' }} 
            />

            <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} style={{ padding: '10px', borderRadius: '4px', border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.textMain, fontWeight: 'bold' }}>
              <option value={(currentYear).toString()}>{currentYear}년</option>
              <option value={(currentYear - 1).toString()}>{currentYear - 1}년</option>
              <option value={(currentYear - 2).toString()}>{currentYear - 2}년</option>
            </select>
            
            <select value={selectedQuarter} onChange={(e) => setSelectedQuarter(e.target.value)} style={{ padding: '10px', borderRadius: '4px', border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.textMain, fontWeight: 'bold' }}>
              <option value="ALL">전체 분기</option>
              <option value="Q1">1분기 (1월~3월)</option>
              <option value="Q2">2분기 (4월~6월)</option>
              <option value="Q3">3분기 (7월~9월)</option>
              <option value="Q4">4분기 (10월~12월)</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={() => handleDownloadExcel('자재실사')} style={{ padding: '12px 16px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
              📦 자재실사 엑셀
            </button>
            <button onClick={() => handleDownloadExcel('안전점검')} style={{ padding: '12px 16px', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
              👷 안전점검 엑셀
            </button>
          </div>
        </div>

        <div style={{ background: theme.cardBg, borderRadius: '8px', border: `1px solid ${theme.border}`, overflowX: 'auto' }}>
          {isLoading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: theme.textSub }}>데이터를 불러오는 중입니다...</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
              <thead>
                <tr style={{ background: theme.thBg, borderBottom: `2px solid ${theme.border}` }}>
                  <th style={{ padding: '16px', textAlign: 'center', color: theme.textMain, fontSize: '13px' }}>일자</th>
                  <th style={{ padding: '16px', textAlign: 'center', color: theme.textMain, fontSize: '13px' }}>구분</th>
                  <th style={{ padding: '16px', textAlign: 'center', color: theme.textMain, fontSize: '13px' }}>인원</th>
                  <th style={{ padding: '16px', textAlign: 'left', color: theme.textMain, fontSize: '13px' }}>공사번호</th>
                  <th style={{ padding: '16px', textAlign: 'left', color: theme.textMain, fontSize: '13px' }}>공사유형</th>
                  <th style={{ padding: '16px', textAlign: 'center', color: theme.textMain, fontSize: '13px' }}>안전점검(O/X)</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: theme.textSub }}>해당 조건의 데이터가 없습니다.</td>
                  </tr>
                ) : (
                  filteredReports.map((report) => {
                    const { projNum, workType, hasDanger } = extractInfoFromMarkdown(report.ai_report_text);
                    const dateObj = new Date(report.created_at);
                    const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
                    const ampm = dateObj.getHours() < 12 ? '오전' : '오후';

                    return (
                      <tr key={report.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                        <td style={{ padding: '16px', textAlign: 'center', color: theme.textMain, fontSize: '13px' }}>{dateStr}</td>
                        <td style={{ padding: '16px', textAlign: 'center', color: theme.textMain, fontSize: '13px' }}>{ampm}</td>
                        <td style={{ padding: '16px', textAlign: 'center', color: theme.textMain, fontSize: '13px', fontWeight: 'bold' }}>{report.workers?.worker_name || '미상'}</td>
                        <td style={{ padding: '16px', color: theme.textSub, fontSize: '13px' }}>{projNum}</td>
                        <td style={{ padding: '16px', color: theme.textSub, fontSize: '13px' }}>{workType}</td>
                        <td style={{ padding: '16px', textAlign: 'center' }}>
                          <span style={{ padding: '4px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', background: hasDanger ? '#ef4444' : '#10b981', color: 'white' }}>
                            {hasDanger ? 'X (미흡)' : 'O (양호)'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}