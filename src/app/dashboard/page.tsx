'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import confetti from 'canvas-confetti';
import imageCompression from 'browser-image-compression';
import localforage from 'localforage';

const ALLOWED_WORKERS = ['전소정', '김철수', '이영희', '박지민', '최동훈', '정유진', '강민재', '조수빈', '윤건우', '홍길동'];

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const workerName = searchParams.get('worker') || '작업자';

  const currentYear = new Date().getFullYear();
  const currentQuarter = Math.floor(new Date().getMonth() / 3) + 1;

  const [workerId, setWorkerId] = useState<string | null>(null);
  const [level, setLevel] = useState<number>(1);
  const [exp, setExp] = useState<number>(0);
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  
  const [gender, setGender] = useState<'M'|'F'>('M');
  const [dbTips, setDbTips] = useState<string[]>(['안전이 최우선입니다.']);
  const [loadingTip, setLoadingTip] = useState<string>('');
  
  const [projectNumberInput, setProjectNumberInput] = useState<string>('안산-설비-2026-0096');
  const [workTypeInput, setWorkTypeInput] = useState<string>('초고속 통신망 설비 점검');
  const [workDescInput, setWorkDescInput] = useState<string>('현장 안전 수칙 준수 및 자재 적재 상태 확인');

  const [report, setReport] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [currentReportId, setCurrentReportId] = useState<string | null>(null);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  
  const [editForm, setEditForm] = useState([
    { name: '보호구 착용 상태', result: '', action: '', note: '' },
    { name: '안전표지 설치', result: '', action: '', note: '' },
    { name: '사다리 및 장비 상태', result: '', action: '', note: '' },
    { name: '적정 공법 적용 상태', result: '', action: '', note: '' },
    { name: '정리정돈 상태', result: '', action: '', note: '' },
  ]);
  const editFormRef = useRef(editForm);
  
  const [pastReports, setPastReports] = useState<any[]>([]);
  const [showPast, setShowPast] = useState<boolean>(false);
  const [showLevelUpModal, setShowLevelUpModal] = useState<boolean>(false);
  
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');

  const [printItem, setPrintItem] = useState<any>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ALLOWED_WORKERS.includes(workerName)) {
      alert('접근 권한이 없습니다.'); router.push('/'); return;
    }
    const savedGender = localStorage.getItem(`kt_gender_${workerName}`);
    if (savedGender === 'F') setGender('F');

    const fetchTips = async () => {
      const { data } = await supabase.from('safety_tips').select('content').eq('is_active', true);
      if (data && data.length > 0) setDbTips(data.map(item => item.content));
    };
    fetchTips();
  }, [workerName, router]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (analyzing) {
      setLoadingTip(dbTips[Math.floor(Math.random() * dbTips.length)]);
      interval = setInterval(() => setLoadingTip(dbTips[Math.floor(Math.random() * dbTips.length)]), 2000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [analyzing, dbTips]);

  useEffect(() => { editFormRef.current = editForm; }, [editForm]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isEditing && currentReportId && report) {
      interval = setInterval(() => {
        const currentDraft = buildMarkdownFromForm(report, editFormRef.current);
        localStorage.setItem(`kt_autosave_${currentReportId}`, currentDraft);
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        setLastSavedTime(`${timeStr} 자동 저장됨`);
      }, 5000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isEditing, currentReportId, report]);

  useEffect(() => {
    const loadPendingPhotos = async () => {
      const savedFiles = await localforage.getItem<File[]>('pending_photos');
      if (savedFiles && savedFiles.length > 0) { setFiles(savedFiles); setPreviewUrls(savedFiles.map(file => URL.createObjectURL(file))); }
    };
    const fetchWorkerData = async () => {
      let { data: workerData } = await supabase.from('workers').select('*').eq('worker_name', workerName).order('created_at', { ascending: false }).limit(1).single();
      if (workerData) {
        const { data: reportsData } = await supabase.from('inspections').select('*').eq('worker_id', workerData.id).order('created_at', { ascending: false });
        let lastActiveDate = new Date(workerData.created_at);
        if (reportsData && reportsData.length > 0) {
          const lastReportDate = new Date(reportsData[0].created_at);
          if (lastReportDate > lastActiveDate) lastActiveDate = lastReportDate;
          
          for (const r of reportsData) {
            const draft = localStorage.getItem(`kt_autosave_${r.id}`);
            if (draft && draft !== r.ai_report_text) {
              if (window.confirm('비정상 종료로 인해 저장되지 않은 이전 보고서가 발견되었습니다.\n지금 이어서 작성하시겠습니까?')) {
                setReport(draft);
                setCurrentReportId(r.id);
                parseMarkdownToForm(draft);
                setIsEditing(true);
                break; 
              } else {
                localStorage.removeItem(`kt_autosave_${r.id}`);
              }
            }
          }
        }
        
        const lastActiveYear = lastActiveDate.getFullYear(); const lastActiveQuarter = Math.floor(lastActiveDate.getMonth() / 3) + 1;
        if (currentYear > lastActiveYear || (currentYear === lastActiveYear && currentQuarter > lastActiveQuarter)) {
          if (workerData.exp > 0 || workerData.level > 1) {
            workerData.exp = 0; workerData.level = 1;
            await supabase.from('workers').update({ exp: 0, level: 1 }).eq('id', workerData.id);
            alert(`🎉 새로운 시즌(${currentYear}년 ${currentQuarter}분기) 시작! 레벨 초기화`);
          }
        }
        setWorkerId(workerData.id); setLevel(workerData.level); setExp(workerData.exp);
        if (reportsData) setPastReports(reportsData);
      }
    };
    loadPendingPhotos();
    if (workerName && ALLOWED_WORKERS.includes(workerName)) fetchWorkerData();
  }, [workerName, currentYear, currentQuarter]);

  const parseMarkdownToForm = (mdText: string) => {
    const newForm = [...editForm];
    newForm.forEach((item, i) => {
      const regex = new RegExp(`\\|\\s*${item.name}\\s*\\|([^\\|]+)\\|([^\\|]+)\\|([^\\|]+)\\|`);
      const match = mdText.match(regex);
      if (match) {
        newForm[i].result = match[1].trim().replace(/\(\s*\)/g, '');
        newForm[i].action = match[2].trim().replace(/\(\s*\)/g, '');
        newForm[i].note = match[3].trim().replace(/\(\s*\)/g, '');
      }
    });
    setEditForm(newForm);
  };

  const buildMarkdownFromForm = (originalMd: string, currentForm: any[]) => {
    const parts = originalMd.split('#### ■ 안전점검 항목');
    if (parts.length < 2) return originalMd;
    
    const topPart = parts[0];
    const bottomPart = `#### ■ 안전점검 항목\n| 점검항목 | 결과(양호/불량) | 조치사항 | 비고 |\n|---|---|---|---|\n` + 
      currentForm.map(item => `| ${item.name} | ${item.result || '( )'} | ${item.action || '( )'} | ${item.note || '( )'} |`).join('\n');
    
    return topPart + bottomPart;
  };

  const handleFormChange = (index: number, field: string, value: string) => {
    const newForm = [...editForm];
    (newForm[index] as any)[field] = value;
    setEditForm(newForm);
  };

  const handleStartEdit = () => {
    if (report) parseMarkdownToForm(report);
    setIsEditing(true); setLastSavedTime(null);
  };

  // ★ 저장 버튼 클릭 시 처리 함수
  const handleUpdateReport = async () => {
    setIsEditing(false); 
    if (currentReportId && report) {
      const finalMarkdown = buildMarkdownFromForm(report, editForm);
      await supabase.from('inspections').update({ ai_report_text: finalMarkdown }).eq('id', currentReportId);
      setPastReports(prev => prev.map(item => item.id === currentReportId ? { ...item, ai_report_text: finalMarkdown } : item));
      setReport(finalMarkdown);
      localStorage.removeItem(`kt_autosave_${currentReportId}`);
      setLastSavedTime(null);
      
      // ★ 추가: 수정 완료 시 폭죽 터뜨리기
      confetti({ 
        particleCount: 150, 
        spread: 80, 
        origin: { y: 0.6 },
        colors: ['#26ccff', '#a25afd', '#ff5e7e', '#88ff5a', '#fcff42', '#ffa62d', '#ff36ff'] 
      });
    }
  };

  const handleCancelEdit = () => {
    if (window.confirm('수정을 취소하시겠습니까? 저장되지 않은 내용은 사라집니다.')) {
      setIsEditing(false); setLastSavedTime(null);
      if (currentReportId) {
        localStorage.removeItem(`kt_autosave_${currentReportId}`);
        const originalItem = pastReports.find(item => item.id === currentReportId);
        if (originalItem) setReport(originalItem.ai_report_text);
      }
    }
  };

  const toggleGender = () => { const newGender = gender === 'M' ? 'F' : 'M'; setGender(newGender); localStorage.setItem(`kt_gender_${workerName}`, newGender); };
  const getCharacterEmoji = () => { if (level === 1) return '🐣'; if (level < 3) return gender === 'M' ? '👦' : '👧'; return gender === 'M' ? '👨‍🔧' : '👩‍🔧'; };
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault(); if (!oldPwd || !newPwd) return alert('모두 입력해주세요.');
    const { data } = await supabase.from('workers').select('password').eq('id', workerId).single();
    if (data?.password !== oldPwd) return alert('현재 비밀번호가 일치하지 않습니다.');
    await supabase.from('workers').update({ password: newPwd }).eq('id', workerId);
    alert('비밀번호가 성공적으로 변경되었습니다.'); setShowSettingsModal(false); setOldPwd(''); setNewPwd('');
  };
  const handleLogout = () => { if(window.confirm('정말 로그아웃 하시겠습니까?')) router.push('/'); };
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      const compressedFiles = await Promise.all(newFiles.map(async (f) => { try { return await imageCompression(f, { maxSizeMB: 0.3, maxWidthOrHeight: 1024, initialQuality: 0.7, useWebWorker: true }); } catch { return f; } }));
      const currentSaved = await localforage.getItem<File[]>('pending_photos') || []; const newTotalFiles = [...currentSaved, ...compressedFiles];
      await localforage.setItem('pending_photos', newTotalFiles); setFiles(newTotalFiles); setPreviewUrls(newTotalFiles.map(f => URL.createObjectURL(f))); setReport(null); setIsEditing(false);
    }
  };
  const removeFile = async (idx: number) => { const newFiles = files.filter((_, i) => i !== idx); await localforage.setItem('pending_photos', newFiles); setFiles(newFiles); setPreviewUrls(newFiles.map(f => URL.createObjectURL(f))); };
  
  const handleUploadAndAnalyze = async () => {
    if (files.length === 0) return alert('사진을 추가해주세요!');
    setAnalyzing(true); setReport(null); setIsEditing(false);
    try {
      const firstFile = files[0]; const rawDate = new Date(firstFile.lastModified); const photoDateStr = `${rawDate.getFullYear()}년 ${rawDate.getMonth() + 1}월 ${rawDate.getDate()}일`;
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${firstFile.name.split('.').pop()}`;
      const { error: uploadError } = await supabase.storage.from('inspections').upload(fileName, firstFile);
      const { data: publicUrlData } = supabase.storage.from('inspections').getPublicUrl(fileName); const imageUrl = publicUrlData?.publicUrl || '';
      const formData = new FormData(); files.forEach(f => formData.append('images', f)); formData.append('photoDate', photoDateStr); formData.append('projectNumber', projectNumberInput); formData.append('workType', workTypeInput); formData.append('workDesc', workDescInput); formData.append('inspector', workerName); 
      const res = await fetch('/api/analyze', { method: 'POST', body: formData }); const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || '분석 실패');
      await localforage.removeItem('pending_photos'); setFiles([]); setReport(resData.report);
      if (workerId) {
        const { data: insertedData } = await supabase.from('inspections').insert([{ worker_id: workerId, image_url: imageUrl, ai_report_text: resData.report, status: '완료' }]).select().single();
        if (insertedData) { setCurrentReportId(insertedData.id); setPastReports(prev => [insertedData, ...prev]); }
        const hasDanger = resData.report.includes('불량'); if (hasDanger) alert('⚠️ 위험 요소 발견! 보너스 10 EXP 추가 지급');
        const gainedExp = (files.length * 5) + (hasDanger ? 10 : 0); let tempExp = exp + gainedExp; let calcLevel = 1; let reqExp = 100;
        while (tempExp >= reqExp) { tempExp -= reqExp; calcLevel++; reqExp *= 2; }
        if (calcLevel > level) { setShowLevelUpModal(true); confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } }); setTimeout(() => setShowLevelUpModal(false), 5000); }
        setExp(exp + gainedExp); setLevel(calcLevel);
        await supabase.from('workers').update({ exp: exp + gainedExp, level: calcLevel }).eq('id', workerId);
      }
    } catch (err: any) { alert(`오류: ${err.message}`); } finally { setAnalyzing(false); }
  };

  const mdComps = {
    table: (props: any) => <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', border: '1.5px solid #000' }} {...props} /></div>,
    th: (props: any) => <th style={{ border: '1px solid #000', background: '#f8fafc', padding: '10px', textAlign: 'center', fontSize: '13px', color: '#000' }} {...props} />,
    td: (props: any) => <td style={{ border: '1px solid #000', padding: '10px', fontSize: '13px', textAlign: 'center', color: '#000' }} {...props} />,
    h3: (props: any) => <h3 style={{ fontSize: '18px', color: '#000', marginTop: '20px', textAlign: 'center' }} {...props} />,
    h4: (props: any) => <div style={{ textAlign: 'center', fontSize: '16px', fontWeight: 'bold', margin: '20px 0 10px 0', color: '#000' }} {...props} />,
    ul: (props: any) => <ul style={{ paddingLeft: '20px', margin: '8px 0', color: '#000' }} {...props} />,
  };

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '16px', fontFamily: "'Pretendard', sans-serif" }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes fadeInOut { 0% { opacity: 0; transform: translateY(10px); } 20% { opacity: 1; transform: translateY(0); } 80% { opacity: 1; transform: translateY(0); } 100% { opacity: 0; transform: translateY(-10px); } }
        @media print { body, .print-target, .print-target * { font-family: 'Pretendard', sans-serif !important; visibility: visible; } body * { visibility: hidden; } .print-target { position: absolute; left: 0; top: 0; width: 100%; } .no-print { display: none !important; } img { page-break-inside: avoid; max-width: 100% !important; border: none !important; } }
      `}} />

      {showSettingsModal && (
        <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.6)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <form onSubmit={handleChangePassword} style={{ background: 'white', padding: '30px', borderRadius: '16px', width: '90%', maxWidth: '320px', boxSizing: 'border-box' }}>
            <h3 style={{ margin: '0 0 20px 0', textAlign: 'center' }}>비밀번호 변경</h3>
            <input type="password" placeholder="현재 비밀번호" value={oldPwd} onChange={e => setOldPwd(e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
            <input type="password" placeholder="새 비밀번호" value={newPwd} onChange={e => setNewPwd(e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '20px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: '10px' }}><button type="button" onClick={() => setShowSettingsModal(false)} style={{ flex: 1, padding: '12px', background: '#e2e8f0', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>취소</button><button type="submit" style={{ flex: 1, padding: '12px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>저장</button></div>
          </form>
        </div>
      )}

      {showLevelUpModal && (
        <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', padding: '40px', borderRadius: '20px', textAlign: 'center' }}><div style={{ fontSize: '60px' }}>🎉</div><h2 style={{ color: '#2563eb' }}>레벨 업! Lv.{level}</h2><button onClick={() => setShowLevelUpModal(false)} style={{ padding: '14px', background: '#2563eb', color: 'white', borderRadius: '12px', border: 'none', width: '100%' }}>확인</button></div>
        </div>
      )}

      {analyzing && (
        <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', boxSizing: 'border-box' }}>
          <div style={{ width: '60px', height: '60px', border: '5px solid rgba(255,255,255,0.2)', borderTop: '5px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '24px' }} /><h3 style={{ color: '#60a5fa', fontSize: '15px', marginBottom: '16px', fontWeight: 'bold' }}>Vision AI 분석 중...</h3><div style={{ height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><p key={loadingTip} style={{ color: 'white', fontSize: '20px', fontWeight: 'bold', textAlign: 'center', animation: 'fadeInOut 1.5s ease-in-out forwards', margin: 0 }}>"{loadingTip}"</p></div>
        </div>
      )}

      <div className="no-print" style={{ padding: '16px', borderRadius: '12px', background: '#f1f5f9', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ fontSize: '36px', padding: '8px', background: 'white', borderRadius: '50%', position: 'relative' }}>
          {getCharacterEmoji()}
          <button onClick={toggleGender} style={{ position: 'absolute', bottom: '-10px', right: '-10px', background: '#475569', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', fontSize: '12px', cursor: 'pointer' }}>🔄</button>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '4px', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '16px' }}>{workerName}</h2><span style={{ fontSize: '11px', background: '#3b82f6', color: 'white', padding: '2px 6px', borderRadius: '8px' }}>경기설계팀</span>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span style={{ color: '#2563eb', fontWeight: 'bold' }}>Lv.{level}</span>
            <div style={{ flex: 1, height: '10px', background: '#e2e8f0', borderRadius: '5px' }}><div style={{ width: `${Math.min(exp % 100, 100)}%`, height: '100%', background: '#3b82f6' }} /></div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <button onClick={() => setShowSettingsModal(true)} style={{ padding: '6px 8px', background: '#e2e8f0', color: '#1e293b', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>⚙️ 설정</button>
          <button onClick={handleLogout} style={{ padding: '6px 8px', background: '#ef4444', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '12px' }}>로그아웃</button>
        </div>
      </div>

      <div className="no-print" style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '15px' }}>📝 사전 정보 입력</h3>
        <input type="text" value={projectNumberInput} onChange={e => setProjectNumberInput(e.target.value)} placeholder="공사번호" style={{ width: '100%', padding: '10px', marginBottom: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
        <input type="text" value={workTypeInput} onChange={e => setWorkTypeInput(e.target.value)} placeholder="작업공정" style={{ width: '100%', padding: '10px', marginBottom: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
        <input type="text" value={workDescInput} onChange={e => setWorkDescInput(e.target.value)} placeholder="작업내용" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
      </div>

      <div className="no-print" style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', textAlign: 'center', padding: '30px', background: '#fff', border: '2px dashed #94a3b8', borderRadius: '12px', cursor: 'pointer' }}>
          <div style={{ fontSize: '32px' }}>📸 사진 추가</div><input type="file" accept="image/*" multiple onChange={handleFileChange} style={{ display: 'none' }} />
        </label>
        {previewUrls.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '10px 0' }}>
            {previewUrls.map((url, i) => (<div key={i} style={{ position: 'relative' }}><img src={url} alt="미리보기" style={{ width: '80px', height: '80px', borderRadius: '8px', objectFit: 'cover' }} /><button onClick={() => removeFile(i)} style={{ position: 'absolute', top: 0, right: 0, background: 'black', color: 'white', border: 'none' }}>X</button></div>))}
          </div>
        )}
      </div>

      <button className="no-print" onClick={handleUploadAndAnalyze} disabled={analyzing || files.length === 0} style={{ width: '100%', padding: '16px', background: files.length ? '#2563eb' : '#cbd5e1', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' }}>일괄 분석하기</button>

      {report && (
        <div className={printItem ? "no-print" : "print-target"} style={{ marginTop: '20px', padding: '20px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
          {isEditing ? (
            <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ background: '#1e293b', padding: '16px', borderRadius: '12px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h4 style={{ color: '#60a5fa', margin: 0, fontSize: '15px' }}>💻 조치사항 간편 입력</h4>
                  {lastSavedTime && <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 'bold' }}>✓ {lastSavedTime}</span>}
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {editForm.map((item, i) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', background: '#334155', padding: '10px', borderRadius: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ width: '140px', color: 'white', fontSize: '13px', fontWeight: 'bold' }}>{item.name}</div>
                      <select value={item.result} onChange={e => handleFormChange(i, 'result', e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: 'none', outline: 'none' }}>
                        <option value="">(상태 선택)</option><option value="양호">양호</option><option value="불량">불량</option>
                      </select>
                      <input type="text" placeholder="조치사항 입력..." value={item.action} onChange={e => handleFormChange(i, 'action', e.target.value)} style={{ flex: 1, minWidth: '150px', padding: '8px', borderRadius: '6px', border: 'none', outline: 'none' }} />
                      <input type="text" placeholder="비고..." value={item.note} onChange={e => handleFormChange(i, 'note', e.target.value)} style={{ width: '80px', padding: '8px', borderRadius: '6px', border: 'none', outline: 'none' }} />
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={handleCancelEdit} style={{ flex: 1, padding: '14px', background: '#e2e8f0', color: '#1e293b', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>취소</button>
                <button onClick={handleUpdateReport} style={{ flex: 2, padding: '14px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>저장 (마크다운 자동 변환)</button>
              </div>
            </div>
          ) : (
            <>
              <div ref={reportRef}>
                <ReactMarkdown components={mdComps} remarkPlugins={[remarkGfm]}>{report}</ReactMarkdown>
                {previewUrls.length > 0 && (
                  <div style={{ marginTop: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <h4 style={{ width: '100%', borderBottom: '1px solid #000', paddingBottom: '8px', margin: '20px 0 10px 0' }}>📸 현장 사진 (첨부)</h4>
                    {previewUrls.map((url, i) => (<img key={i} src={url} alt="첨부사진" style={{ width: '48%', maxHeight: '300px', objectFit: 'contain', borderRadius: '8px', border: '1px solid #e2e8f0' }} />))}
                  </div>
                )}
              </div>
              <div className="no-print" style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button onClick={handleStartEdit} style={{ flex: 1, padding: '12px', cursor: 'pointer', borderRadius: '8px', border: '1px solid #cbd5e1' }}>수정</button>
                <button onClick={() => window.print()} style={{ flex: 1, padding: '12px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>PDF 인쇄</button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="no-print" style={{ marginTop: '30px' }}>
        <button onClick={() => setShowPast(!showPast)} style={{ width: '100%', padding: '16px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', cursor: 'pointer' }}>과거 기록 보기 ({pastReports.length}건)</button>
        {showPast && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
            {pastReports.map((item, i) => (
              <div key={i} style={{ padding: '16px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                <div style={{ color: '#2563eb', fontWeight: 'bold', marginBottom: '10px' }}>{new Date(item.created_at).toLocaleString()}</div>
                {item.image_url && <img src={item.image_url} alt="사진" style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '8px', marginBottom: '10px' }} />}
                <div style={{ maxHeight: '150px', overflowY: 'auto', background: '#f8fafc', padding: '10px', borderRadius: '8px' }}><ReactMarkdown components={mdComps} remarkPlugins={[remarkGfm]}>{item.ai_report_text || ''}</ReactMarkdown></div>
                <button onClick={() => { setPrintItem(item); setTimeout(() => { window.print(); setPrintItem(null); }, 600); }} style={{ width: '100%', marginTop: '10px', padding: '10px', background: '#1e293b', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>인쇄</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {printItem && (
        <div className="print-target" style={{ padding: '20px', background: 'white' }}>
          <ReactMarkdown components={mdComps} remarkPlugins={[remarkGfm]}>{printItem.ai_report_text}</ReactMarkdown>
          {printItem.image_url && <img src={printItem.image_url} alt="사진" style={{ width: '100%', maxHeight: '400px', objectFit: 'contain', marginTop: '20px' }} />}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() { return <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center' }}>로딩중...</div>}><DashboardContent /></Suspense>; }