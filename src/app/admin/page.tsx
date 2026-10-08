'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/utils/supabase';
import * as XLSX from 'xlsx'; // 엑셀 다운로드 라이브러리

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
  
  // 필터링 상태 (연도 및 분기)
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
  const [selectedQuarter, setSelectedQuarter] = useState<string>('ALL');

  // 다크모드 대응 테마
  const theme = isDarkMode ? {
    bg: '#0f172a', cardBg: '#1e293b', textMain: '#f8fafc', textSub: '#94a3b8',
    border: '#334155', btnPrimary: '#3b82f6', inputBg: '#0f172a', thBg: '#334155'
  } : {
    bg: '#f8fafc', cardBg: '#ffffff', textMain: '#0f172a', textSub: '#475569',
    border: '#cbd5e1', btnPrimary: '#2563eb', inputBg: '#f8fafc', thBg: '#f1f5f9'
  };

  // 로그인 로직
  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminName === '전현진' && adminPwd === '1234') {
      setIsAuthorized(true);
      fetchReports(); // 로그인 성공 시 데이터 즉시 로드
    } else {
      alert('관리자 이름 또는 비밀번호가 일치하지 않습니다.');
    }
  };

  // DB에서 모든 보고서 가져오기 (workers 테이블과 Join하여 작성자 이름 획득)
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
        applyFilters(data, selectedYear, selectedQuarter);
      }
    } catch (err: any) {
      alert(`데이터를 불러오지 못했습니다: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 연도 및 분기에 따른 데이터 필터링 로직
  const applyFilters = (data: any[], year: string, quarter: string) => {
    let filtered = data.filter(item => {
      const itemDate = new Date(item.created_at);
      const itemYear = itemDate.getFullYear().toString();
      return itemYear === year;
    });

    if (quarter !== 'ALL') {
      filtered = filtered.filter(item => {
        const month = new Date(item.created_at).getMonth() + 1; // 1~12
        if (quarter === 'Q1') return month >= 1 && month <= 3;
        if (quarter === 'Q2') return month >= 4 && month <= 6;
        if (quarter === 'Q3') return month >= 7 && month <= 9;
        if (quarter === 'Q4') return month >= 10 && month <= 12;
        return true;
      });
    }
    setFilteredReports(filtered);
  };

  // 필터 드롭다운 값이 바뀔 때마다 필터링 재실행
  useEffect(() => {
    if (isAuthorized) {
      applyFilters(allReports, selectedYear, selectedQuarter);
    }
  }, [selectedYear, selectedQuarter, allReports, isAuthorized]);

  // 엑셀 다운로드 로직
  const handleDownloadExcel = () => {
    if (filteredReports.length === 0) return alert('다운로드할 데이터가 없습니다.');

    // 엑셀에 맞게 데이터 포맷팅
    const exportData = filteredReports.map((report, index) => {
      const isTrashed = report.deleted_at ? '휴지통(삭제예정)' : '정상';
      const hasDanger = report.ai_report_text?.includes('불량') ? '위험요소 검출' : '양호';
      
      return {
        '순번': index + 1,
        '등록일시': new Date(report.created_at).toLocaleString('ko-KR'),
        '점검자명': report.workers?.worker_name || '알수없음',
        '상태': isTrashed,
        '요약': hasDanger,
        'AI 마크다운 원문': report.ai_report_text || '내용 없음',
        '첨부사진URL': report.image_url || '사진 없음'
      };
    });

    // 워크시트 생성 및 엑셀 파일 저장
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "안전점검 데이터");
    
    const fileName = `현장안전점검_${selectedYear}년_${selectedQuarter === 'ALL' ? '전체' : selectedQuarter}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  // 🔒 로그인 화면 (isAuthorized === false)
  if (!isAuthorized) {
    return (
      <div style={{ minHeight: '100vh', background: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Pretendard', sans-serif" }}>
        <form onSubmit={handleAdminLogin} style={{ background: theme.cardBg, padding: '40px', borderRadius: '8px', border: `1px solid ${theme.border}`, width: '90%', maxWidth: '340px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>🛡️</div>
          <h2 style={{ margin: '0 0 24px 0', fontSize: '20px', color: theme.textMain }}>최고 관리자 로그인</h2>
          
          <input type="text" placeholder="관리자 이름 (예: 전현진)" value={adminName} onChange={e => setAdminName(e.target.value)} style={{ width: '100%', padding: '14px', marginBottom: '12px', borderRadius: '4px', border: `1px solid ${theme.border}`, boxSizing: 'border-box', background: theme.inputBg, color: theme.textMain, fontSize: '14px' }} required />
          <input type="password" placeholder="비밀번호" value={adminPwd} onChange={e => setAdminPwd(e.target.value)} style={{ width: '100%', padding: '14px', marginBottom: '24px', borderRadius: '4px', border: `1px solid ${theme.border}`, boxSizing: 'border-box', background: theme.inputBg, color: theme.textMain, fontSize: '14px' }} required />
          
          <button type="submit" style={{ width: '100%', padding: '16px', background: theme.btnPrimary, color: 'white', border: 'none', borderRadius: '4px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '12px' }}>관리자 접속</button>
          <button type="button" onClick={() => router.push('/')} style={{ width: '100%', padding: '12px', background: 'transparent', color: theme.textSub, border: 'none', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline' }}>일반 작업자 메인으로 돌아가기</button>
        </form>
      </div>
    );
  }

  // 🔓 관리자 대시보드 (isAuthorized === true)
  return (
    <div style={{ minHeight: '100vh', background: theme.bg, padding: '40px 16px', fontFamily: "'Pretendard', sans-serif" }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        
        {/* 상단 헤더 영역 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', color: theme.textMain }}>👑 전현진 관리자님</h2>
            <p style={{ margin: 0, color: theme.textSub, fontSize: '14px' }}>직원들의 현장 점검 기록을 통합 관리합니다.</p>
          </div>
          <button onClick={() => router.push('/')} style={{ padding: '10px 20px', background: theme.btnPrimary, color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>메인으로 나가기</button>
        </div>

        {/* 필터 및 다운로드 영역 */}
        <div style={{ background: theme.cardBg, padding: '20px', borderRadius: '8px', border: `1px solid ${theme.border}`, marginBottom: '24px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
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

          <button onClick={handleDownloadExcel} style={{ padding: '12px 20px', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
            📊 엑셀 다운로드
          </button>
        </div>

        {/* 데이터 테이블 영역 */}
        <div style={{ background: theme.cardBg, borderRadius: '8px', border: `1px solid ${theme.border}`, overflowX: 'auto' }}>
          {isLoading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: theme.textSub }}>데이터를 불러오는 중입니다...</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
              <thead>
                <tr style={{ background: theme.thBg, borderBottom: `2px solid ${theme.border}` }}>
                  <th style={{ padding: '16px', textAlign: 'left', color: theme.textMain, fontSize: '14px', width: '150px' }}>등록 일시</th>
                  <th style={{ padding: '16px', textAlign: 'left', color: theme.textMain, fontSize: '14px', width: '100px' }}>점검자</th>
                  <th style={{ padding: '16px', textAlign: 'left', color: theme.textMain, fontSize: '14px', width: '100px' }}>상태</th>
                  <th style={{ padding: '16px', textAlign: 'left', color: theme.textMain, fontSize: '14px' }}>AI 점검 요약</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: theme.textSub }}>해당 조건의 데이터가 없습니다.</td>
                  </tr>
                ) : (
                  filteredReports.map((report) => {
                    const isTrashed = report.deleted_at;
                    const hasDanger = report.ai_report_text?.includes('불량');
                    const dateStr = new Date(report.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
                    
                    return (
                      <tr key={report.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                        <td style={{ padding: '16px', color: theme.textMain, fontSize: '14px' }}>{dateStr}</td>
                        <td style={{ padding: '16px', color: theme.textMain, fontSize: '14px', fontWeight: 'bold' }}>{report.workers?.worker_name || '알수없음'}</td>
                        <td style={{ padding: '16px' }}>
                          <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', background: isTrashed ? '#ef4444' : '#10b981', color: 'white' }}>
                            {isTrashed ? '휴지통' : '정상'}
                          </span>
                        </td>
                        <td style={{ padding: '16px', color: theme.textSub, fontSize: '13px' }}>
                          {hasDanger ? (
                            <span style={{ color: '#ef4444', fontWeight: 'bold' }}>[위험요소 포함] </span>
                          ) : (
                            <span style={{ color: '#3b82f6', fontWeight: 'bold' }}>[전체 양호] </span>
                          )}
                          {report.ai_report_text ? report.ai_report_text.substring(0, 60) + '...' : '내용 없음'}
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