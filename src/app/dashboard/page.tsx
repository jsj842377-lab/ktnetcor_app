'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import confetti from 'canvas-confetti';
import imageCompression from 'browser-image-compression';
import localforage from 'localforage';

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const workerName = searchParams.get('worker') || '작업자';

  // ★ 현재 연도 및 분기 계산
  const currentYear = new Date().getFullYear();
  const currentQuarter = Math.floor(new Date().getMonth() / 3) + 1;

  const [workerId, setWorkerId] = useState<string | null>(null);
  const [level, setLevel] = useState<number>(1);
  const [exp, setExp] = useState<number>(0);
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  
  const [projectNumberInput, setProjectNumberInput] = useState<string>('안산-설비-2026-0096');
  const [workTypeInput, setWorkTypeInput] = useState<string>('초고속 통신망 설비 점검');
  const [workDescInput, setWorkDescInput] = useState<string>('현장 안전 수칙 준수 및 자재 적재 상태 확인');

  const [report, setReport] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [currentReportId, setCurrentReportId] = useState<string | null>(null);
  
  const [pastReports, setPastReports] = useState<any[]>([]);
  const [showPast, setShowPast] = useState<boolean>(false);

  const [showLevelUpModal, setShowLevelUpModal] = useState<boolean>(false);
  const [printItem, setPrintItem] = useState<any>(null);

  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadPendingPhotos = async () => {
      try {
        const savedFiles = await localforage.getItem<File[]>('pending_photos');
        if (savedFiles && savedFiles.length > 0) {
          setFiles(savedFiles);
          setPreviewUrls(savedFiles.map(file => URL.createObjectURL(file)));
        }
      } catch (err) {
        console.error('임시 저장된 사진을 불러오는 중 오류 발생:', err);
      }
    };

    const fetchWorkerData = async () => {
      let { data: workerData } = await supabase
        .from('workers')
        .select('*')
        .eq('worker_name', workerName)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!workerData) {
        const { data: newWorker, error: insertError } = await supabase
          .from('workers')
          .insert([{ worker_name: workerName, level: 1, exp: 0 }])
          .select()
          .single();

        if (insertError) {
          console.error('신규 작업자 자동 등록 실패:', insertError);
          alert('작업자 계정을 생성하는 중 오류가 발생했습니다.');
          return;
        }
        workerData = newWorker;
      }

      if (workerData) {
        const { data: reportsData } = await supabase
          .from('inspections')
          .select('*')
          .eq('worker_id', workerData.id)
          .order('created_at', { ascending: false });

        // ★ 캐릭터 분기별 초기화 로직
        let lastActiveDate = new Date(workerData.created_at);
        if (reportsData && reportsData.length > 0) {
          const lastReportDate = new Date(reportsData[0].created_at);
          if (lastReportDate > lastActiveDate) {
            lastActiveDate = lastReportDate;
          }
        }

        const lastActiveYear = lastActiveDate.getFullYear();
        const lastActiveQuarter = Math.floor(lastActiveDate.getMonth() / 3) + 1;

        // 현재 연도가 더 크거나, 연도는 같은데 현재 분기가 더 큰 경우 초기화 수행
        if (currentYear > lastActiveYear || (currentYear === lastActiveYear && currentQuarter > lastActiveQuarter)) {
          if (workerData.exp > 0 || workerData.level > 1) {
            workerData.exp = 0;
            workerData.level = 1;
            await supabase.from('workers').update({ exp: 0, level: 1 }).eq('id', workerData.id);
            alert(`🎉 새로운 시즌(${currentYear}년 ${currentQuarter}분기)이 시작되어 캐릭터가 1레벨로 초기화되었습니다! 새롭게 달려보세요.`);
          }
        }

        setWorkerId(workerData.id);
        setLevel(workerData.level);
        setExp(workerData.exp);

        if (reportsData) setPastReports(reportsData);
      }
    };
    
    loadPendingPhotos();
    if (workerName) fetchWorkerData();
  }, [workerName, currentYear, currentQuarter]);

  const handleLogout = () => {
    if(window.confirm('정말 로그아웃 하시겠습니까?')) {
      localStorage.removeItem('ktnetcore_worker');
      router.push('/');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      
      const compressedFiles = await Promise.all(
        newFiles.map(async (file) => {
          const options = { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true };
          try { return await imageCompression(file, options); } 
          catch (error) { return file; }
        })
      );

      const currentSaved = await localforage.getItem<File[]>('pending_photos') || [];
      const newTotalFiles = [...currentSaved, ...compressedFiles];
      
      await localforage.setItem('pending_photos', newTotalFiles);
      setFiles(newTotalFiles);
      setPreviewUrls(newTotalFiles.map(file => URL.createObjectURL(file)));
      
      setReport(null);
      setIsEditing(false);
    }
  };

  const removeFile = async (indexToRemove: number) => {
    const newFiles = files.filter((_, idx) => idx !== indexToRemove);
    await localforage.setItem('pending_photos', newFiles);
    setFiles(newFiles);
    setPreviewUrls(newFiles.map(file => URL.createObjectURL(file)));
  };

  const handleUploadAndAnalyze = async () => {
    if (files.length === 0) return alert('현장 점검 사진을 최소 1장 이상 선택해주세요!');

    setAnalyzing(true);
    setReport(null);
    setIsEditing(false);

    try {
      const firstFile = files[0];
      
      const rawPhotoDate = new Date(firstFile.lastModified);
      const formattedPhotoDate = `${rawPhotoDate.getFullYear()}년 ${rawPhotoDate.getMonth() + 1}월 ${rawPhotoDate.getDate()}일 ${rawPhotoDate.getHours()}시 ${rawPhotoDate.getMinutes()}분`;

      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${firstFile.name.split('.').pop()}`;
      
      const { error: uploadError } = await supabase.storage.from('inspections').upload(fileName, firstFile);
      if (uploadError) {
        console.warn('Storage RLS 업로드 실패 (계속 진행):', uploadError.message);
      }
      
      const { data: publicUrlData } = supabase.storage.from('inspections').getPublicUrl(fileName);
      const imageUrl = publicUrlData?.publicUrl || '';

      const formData = new FormData();
      files.forEach((file) => formData.append('images', file));
      formData.append('photoDate', formattedPhotoDate);
      formData.append('projectNumber', projectNumberInput);
      formData.append('workType', workTypeInput);
      formData.append('workDesc', workDescInput);
      formData.append('inspector', '경기 서부설계팀');

      const response = await fetch('/api/analyze', { method: 'POST', body: formData });
      const resData = await response.json();
      
      if (!response.ok) throw new Error(resData.error || 'AI 분석 요청에 실패했습니다.');

      await localforage.removeItem('pending_photos');
      setFiles([]);
      
      setReport(resData.report);

      if (workerId) {
        const { data: insertedData } = await supabase.from('inspections').insert([
          { worker_id: workerId, image_url: imageUrl, ai_report_text: resData.report, status: '완료' }
        ]).select().single();

        if (insertedData) {
          setCurrentReportId(insertedData.id);
          setPastReports(prev => [insertedData, ...prev]);
        }
        
        const hasDanger = resData.report.includes('불량');
        if (hasDanger) alert('⚠️ 위험 요소 발견! 안전 기여 보너스 10 EXP가 지급되었습니다.');
        
        const bonusExp = hasDanger ? 10 : 0;
        const gainedExp = (files.length * 5) + bonusExp; 
        const nextExp = exp + gainedExp;
        
        let tempExp = nextExp;
        let calculatedLevel = 1;
        let requiredExp = 100;
        
        while (tempExp >= requiredExp) {
          tempExp -= requiredExp;
          calculatedLevel++;
          requiredExp *= 2; 
        }

        if (calculatedLevel > level) {
          setShowLevelUpModal(true);
          confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#2563eb', '#ec1c24', '#f59e0b'] });
          setTimeout(() => setShowLevelUpModal(false), 5000);
        }

        setExp(nextExp);
        setLevel(calculatedLevel);
        await supabase.from('workers').update({ exp: nextExp, level: calculatedLevel }).eq('id', workerId);
      }
    } catch (error: any) {
      console.error(error);
      const errMsg = error.message || 'AI 분석 중 알 수 없는 오류가 발생했습니다.';
      alert(`오류 발생: ${errMsg}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleUpdateReport = async () => {
    setIsEditing(false); 
    if (currentReportId && report) {
      const { error } = await supabase.from('inspections').update({ ai_report_text: report }).eq('id', currentReportId);
      if (error) {
        console.error('보고서 수정 실패:', error);
        alert('보고서 수정 내역을 저장하는데 실패했습니다.');
        return;
      }
      setPastReports(prev => prev.map(item => item.id === currentReportId ? { ...item, ai_report_text: report } : item));
    }
  };

  const handlePrintPast = (item: any) => {
    setPrintItem(item);
    setTimeout(() => {
      window.print();
      setPrintItem(null);
    }, 100);
  };

  const MarkdownComponents = {
    table: ({node, ...props}: any) => <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', border: '1.5px solid #000' }} {...props} /></div>,
    th: ({node, ...props}: any) => <th style={{ border: '1px solid #000', background: '#f8fafc', padding: '10px', textAlign: 'center', fontWeight: 'bold', fontSize: '13px', wordBreak: 'keep-all', color: '#000' }} {...props} />,
    td: ({node, ...props}: any) => <td style={{ border: '1px solid #000', padding: '10px', fontSize: '13px', wordBreak: 'keep-all', textAlign: 'center', color: '#000' }} {...props} />,
    h3: ({node, ...props}: any) => <h3 style={{ fontSize: '18px', color: '#000', marginTop: '20px', marginBottom: '12px', textAlign: 'center', fontWeight: 'bold' }} {...props} />,
    h4: ({node, ...props}: any) => <div style={{ textAlign: 'center', fontSize: '16px', fontWeight: 'bold', margin: '20px 0 10px 0', color: '#000' }} {...props} />,
    ul: ({node, ...props}: any) => <ul style={{ paddingLeft: '20px', margin: '8px 0', textAlign: 'left', color: '#000' }} {...props} />,
  };

  return (
    <div style={{ width: '100%', maxWidth: '640px', margin: '0 auto', padding: '16px', boxSizing: 'border-box', fontFamily: 'sans-serif', position: 'relative' }}>
      
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes popIn { 0% { transform: scale(0.8); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        
        @media print {
          body * { visibility: hidden; }
          .print-target, .print-target * { visibility: visible; }
          .print-target { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; box-shadow: none; border: none; }
          .no-print { display: none !important; }
        }
      `}} />

      {showLevelUpModal && (
        <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '20px', textAlign: 'center', animation: 'popIn 0.5s ease-out', margin: '20px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ fontSize: '60px', marginBottom: '16px' }}>🎉</div>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#2563eb', marginBottom: '8px' }}>축하합니다!</h2>
            <p style={{ fontSize: '18px', color: '#334155', marginBottom: '24px' }}>새로운 레벨 <span style={{ color: '#ec1c24', fontWeight: 'bold' }}>Lv.{level}</span> 달성!</p>
            <button onClick={() => setShowLevelUpModal(false)} style={{ width: '100%', padding: '14px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>확인</button>
          </div>
        </div>
      )}

      {analyzing && (
        <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '60px', height: '60px', border: '5px solid rgba(255,255,255,0.2)', borderTop: '5px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '24px' }} />
          <p style={{ color: 'white', fontSize: '18px', fontWeight: 'bold', letterSpacing: '0.5px' }}>Vision AI가 위험 요소를 분석 중입니다...</p>
        </div>
      )}

      {/* ★ 프로필 및 시즌 표시 영역 */}
      <div className="no-print" style={{ padding: '16px', borderRadius: '12px', background: '#f1f5f9', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px', boxSizing: 'border-box' }}>
        <div style={{ fontSize: '36px', padding: '8px', background: 'white', borderRadius: '50%', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          {level === 1 ? '🐣' : level < 3 ? '👷' : '🦸‍♂️'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <h2 style={{ margin: 0, fontSize: '16px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{workerName}</h2>
            <span style={{ fontSize: '11px', background: '#3b82f6', color: 'white', padding: '2px 6px', borderRadius: '8px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
              {currentYear}년 {currentQuarter}분기 시즌
            </span>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span style={{ fontWeight: 'bold', color: '#2563eb', fontSize: '14px' }}>Lv. {level}</span>
            <div style={{ flex: 1, height: '12px', background: '#e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(exp % 100, 100)}%`, height: '100%', background: '#3b82f6', transition: 'width 0.3s ease' }} />
            </div>
            <span style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>{exp} EXP</span>
          </div>
        </div>
        
        <button 
          onClick={handleLogout} 
          style={{ padding: '8px 12px', fontSize: '13px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap', transition: 'background-color 0.2s' }}
        >
          로그아웃
        </button>
      </div>

      <div className="no-print" style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', color: '#1e293b' }}>📝 보고서 사전 정보 입력</h3>
        
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#475569', marginBottom: '4px' }}>공사번호</label>
          <input 
            type="text" 
            value={projectNumberInput} 
            onChange={(e) => setProjectNumberInput(e.target.value)}
            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#475569', marginBottom: '4px' }}>작업공정</label>
          <input 
            type="text" 
            value={workTypeInput} 
            onChange={(e) => setWorkTypeInput(e.target.value)}
            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#475569', marginBottom: '4px' }}>작업 내용</label>
          <input 
            type="text" 
            value={workDescInput} 
            onChange={(e) => setWorkDescInput(e.target.value)}
            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
          />
        </div>
      </div>

      <div className="no-print" style={{ marginBottom: '16px' }}>
        <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 20px', background: '#ffffff', borderRadius: '12px', cursor: 'pointer', border: '2px dashed #94a3b8', width: '100%', boxSizing: 'border-box' }}>
          <span style={{ fontSize: '32px', marginBottom: '12px' }}>📸</span>
          <span style={{ fontWeight: 'bold', color: '#334155', fontSize: '16px' }}>터치하여 현장 사진 추가하기</span>
          <span style={{ fontSize: '13px', color: '#94a3b8', marginTop: '8px' }}>자동 오프라인 임시 저장 지원</span>
          <input type="file" accept="image/*" multiple onChange={handleFileChange} style={{ display: 'none' }} />
        </label>
        
        {previewUrls.length > 0 && (
          <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', padding: '12px 0' }}>
            {previewUrls.map((url, idx) => (
              <div key={idx} style={{ position: 'relative', flexShrink: 0 }}>
                <img src={url} alt={`미리보기 ${idx+1}`} style={{ height: '100px', width: '100px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #e2e8f0' }} />
                <button onClick={() => removeFile(idx)} style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <button className="no-print" onClick={handleUploadAndAnalyze} disabled={analyzing || files.length === 0} style={{ width: '100%', padding: '16px', fontSize: '16px', fontWeight: 'bold', color: '#ffffff', backgroundColor: analyzing ? '#94a3b8' : (files.length === 0 ? '#cbd5e1' : '#2563eb'), border: 'none', borderRadius: '12px', cursor: analyzing || files.length === 0 ? 'not-allowed' : 'pointer', boxSizing: 'border-box' }}>
        선택된 사진 {files.length}장 일괄 분석하기
      </button>

      {report && (
        <div className={printItem ? "no-print" : "print-target"} style={{ marginTop: '24px', padding: '20px', borderRadius: '12px', background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
          <h3 className="no-print" style={{ marginTop: 0, paddingBottom: '12px', borderBottom: '2px solid #f1f5f9', fontSize: '16px', color: '#0f172a', textAlign: 'left' }}>📋 실시간 점검 완료</h3>

          {isEditing ? (
            <div className="no-print" style={{ marginBottom: '20px' }}>
              <textarea
                value={report}
                onChange={(e) => setReport(e.target.value)}
                style={{ width: '100%', minHeight: '350px', padding: '16px', borderRadius: '8px', border: '2px solid #3b82f6', outline: 'none', fontSize: '14px', fontFamily: 'monospace', lineHeight: '1.6', resize: 'vertical', boxSizing: 'border-box' }}
              />
              <button onClick={handleUpdateReport} style={{ marginTop: '12px', width: '100%', padding: '14px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer' }}>
                저장 및 수정 완료
              </button>
            </div>
          ) : (
            <>
              <div className="print-only" style={{ textAlign: 'center', borderBottom: '2px solid #2563eb', paddingBottom: '10px', marginBottom: '20px' }}>
                <h1 style={{ margin: 0, fontSize: '24px', color: '#0f172a' }}>현장 안전점검 보고서</h1>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '16px', color: '#1e293b', marginBottom: '12px' }}>■ 현장 촬영 사진 ({previewUrls.length}장)</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
                  {previewUrls.map((url, idx) => (
                    <img key={idx} src={url} alt={`현장사진 ${idx+1}`} style={{ width: '100%', maxWidth: '400px', objectFit: 'contain', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                  ))}
                </div>
              </div>

              <div ref={reportRef} style={{ color: '#000', lineHeight: '1.6', fontSize: '14px', wordBreak: 'keep-all' }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>{report}</ReactMarkdown>
              </div>

              <div className="no-print" style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button onClick={() => setIsEditing(true)} style={{ flex: 1, padding: '14px', background: '#f8fafc', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '12px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer', boxSizing: 'border-box' }}>
                  📝 텍스트 수정하기
                </button>
                <button onClick={() => window.print()} style={{ flex: 1, padding: '14px', background: '#10b981', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer', boxSizing: 'border-box' }}>
                  🖨️ PDF로 저장하기
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="no-print" style={{ marginTop: '32px' }}>
        <button 
          onClick={() => setShowPast(!showPast)} 
          style={{ width: '100%', padding: '16px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', fontWeight: 'bold', color: '#334155', fontSize: '15px', display: 'flex', justifyContent: 'space-between', cursor: 'pointer', boxSizing: 'border-box' }}
        >
          <span>🗂 내 과거 점검 기록 보기 ({pastReports.length}건)</span>
          <span>{showPast ? '▲' : '▼'}</span>
        </button>
        
        {showPast && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '16px' }}>
            {pastReports.length === 0 ? (
              <div style={{ padding: '30px 20px', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                아직 저장된 과거 점검 기록이 없습니다.<br/>새로운 현장 사진을 분석해보세요!
              </div>
            ) : (
              pastReports.map((item, idx) => (
                <div key={idx} style={{ padding: '20px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                  <div style={{ fontSize: '13px', color: '#2563eb', marginBottom: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>📅</span>
                      {new Date(item.created_at).toLocaleString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 점검 완료
                    </div>
                  </div>
                  {item.image_url ? (
                    <img src={item.image_url} alt="과거 점검 현장 사진" style={{ width: '100%', height: '220px', objectFit: 'cover', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '16px' }} />
                  ) : (
                    <div style={{ width: '100%', height: '120px', background: '#f1f5f9', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', marginBottom: '16px', fontSize: '14px' }}>📷 첨부된 현장 사진이 없습니다</div>
                  )}
                  <div style={{ fontSize: '14px', color: '#334155', wordBreak: 'keep-all', maxHeight: '200px', overflowY: 'auto', padding: '16px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9', marginBottom: '16px' }}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>
                      {item.ai_report_text || 'AI 보고서 내용이 데이터베이스에 존재하지 않습니다.'}
                    </ReactMarkdown>
                  </div>
                  <button onClick={() => handlePrintPast(item)} style={{ width: '100%', padding: '14px', background: '#1e293b', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', boxSizing: 'border-box' }}>
                    🖨️️ 이 보고서만 PDF로 저장
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {printItem && (
        <div className="print-target" style={{ padding: '20px', background: 'white' }}>
          <div style={{ color: '#000', lineHeight: '1.6', fontSize: '14px', wordBreak: 'keep-all' }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>
              {printItem.ai_report_text}
            </ReactMarkdown>
          </div>
          {printItem.image_url && (
            <div style={{ marginTop: '0px', border: '1.5px solid #000', borderTop: 'none' }}>
              <div style={{ textAlign: 'center', padding: '10px', borderBottom: '1px solid #000', fontWeight: 'bold', fontSize: '14px', backgroundColor: '#f8fafc', color: '#000' }}>
                현장사진
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0px', backgroundColor: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '15px' }}>
                  <img src={printItem.image_url} alt="과거 현장사진" style={{ width: '100%', maxHeight: '250px', objectFit: 'contain' }} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}

export default function Dashboard() {
  return <Suspense fallback={<div style={{ textAlign: 'center', padding: '40px' }}>대시보드를 로딩 중입니다...</div>}><DashboardContent /></Suspense>;
}