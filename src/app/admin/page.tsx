'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/utils/supabase'; // 모델 설정을 위해 다시 추가됨
import * as XLSX from 'xlsx';

type SafetyStatus = 'ok' | 'danger' | 'unknown';

const PARTNER_NAME = '경기설계팀';

// ───────────────────────── 유틸 ─────────────────────────
const formatDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const getQuarter = (d: Date) => `Q${Math.floor(d.getMonth() / 3) + 1}`;

const safeCell = (value: string) => (/^[=+\-@]/.test(value) ? `'${value}` : value);

const extractInfoFromMarkdown = (md: string) => {
  const mdString = md || '';
  const projNumMatch = mdString.match(/\*\*공사번호\*\*\s*\|\s*([^|]+?)\s*\|/);
  const workTypeMatch = mdString.match(/\*\*작업공정\*\*\s*\|\s*([^|]+?)\s*\|/);

  const section = mdString.split(/점검\s*항목\s*및\s*결과/)[1]?.split(/종합\s*특이사항/)[0] ?? '';
  const results = section
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|') && !/^\|[\s:|-]+\|?$/.test(line))
    .map((line) => line.split('|').map((cell) => cell.trim())[2] ?? '')
    .filter((cell) => cell && !cell.includes('결과'));

  let status: SafetyStatus = 'unknown';
  if (results.some((r) => r.includes('불량'))) status = 'danger';
  else if (results.length > 0 && results.every((r) => r.includes('양호'))) status = 'ok';

  return {
    projNum: projNumMatch ? projNumMatch[1].trim() : '미상',
    workType: workTypeMatch ? workTypeMatch[1].trim() : '미상',
    status,
  };
};

const STATUS_VIEW: Record<SafetyStatus, { excel: string; label: string; color: string }> = {
  ok: { excel: 'O', label: 'O (양호)', color: '#10b981' },
  danger: { excel: 'X', label: 'X (미흡)', color: '#ef4444' },
  unknown: { excel: '확인필요', label: '확인필요', color: '#64748b' },
};

// ───────────────────────── 보고서 마크다운 렌더러 ─────────────────────────
type Block =
  | { type: 'heading'; level: number; text: string }
  | { type: 'table'; rows: string[][] }
  | { type: 'text'; text: string };

const parseMarkdown = (md: string): Block[] => {
  const lines = md.replace(/\r/g, '').split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) { i++; continue; }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] });
      i++;
      continue;
    }

    if (line.startsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const row = lines[i].trim();
        if (!/^\|[\s:|-]+\|?$/.test(row)) {
          rows.push(row.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim()));
        }
        i++;
      }
      blocks.push({ type: 'table', rows });
      continue;
    }

    blocks.push({ type: 'text', text: line });
    i++;
  }
  return blocks;
};

const renderInline = (text: string) =>
  text.split(/(\*\*[^*]+\*\*)/g).map((part, idx) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4
      ? <strong key={idx}>{part.slice(2, -2)}</strong>
      : <span key={idx}>{part}</span>
  );

function ReportView({ markdown, theme }: { markdown: string; theme: any }) {
  const blocks = parseMarkdown(markdown);

  return (
    <div style={{ color: theme.textMain, fontSize: '14px', lineHeight: 1.6 }}>
      {blocks.map((block, idx) => {
        if (block.type === 'heading') {
          return (
            <div
              key={idx}
              style={{
                margin: block.level <= 3 ? '0 0 16px 0' : '24px 0 10px 0',
                fontSize: block.level <= 3 ? '18px' : '15px',
                fontWeight: 'bold',
                textAlign: block.level <= 3 ? 'center' : 'left',
              }}
            >
              {renderInline(block.text)}
            </div>
          );
        }

        if (block.type === 'table') {
          const [header, ...body] = block.rows;
          return (
            <div key={idx} style={{ overflowX: 'auto', marginBottom: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '420px' }}>
                <thead>
                  <tr>
                    {header?.map((cell, c) => (
                      <th key={c} style={{ padding: '10px', border: `1px solid ${theme.border}`, background: theme.thBg, fontSize: '13px', textAlign: 'center' }}>
                        {renderInline(cell)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {body.map((row, r) => (
                    <tr key={r}>
                      {row.map((cell, c) => {
                        const isBad = cell === '불량';
                        const isGood = cell === '양호';
                        return (
                          <td
                            key={c}
                            style={{
                              padding: '10px',
                              border: `1px solid ${theme.border}`,
                              fontSize: '13px',
                              textAlign: isBad || isGood ? 'center' : 'left',
                              fontWeight: isBad || isGood ? 'bold' : 'normal',
                              color: isBad ? '#ef4444' : isGood ? '#10b981' : theme.textMain,
                            }}
                          >
                            {cell ? renderInline(cell) : '\u00A0'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        return <p key={idx} style={{ margin: '0 0 8px 0' }}>{renderInline(block.text)}</p>;
      })}
    </div>
  );
}

// ───────────────────────── 메인 컴포넌트 ─────────────────────────
export default function AdminPage() {
  const router = useRouter();
  const { isDarkMode } = useTheme();

  // 로그인 및 권한 상태
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [adminName, setAdminName] = useState('');
  const [adminPwd, setAdminPwd] = useState('');

  // 데이터 상태
  const [allReports, setAllReports] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // ★ AI 모델 관리 상태 복구
  const [aiModelName, setAiModelName] = useState<string>('로딩 중...');
  const [isModelUpdating, setIsModelUpdating] = useState<boolean>(false);

  // 필터링 상태
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
  const [selectedQuarter, setSelectedQuarter] = useState<string>('ALL');
  const [searchName, setSearchName] = useState<string>('');

  const [selectedReport, setSelectedReport] = useState<any | null>(null);

  const theme = isDarkMode ? {
    bg: '#0f172a', cardBg: '#1e293b', textMain: '#f8fafc', textSub: '#94a3b8',
    border: '#334155', btnPrimary: '#3b82f6', inputBg: '#0f172a', thBg: '#334155'
  } : {
    bg: '#f8fafc', cardBg: '#ffffff', textMain: '#0f172a', textSub: '#475569',
    border: '#cbd5e1', btnPrimary: '#2563eb', inputBg: '#f8fafc', thBg: '#f1f5f9'
  };

  // ★ DB에서 모델 이름 불러오기 복구
  const fetchSystemSettings = async () => {
    try {
      const { data } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'gemini_target_model').single();
      if (data) setAiModelName(data.setting_value);
      else setAiModelName('gemini-3.8-flash');
    } catch (err) {
      console.error('설정 로드 실패:', err);
    }
  };

  // ★ 모델 이름 변경 적용하기 복구
  const handleUpdateModel = async () => {
    if (!aiModelName.trim()) return alert('모델 이름을 입력해주세요.');
    setIsModelUpdating(true);
    try {
      const { error } = await supabase.from('system_settings').upsert({
        setting_key: 'gemini_target_model',
        setting_value: aiModelName.trim(),
        updated_at: new Date().toISOString()
      });
      if (error) throw error;
      alert(`✅ AI 모델이 [${aiModelName.trim()}]으로 즉시 변경 및 적용되었습니다.`);
    } catch (err: any) {
      alert(`변경 실패: ${err.message}`);
    } finally {
      setIsModelUpdating(false);
    }
  };

  // 보고서 데이터 로드
  const loadReports = useCallback(async (year: string, silent = false): Promise<boolean> => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/reports?year=${year}`, { cache: 'no-store' });
      if (res.status === 401) {
        setIsAuthorized(false);
        return false;
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '알 수 없는 오류');

      setAllReports(json.reports ?? []);
      setIsAuthorized(true);
      return true;
    } catch (err: any) {
      if (!silent) alert(`데이터를 불러오지 못했습니다: ${err.message}`);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 새로고침 시 세션 확인 및 설정 로드
  useEffect(() => {
    loadReports(currentYear.toString(), true).then((authorized) => {
      if (authorized) fetchSystemSettings();
    }).finally(() => setAuthChecked(true));
  }, [loadReports, currentYear]);

  useEffect(() => {
    if (!selectedReport) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedReport(null);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [selectedReport]);

  const handleCopyReport = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert('보고서 내용이 복사되었습니다.');
    } catch {
      alert('복사하지 못했습니다. 브라우저 권한을 확인해주세요.');
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: adminName, password: adminPwd }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(json.error || '로그인에 실패했습니다.');
        return;
      }
      setAdminPwd('');
      await loadReports(selectedYear);
      fetchSystemSettings(); // ★ 로그인 성공 시 모델 설정 로드
    } catch {
      alert('서버와 통신하지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/admin/login', { method: 'DELETE' }).catch(() => {});
    setIsAuthorized(false);
    setAllReports([]);
    setSelectedReport(null);
    setAdminName('');
    setAdminPwd('');
  };

  const handleYearChange = (year: string) => {
    setSelectedYear(year);
    loadReports(year);
  };

  const filteredReports = useMemo(() => {
    const keyword = searchName.trim();
    return allReports.filter((item) => {
      if (selectedQuarter !== 'ALL' && getQuarter(new Date(item.created_at)) !== selectedQuarter) return false;
      if (keyword && !(item.workers?.worker_name || '').includes(keyword)) return false;
      return true;
    });
  }, [allReports, selectedQuarter, searchName]);

  const handleDownloadExcel = (reportType: '자재실사' | '안전점검') => {
    if (filteredReports.length === 0) return alert('다운로드할 데이터가 없습니다.');

    const exportData = filteredReports.map((report) => {
      const { projNum, workType, status } = extractInfoFromMarkdown(report.ai_report_text);
      const dateObj = new Date(report.created_at);

      return {
        '일자': formatDate(dateObj),
        '구분': dateObj.getHours() < 12 ? '오전' : '오후',
        '인원': safeCell(report.workers?.worker_name || '미상'),
        '협력사': PARTNER_NAME,
        '공사번호': safeCell(projNum),
        '공사유형': safeCell(workType),
        '안전작업 이행 여부': STATUS_VIEW[status].excel,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, reportType);

    const nameStr = searchName.trim() ? `_${searchName.trim().replace(/[\\/:*?"<>|]/g, '')}` : '';
    const fileName = `협력사관리_${reportType}_${selectedYear}년_${selectedQuarter === 'ALL' ? '전체' : selectedQuarter}${nameStr}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  if (!authChecked) {
    return (
      <div style={{ minHeight: '100vh', background: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.textSub, fontFamily: "'Pretendard', sans-serif" }}>
        확인 중입니다...
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div style={{ minHeight: '100vh', background: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Pretendard', sans-serif" }}>
        <form onSubmit={handleAdminLogin} style={{ background: theme.cardBg, padding: '40px', borderRadius: '8px', border: `1px solid ${theme.border}`, width: '90%', maxWidth: '340px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>🛡️</div>
          <h2 style={{ margin: '0 0 24px 0', fontSize: '20px', color: theme.textMain }}>최고 관리자 로그인</h2>

          <input type="text" placeholder="관리자 이름" autoComplete="username" value={adminName} onChange={e => setAdminName(e.target.value)} style={{ width: '100%', padding: '14px', marginBottom: '12px', borderRadius: '4px', border: `1px solid ${theme.border}`, boxSizing: 'border-box', background: theme.inputBg, color: theme.textMain, fontSize: '14px' }} required />
          <input type="password" placeholder="비밀번호" autoComplete="current-password" value={adminPwd} onChange={e => setAdminPwd(e.target.value)} style={{ width: '100%', padding: '14px', marginBottom: '24px', borderRadius: '4px', border: `1px solid ${theme.border}`, boxSizing: 'border-box', background: theme.inputBg, color: theme.textMain, fontSize: '14px' }} required />

          <button type="submit" disabled={isSubmitting} style={{ width: '100%', padding: '16px', background: theme.btnPrimary, color: 'white', border: 'none', borderRadius: '4px', fontSize: '15px', fontWeight: 'bold', cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.7 : 1, marginBottom: '12px' }}>
            {isSubmitting ? '확인 중...' : '관리자 접속'}
          </button>
          <button type="button" onClick={() => router.push('/')} style={{ width: '100%', padding: '12px', background: 'transparent', color: theme.textSub, border: 'none', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline' }}>일반 작업자 메인으로 돌아가기</button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: theme.bg, padding: '40px 16px', fontFamily: "'Pretendard', sans-serif" }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', color: theme.textMain }}>👑 최고 관리자님</h2>
            <p style={{ margin: 0, color: theme.textSub, fontSize: '14px' }}>협력사 관리 및 현장 점검 기록을 통합 제어합니다.</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleLogout} style={{ padding: '10px 20px', background: 'transparent', color: theme.textSub, border: `1px solid ${theme.border}`, borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>로그아웃</button>
            <button onClick={() => router.push('/')} style={{ padding: '10px 20px', background: theme.btnPrimary, color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>메인으로 나가기</button>
          </div>
        </div>

        {/* ★ 실시간 AI 모델 버전 관리 패널 복구 */}
        <div style={{ background: theme.cardBg, padding: '20px', borderRadius: '8px', border: `1px solid ${theme.border}`, marginBottom: '24px' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: theme.textMain }}>⚙️ 실시간 AI 모델 버전 관리</h3>
          <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: theme.textSub }}>구글 API 정책 변경 시, 소스 코드 수정 없이 즉각 대응할 수 있습니다.</p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <input 
              type="text" 
              value={aiModelName} 
              onChange={(e) => setAiModelName(e.target.value)} 
              placeholder="예: gemini-3.8-flash" 
              style={{ flex: 1, minWidth: '200px', padding: '12px', borderRadius: '4px', border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.textMain, fontWeight: 'bold' }} 
            />
            <button 
              onClick={handleUpdateModel} 
              disabled={isModelUpdating} 
              style={{ padding: '12px 24px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              {isModelUpdating ? '저장 중...' : '저장 및 즉시 적용'}
            </button>
          </div>
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

            <select value={selectedYear} onChange={(e) => handleYearChange(e.target.value)} style={{ padding: '10px', borderRadius: '4px', border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.textMain, fontWeight: 'bold' }}>
              <option value={currentYear.toString()}>{currentYear}년</option>
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
                  <th style={{ padding: '16px', textAlign: 'center', color: theme.textMain, fontSize: '13px' }}>보고서</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: theme.textSub }}>해당 조건의 데이터가 없습니다.</td>
                  </tr>
                ) : (
                  filteredReports.map((report) => {
                    const { projNum, workType, status } = extractInfoFromMarkdown(report.ai_report_text);
                    const dateObj = new Date(report.created_at);
                    const view = STATUS_VIEW[status];

                    return (
                      <tr key={report.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                        <td style={{ padding: '16px', textAlign: 'center', color: theme.textMain, fontSize: '13px' }}>{formatDate(dateObj)}</td>
                        <td style={{ padding: '16px', textAlign: 'center', color: theme.textMain, fontSize: '13px' }}>{dateObj.getHours() < 12 ? '오전' : '오후'}</td>
                        <td style={{ padding: '16px', textAlign: 'center', color: theme.textMain, fontSize: '13px', fontWeight: 'bold' }}>{report.workers?.worker_name || '미상'}</td>
                        <td style={{ padding: '16px', color: theme.textSub, fontSize: '13px' }}>{projNum}</td>
                        <td style={{ padding: '16px', color: theme.textSub, fontSize: '13px' }}>{workType}</td>
                        <td style={{ padding: '16px', textAlign: 'center' }}>
                          <span style={{ padding: '4px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', background: view.color, color: 'white' }}>
                            {view.label}
                          </span>
                        </td>
                        <td style={{ padding: '16px', textAlign: 'center' }}>
                          <button
                            onClick={() => setSelectedReport(report)}
                            style={{ padding: '6px 14px', background: 'transparent', color: theme.btnPrimary, border: `1px solid ${theme.btnPrimary}`, borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                          >
                            📄 보기
                          </button>
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

      {/* 📄 보고서 열람 팝업 */}
      {selectedReport && (() => {
        const dateObj = new Date(selectedReport.created_at);
        const reportText: string = selectedReport.ai_report_text || '';
        const view = STATUS_VIEW[extractInfoFromMarkdown(reportText).status];

        return (
          <div
            onClick={() => setSelectedReport(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 1000 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              style={{ background: theme.cardBg, borderRadius: '8px', border: `1px solid ${theme.border}`, width: '100%', maxWidth: '760px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', fontFamily: "'Pretendard', sans-serif" }}
            >
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ color: theme.textSub, fontSize: '13px' }}>
                  <strong style={{ color: theme.textMain }}>{selectedReport.workers?.worker_name || '미상'}</strong>
                  {' · '}{formatDate(dateObj)} {dateObj.getHours() < 12 ? '오전' : '오후'} {String(dateObj.getHours()).padStart(2, '0')}:{String(dateObj.getMinutes()).padStart(2, '0')}
                  <span style={{ marginLeft: '10px', padding: '2px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', background: view.color, color: 'white' }}>
                    {view.label}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => handleCopyReport(reportText)} disabled={!reportText} style={{ padding: '8px 14px', background: 'transparent', color: theme.textSub, border: `1px solid ${theme.border}`, borderRadius: '4px', cursor: reportText ? 'pointer' : 'not-allowed', fontSize: '13px', fontWeight: 'bold' }}>복사</button>
                  <button onClick={() => setSelectedReport(null)} style={{ padding: '8px 14px', background: theme.btnPrimary, color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>닫기</button>
                </div>
              </div>

              <div style={{ padding: '24px 20px', overflowY: 'auto' }}>
                {reportText ? (
                  <ReportView markdown={reportText} theme={theme} />
                ) : (
                  <div style={{ padding: '40px', textAlign: 'center', color: theme.textSub }}>저장된 보고서 내용이 없습니다.</div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}