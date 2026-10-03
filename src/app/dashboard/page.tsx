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

  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchWorkerData = async () => {
      const { data } = await supabase
        .from('workers')
        .select('*')
        .eq('worker_name', workerName)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        setWorkerId(data.id);
        setLevel(data.level);
        setExp(data.exp);
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
      
      // 1. 첫 번째 사진의 촬영(마지막 수정) 일시
      const rawPhotoDate = new Date(firstFile.lastModified);
      const formattedPhotoDate = `${rawPhotoDate.getFullYear()}년 ${rawPhotoDate.getMonth() + 1}월 ${rawPhotoDate.getDate()}일 ${rawPhotoDate.getHours()}시 ${rawPhotoDate.getMinutes()}분`;

      // 2. 현재 버튼을 누른(보고서 작성) 일시
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
        await supabase.from('inspections').insert([
          { worker_id: workerId, image_url: imageUrl, ai_report_text: resData.report, status: '완료' },
        ]);
        
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
        alert('현재 AI 안전점검 서버 접속량이 많아 지연되고 있습니다. 잠시 후 다시 시도해주세요 🙇‍♂️');
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
      `<div style="margin-bottom: 15px; text-align: center;">
         <img src="${base64}" alt="현장사진 ${idx + 1}" style="max-width: 500px; border: 1px solid #ccc; padding: 5px;" />
       </div>`
    ).join('');

    const renderedHtml = reportRef.current.innerHTML;
    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>현장 안전점검 보고서</title>
        <style>
          body { font-family: 'Malgun Gothic', '맑은 고딕', sans-serif; line-height: 1.6; color: #000; }
          h3 { color: #1e293b; margin-top: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 20px; }
          th, td { border: 1px solid #94a3b8; padding: 10px; text-align: left; vertical-align: top; }
          th { background-color: #f1f5f9; font-weight: bold; }
          ul { margin-top: 5px; margin-bottom: 5px; }
        </style>
      </head>
      <body>
        <h1 style="text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 10px; margin-bottom: 30px;">
          현장 안전점검 자동화 보고서
        </h1>
        <h3>■ 현장 촬영 사진 (${files.length}장)</h3>
        ${imagesHtml}
        <hr style="margin: 30px 0; border: 0; border-top: 1px dashed #cbd5e1;" />
        ${renderedHtml}
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `현장_안전점검_보고서_${workerName}_${new Date().toISOString().slice(0,10)}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    // ★ 수정: 모바일 화면에서 좌우 여백이 꽉 차고 가로 스크롤이 안 생기도록 컨테이너 최적화
    <div style={{ width: '100%', maxWidth: '640px', margin: '0 auto', padding: '16px', boxSizing: 'border-box', fontFamily: 'sans-serif' }}>
      <style dangerouslySetInnerHTML={{ __html: `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}} />

      {/* 모바일 최적화: 프로필 카드 여백 및 폰트 사이즈 조정 */}
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

      {/* ★ 수정: 모바일 친화적인 대형 터치 영역으로 파일 업로드 UI 개편 */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 20px', background: '#ffffff', borderRadius: '12px', cursor: 'pointer', border: '2px dashed #94a3b8', width: '100%', boxSizing: 'border-box', transition: 'background-color 0.2s' }}>
          <span style={{ fontSize: '32px', marginBottom: '12px' }}>📸</span>
          <span style={{ fontWeight: 'bold', color: '#334155', fontSize: '16px' }}>터치하여 현장 사진 추가하기</span>
          <span style={{ fontSize: '13px', color: '#94a3b8', marginTop: '8px' }}>여러 장 선택 가능</span>
          <input type="file" accept="image/*" multiple onChange={handleFileChange} style={{ display: 'none' }} />
        </label>
        
        {previewUrls.length > 0 && (
          <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', padding: '12px 0' }}>
            {previewUrls.map((url, idx) => (
              <div key={idx} style={{ position: 'relative', flexShrink: 0 }}>
                <img src={url} alt={`미리보기 ${idx+1}`} style={{ height: '100px', width: '100px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #e2e8f0' }} />
                <button 
                  onClick={() => removeFile(idx)}
                  style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}
                >✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 분석 실행 버튼 */}
      <button
        onClick={handleUploadAndAnalyze}
        disabled={analyzing || files.length === 0}
        style={{
          width: '100%', padding: '16px', fontSize: '16px', fontWeight: 'bold', color: '#ffffff',
          backgroundColor: analyzing ? '#94a3b8' : (files.length === 0 ? '#cbd5e1' : '#2563eb'),
          border: 'none', borderRadius: '12px', cursor: analyzing || files.length === 0 ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxSizing: 'border-box'
        }}
      >
        {analyzing && <div style={{ width: '18px', height: '18px', border: '3px solid rgba(255,255,255,0.3)', borderTop: '3px solid white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />}
        {analyzing ? `AI가 사진을 분석 중입니다...` : '결과 보고서 발행하기'}
      </button>

      {/* AI 리포트 및 Word 다운로드 영역 */}
      {report && (
        <div style={{ marginTop: '24px' }}>
          <div style={{ padding: '20px', borderRadius: '12px', background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ marginTop: 0, paddingBottom: '12px', borderBottom: '2px solid #f1f5f9', fontSize: '16px', color: '#0f172a' }}>
              📋 실시간 AI 점검 보고서
            </h3>
            <div ref={reportRef} style={{ color: '#334155', lineHeight: '1.6', fontSize: '14px', wordBreak: 'keep-all' }}>
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  table: ({node, ...props}) => <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', margin: '16px 0', minWidth: '400px' }} {...props} /></div>,
                  th: ({node, ...props}) => <th style={{ border: '1px solid #cbd5e1', background: '#f8fafc', padding: '10px', textAlign: 'left', fontWeight: 'bold' }} {...props} />,
                  td: ({node, ...props}) => <td style={{ border: '1px solid #cbd5e1', padding: '10px' }} {...props} />,
                  h3: ({node, ...props}) => <h3 style={{ fontSize: '16px', color: '#1e293b', marginTop: '20px', marginBottom: '8px' }} {...props} />,
                  ul: ({node, ...props}) => <ul style={{ paddingLeft: '20px', margin: '8px 0' }} {...props} />,
                }}
              >
                {report}
              </ReactMarkdown>
            </div>
          </div>
          <button 
            onClick={exportToWord}
            style={{ marginTop: '16px', width: '100%', padding: '16px', background: '#10b981', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px', boxSizing: 'border-box' }}
          >
            💾 사진 포함 워드(.doc) 다운로드
          </button>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', marginTop: '40px' }}>대시보드를 로딩 중입니다...</div>}>
      <DashboardContent />
    </Suspense>
  );
}