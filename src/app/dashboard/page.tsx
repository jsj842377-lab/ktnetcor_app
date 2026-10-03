'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function DashboardContent() {
  const searchParams = useSearchParams();
  const workerName = searchParams.get('worker') || '작업자';

  const [workerId, setWorkerId] = useState<string | null>(null);
  const [level, setLevel] = useState<number>(1);
  const [exp, setExp] = useState<number>(0);
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [report, setReport] = useState<string | null>(null);
  
  const [pastReports, setPastReports] = useState<any[]>([]);
  const [showPast, setShowPast] = useState<boolean>(false);

  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchWorkerData = async () => {
      const { data: workerData } = await supabase
        .from('workers')
        .select('*')
        .eq('worker_name', workerName)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (workerData) {
        setWorkerId(workerData.id);
        setLevel(workerData.level);
        setExp(workerData.exp);

        const { data: reportsData } = await supabase
          .from('inspections')
          .select('*')
          .eq('worker_id', workerData.id)
          .order('created_at', { ascending: false });
        
        if (reportsData) setPastReports(reportsData);
      }
    };
    if (workerName) fetchWorkerData();
  }, [workerName]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      const newUrls = newFiles.map(file => URL.createObjectURL(file));
      setFiles(prev => [...prev, ...newFiles]);
      setPreviewUrls(prev => [...prev, ...newUrls]);
      setReport(null);
    }
  };

  const removeFile = (indexToRemove: number) => {
    setFiles(prev => prev.filter((_, idx) => idx !== indexToRemove));
    setPreviewUrls(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleUploadAndAnalyze = async () => {
    if (files.length === 0) return alert('현장 점검 사진을 최소 1장 이상 선택해주세요!');

    setAnalyzing(true);
    setReport(null);

    try {
      const firstFile = files[0];
      
      const rawPhotoDate = new Date(firstFile.lastModified);
      const formattedPhotoDate = `${rawPhotoDate.getFullYear()}년 ${rawPhotoDate.getMonth() + 1}월 ${rawPhotoDate.getDate()}일 ${rawPhotoDate.getHours()}시 ${rawPhotoDate.getMinutes()}분`;

      const now = new Date();
      const formattedReportDate = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일 ${now.getHours()}시 ${now.getMinutes()}분`;

      const fileExt = firstFile.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `public/${fileName}`;

      await supabase.storage.from('inspections').upload(filePath, firstFile);
      const { data: publicUrlData } = supabase.storage.from('inspections').getPublicUrl(filePath);
      const imageUrl = publicUrlData?.publicUrl || '';

      const formData = new FormData();
      files.forEach((file) => formData.append('images', file));
      formData.append('photoDate', formattedPhotoDate);
      formData.append('reportDate', formattedReportDate);

      const response = await fetch('/api/analyze', { method: 'POST', body: formData });
      const resData = await response.json();
      
      if (!response.ok) throw new Error(resData.error || 'AI 분석 요청에 실패했습니다.');

      setReport(resData.report);

      if (workerId) {
        const newReportObj = { worker_id: workerId, image_url: imageUrl, ai_report_text: resData.report, status: '완료', created_at: new Date().toISOString() };
        await supabase.from('inspections').insert([
          { worker_id: workerId, image_url: imageUrl, ai_report_text: resData.report, status: '완료' }
        ]);
        
        setPastReports(prev => [newReportObj, ...prev]);
        
        const gainedExp = files.length * 50;
        const nextExp = exp + gainedExp;
        const nextLevel = Math.floor(nextExp / 100) + 1;

        setExp(nextExp);
        setLevel(nextLevel);
        await supabase.from('workers').update({ exp: nextExp, level: nextLevel }).eq('id', workerId);
      }
    } catch (error: any) {
      console.error(error);
      const errMsg = error.message?.toLowerCase() || '';
      if (errMsg.includes('503') || errMsg.includes('high demand') || errMsg.includes('unavailable')) {
        alert('현재 AI 서버 과부하로 지연 중입니다. 1~2분 뒤 다시 시도해주세요.');
      } else {
        alert('오류 발생: ' + error.message);
      }
    } finally {
      setAnalyzing(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const exportToWord = async () => {
    if (!report || !reportRef.current) return;
    const base64Images = await Promise.all(files.map(file => fileToBase64(file)));
    const imagesHtml = base64Images.map((base64, idx) => 
      `<div style="margin-bottom: 15px; text-align: center;"><img src="${base64}" alt="현장사진" style="max-width: 500px; border: 1px solid #ccc; padding: 5px;" /></div>`
    ).join('');
    const renderedHtml = reportRef.current.innerHTML;
    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>안전점검 보고서</title>
      <style>body { font-family: 'Malgun Gothic', sans-serif; line-height: 1.6; } table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid #94a3b8; padding: 10px; text-align: left; } th { background-color: #f1f5f9; }</style>
      </head><body><h1 style="text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">현장 안전점검 보고서</h1>
      <h3>■ 현장 촬영 사진 (${files.length}장)</h3>${imagesHtml}<hr />${renderedHtml}</body></html>`;
    const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `현장_안전점검_보고서_${workerName}_${new Date().toISOString().slice(0,10)}.doc`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const MarkdownComponents = {
    table: ({node, ...props}: any) => <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', margin: '16px 0', minWidth: '400px' }} {...props} /></div>,
    th: ({node, ...props}: any) => <th style={{ border: '1px solid #cbd5e1', background: '#f8fafc', padding: '10px', textAlign: 'left', fontWeight: 'bold' }} {...props} />,
    td: ({node, ...props}: any) => <td style={{ border: '1px solid #cbd5e1', padding: '10px' }} {...props} />,
    h3: ({node, ...props}: any) => <h3 style={{ fontSize: '16px', color: '#1e293b', marginTop: '20px', marginBottom: '8px' }} {...props} />,
    ul: ({node, ...props}: any) => <ul style={{ paddingLeft: '20px', margin: '8px 0' }} {...props} />,
  };

  return (
    <div style={{ width: '100%', maxWidth: '640px', margin: '0 auto', padding: '16px', boxSizing: 'border-box', fontFamily: 'sans-serif', position: 'relative' }}>
      
      {/* 1. 회전 애니메이션 전역 선언 */}
      <style dangerouslySetInnerHTML={{ __html: `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}} />

      {/* 2. 순수 CSS 로딩 스피너 및 오버레이 */}
      {analyzing && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '60px', height: '60px', border: '5px solid rgba(255,255,255,0.2)', borderTop: '5px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '24px' }} />
          <p style={{ color: 'white', fontSize: '18px', fontWeight: 'bold', letterSpacing: '0.5px' }}>
            Vision AI가 위험 요소를 분석 중입니다...
          </p>
          <p style={{ color: '#cbd5e1', fontSize: '14px', marginTop: '8px' }}>최대 10초 정도 소요될 수 있습니다</p>
        </div>
      )}

      {/* 상단 프로필 */}
      <div style={{ padding: '16px', borderRadius: '12px', background: '#f1f5f9', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px', boxSizing: 'border-box' }}>
        <div style={{ fontSize: '36px', padding: '8px', background: 'white', borderRadius: '50%', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          {level === 1 ? '🐣' : level < 3 ? '👷' : '🦸‍♂️'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '16px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{workerName} 작업자 대시보드</h2>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span style={{ fontWeight: 'bold', color: '#2563eb', fontSize: '14px' }}>Lv. {level}</span>
            <div style={{ flex: 1, height: '12px', background: '#e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(exp % 100, 100)}%`, height: '100%', background: '#3b82f6', transition: 'width 0.3s ease' }} />
            </div>
            <span style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>{exp} EXP</span>
          </div>
        </div>
      </div>

      {/* 사진 추가 영역 */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 20px', background: '#ffffff', borderRadius: '12px', cursor: 'pointer', border: '2px dashed #94a3b8', width: '100%', boxSizing: 'border-box' }}>
          <span style={{ fontSize: '32px', marginBottom: '12px' }}>📸</span>
          <span style={{ fontWeight: 'bold', color: '#334155', fontSize: '16px' }}>터치하여 현장 사진 추가하기</span>
          <input type="file" accept="image/*" multiple onChange={handleFileChange} style={{ display: 'none' }} />
        </label>
        
        {previewUrls.length > 0 && (
          <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', padding: '12px 0' }}>
            {previewUrls.map((url, idx) => (
              <div key={idx} style={{ position: 'relative', flexShrink: 0 }}>
                <img src={url} alt={`미리보기 ${idx}`} style={{ height: '100px', width: '100px', borderRadius: '8px', objectFit: 'cover' }} />
                <button onClick={() => removeFile(idx)} style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px' }}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 분석 실행 버튼 */}
      <button onClick={handleUploadAndAnalyze} disabled={analyzing || files.length === 0} style={{ width: '100%', padding: '16px', fontSize: '16px', fontWeight: 'bold', color: '#ffffff', backgroundColor: analyzing ? '#94a3b8' : (files.length === 0 ? '#cbd5e1' : '#2563eb'), border: 'none', borderRadius: '12px', cursor: analyzing || files.length === 0 ? 'not-allowed' : 'pointer' }}>
        결과 보고서 발행하기
      </button>

      {/* 방금 생성된 AI 리포트 출력 영역 */}
      {report && (
        <div style={{ marginTop: '24px', padding: '20px', borderRadius: '12px', background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
          <h3 style={{ marginTop: 0, paddingBottom: '12px', borderBottom: '2px solid #f1f5f9', fontSize: '16px', color: '#0f172a' }}>📋 실시간 점검 완료</h3>
          <div ref={reportRef} style={{ color: '#334155', lineHeight: '1.6', fontSize: '14px', wordBreak: 'keep-all' }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>{report}</ReactMarkdown>
          </div>
          <button onClick={exportToWord} style={{ marginTop: '16px', width: '100%', padding: '16px', background: '#10b981', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '16px' }}>
            💾 워드(.doc) 다운로드
          </button>
        </div>
      )}

      {/* 과거 점검 기록 카드 영역 */}
      <div style={{ marginTop: '32px' }}>
        <button 
          onClick={() => setShowPast(!showPast)} 
          style={{ width: '100%', padding: '16px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', fontWeight: 'bold', color: '#334155', fontSize: '15px', display: 'flex', justifyContent: 'space-between' }}
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
                  <div style={{ fontSize: '13px', color: '#2563eb', marginBottom: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>📅</span>
                    {new Date(item.created_at).toLocaleString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 점검 완료
                  </div>
                  {item.image_url ? (
                    <img src={item.image_url} alt="과거 점검 현장 사진" style={{ width: '100%', height: '220px', objectFit: 'cover', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '16px' }} />
                  ) : (
                    <div style={{ width: '100%', height: '120px', background: '#f1f5f9', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', marginBottom: '16px', fontSize: '14px' }}>
                      📷 첨부된 현장 사진이 없습니다
                    </div>
                  )}
                  <div style={{ fontSize: '14px', color: '#334155', wordBreak: 'keep-all', maxHeight: '300px', overflowY: 'auto', padding: '16px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>
                      {item.ai_report_text || 'AI 보고서 내용이 데이터베이스에 존재하지 않습니다.'}
                    </ReactMarkdown>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

    </div>
  );
}

export default function Dashboard() {
  return <Suspense fallback={<div>로딩 중...</div>}><DashboardContent /></Suspense>;
}