'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import confetti from 'canvas-confetti';
import imageCompression from 'browser-image-compression';
import localforage from 'localforage';
import { useTheme } from '@/context/ThemeContext';
import exifr from 'exifr'; 

const ALLOWED_WORKERS = ['전소정', '김철수', '이영희', '박지민', '최동훈', '정유진', '강민재', '조수빈', '윤건우', '홍길동'];

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryWorker = searchParams.get('worker');

  const { isDarkMode, toggleTheme, workerName, setWorkerName, level, exp, setExpAndLevel } = useTheme();

  const [workerId, setWorkerId] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [isDataLoaded, setIsDataLoaded] = useState<boolean>(false);
  const [isPdfGenerating, setIsPdfGenerating] = useState<boolean>(false);
  
  const [gender, setGender] = useState<'M'|'F'>('M');
  const [dbTips, setDbTips] = useState<string[]>(['안전이 최우선입니다.']);
  const [loadingTip, setLoadingTip] = useState<string>('');
  
  const [projectNumberInput, setProjectNumberInput] = useState<string>('');
  const [workTypeInput, setWorkTypeInput] = useState<string>('');
  const [workDescInput, setWorkDescInput] = useState<string>('');

  const [report, setReport] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [currentReportId, setCurrentReportId] = useState<string | null>(null);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);

  const [editForm, setEditForm] = useState([
    { name: '보호구 착용 상태', result: '', action: '', note: '' },
    { name: '안전표지 설치', result: '', action: '', note: '' },
    { name: '사다리 및 장비 상태', result: '', action: '', note: '' },
    { name: '적정 공법 적용 상태', result: '', action: '', note: '' },
    { name: '정리정돈 상태', result: '', action: '', note: '' },
  ]);
  const editFormRef = useRef(editForm);
  
  const [activeReports, setActiveReports] = useState<any[]>([]);
  const [trashedReports, setTrashedReports] = useState<any[]>([]);
  const [showPast, setShowPast] = useState<boolean>(false);
  const [showTrash, setShowTrash] = useState<boolean>(false); 
  
  const [showLevelUpModal, setShowLevelUpModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');

  const [printItem, setPrintItem] = useState<any>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const theme = isDarkMode ? {
    bg: '#0f172a', cardBg: '#1e293b', textMain: '#f8fafc', textSub: '#94a3b8',
    border: '#334155', inputBg: '#0f172a', mdTableHead: '#334155', btnCancel: '#334155'
  } : {
    bg: '#f8fafc', cardBg: '#ffffff', textMain: '#0f172a', textSub: '#475569',
    border: '#cbd5e1', inputBg: '#f8fafc', mdTableHead: '#f1f5f9', btnCancel: '#e2e8f0'
  };

  const todayDate = new Date();
  const todayStr = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`;

  const buildMarkdownFromForm = (originalMd: string, currentForm: any[]) => {
    const parts = originalMd.split('#### ■ 안전점검 항목');
    if (parts.length < 2) return originalMd;
    const topPart = parts[0];
    const bottomPart = `#### ■ 안전점검 항목\n| 점검항목 | 결과(양호/불량) | 조치사항 | 비고 |\n|---|---|---|---|\n` + 
      currentForm.map(item => `| ${item.name} | ${item.result || '( )'} | ${item.action || '( )'} | ${item.note || '( )'} |`).join('\n');
    return topPart + bottomPart;
  };

  useEffect(() => {
    let current = queryWorker || workerName;
    if (queryWorker && ALLOWED_WORKERS.includes(queryWorker)) {
      setWorkerName(queryWorker);
      current = queryWorker;
    }

    if (!ALLOWED_WORKERS.includes(current)) {
      alert('접근 권한이 없습니다.'); 
      router.push('/'); 
      return;
    }

    const savedGender = localStorage.getItem(`kt_gender_${current}`);
    if (savedGender === 'F') setGender('F');

    const fetchTips = async () => {
      const { data } = await supabase.from('safety_tips').select('content').eq('is_active', true);
      if (data && data.length > 0) setDbTips(data.map(item => item.content));
    };
    fetchTips();
  }, [queryWorker, router, workerName, setWorkerName]);

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
    if (!workerName || workerName === '작업자') return;

    const loadData = async () => {
      try {
        const savedFiles = await localforage.getItem<File[]>('pending_photos');
        if (savedFiles && savedFiles.length > 0) { 
          setFiles(savedFiles); 
          setPreviewUrls(savedFiles.map(file => URL.createObjectURL(file))); 
        }

        let { data: workerData } = await supabase.from('workers').select('*').eq('worker_name', workerName).maybeSingle();

        if (!workerData) {
          const { data: newWorker } = await supabase.from('workers').insert([{ worker_name: workerName, exp: 0, level: 1, password: '1234' }]).select().single();
          if (newWorker) workerData = newWorker;
        }

        if (workerData) {
          setWorkerId(workerData.id);
          setExpAndLevel(workerData.exp || 0, workerData.level || 1);

          const { data: reportsData } = await supabase.from('inspections').select('*').eq('worker_id', workerData.id).order('created_at', { ascending: false });
          if (reportsData) {
            setActiveReports(reportsData.filter(r => !r.deleted_at));
            setTrashedReports(reportsData.filter(r => r.deleted_at));
          }
        }
      } catch (err) {
        console.error('데이터 로딩 에러:', err);
      } finally {
        setIsDataLoaded(true);
      }
    };

    loadData();
    const timer = setTimeout(() => setIsDataLoaded(true), 3000);
    return () => clearTimeout(timer);
  }, [workerName, setExpAndLevel]);

  const handleSoftDelete = async (id: string) => {
    if (!window.confirm('휴지통으로 이동하시겠습니까?\n(7일 후 데이터베이스에서 완전히 삭제됩니다)')) return;
    try {
      const now = new Date().toISOString();
      await supabase.from('inspections').update({ deleted_at: now }).eq('id', id);
      
      const itemToMove = activeReports.find(r => r.id === id);
      if (itemToMove) {
        setActiveReports(prev => prev.filter(r => r.id !== id));
        setTrashedReports(prev => [{ ...itemToMove, deleted_at: now }, ...prev].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      }
      setExpandedReportId(null);
    } catch (err) {
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const handleRestore = async (id: string) => {
    if (!window.confirm('이 보고서를 다시 정상 기록으로 복구하시겠습니까?')) return;
    try {
      await supabase.from('inspections').update({ deleted_at: null }).eq('id', id);
      
      const itemToMove = trashedReports.find(r => r.id === id);
      if (itemToMove) {
        setTrashedReports(prev => prev.filter(r => r.id !== id));
        setActiveReports(prev => [{ ...itemToMove, deleted_at: null }, ...prev].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      }
      setExpandedReportId(null);
    } catch (err) {
      alert('복구 중 오류가 발생했습니다.');
    }
  };

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

  const handleFormChange = (index: number, field: string, value: string) => {
    const newForm = [...editForm]; (newForm[index] as any)[field] = value; setEditForm(newForm);
  };

  const handleStartEdit = () => {
    if (report) parseMarkdownToForm(report);
    setIsEditing(true); setLastSavedTime(null);
  };

  const handleUpdateReport = async () => {
    setIsEditing(false); 
    if (currentReportId && report) {
      await supabase.from('inspections').update({ ai_report_text: report }).eq('id', currentReportId);
      setActiveReports(prev => prev.map(item => item.id === currentReportId ? { ...item, ai_report_text: report } : item));
      localStorage.removeItem(`kt_autosave_${currentReportId}`);
      setLastSavedTime(null);
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ['#26ccff', '#a25afd', '#ff5e7e', '#88ff5a', '#fcff42', '#ffa62d', '#ff36ff'] });
    }
  };

  const handleCancelEdit = () => {
    if (window.confirm('수정을 취소하시겠습니까? 저장되지 않은 내용은 사라집니다.')) {
      setIsEditing(false); setLastSavedTime(null);
      if (currentReportId) {
        localStorage.removeItem(`kt_autosave_${currentReportId}`);
        const originalItem = activeReports.find(item => item.id === currentReportId);
        if (originalItem) setReport(originalItem.ai_report_text);
      }
    }
  };

  const handleCapturePDF = async () => {
    const element = reportRef.current;
    if (!element) return;
    const html2pdf = (await import('html2pdf.js')).default;
    
    const d = new Date();
    const dateString = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const timeString = `${String(d.getHours()).padStart(2, '0')}시${String(d.getMinutes()).padStart(2, '0')}분`;
    
    const opt = {
      margin: 10,
      filename: `현장점검기록_${dateString}_${timeString}_${workerName}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: isDarkMode ? '#1e293b' : '#ffffff' },
      jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
      pagebreak: { mode: 'css' }
    };
    html2pdf().set(opt).from(element).save();
  };

  const handleDownloadPastPDF = async (item: any) => {
    setIsPdfGenerating(true);
    setPrintItem(item); 
    
    setTimeout(async () => {
      const element = document.getElementById('past-report-pdf');
      if (!element) {
        setIsPdfGenerating(false);
        return;
      }
      
      const images = Array.from(element.getElementsByTagName('img'));
      await Promise.all(images.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
          img.onload = resolve;
          img.onerror = resolve; 
        });
      }));

      const d = new Date(item.created_at);
      const dateString = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const timeString = `${String(d.getHours()).padStart(2, '0')}시${String(d.getMinutes()).padStart(2, '0')}분`;

      const html2pdf = (await import('html2pdf.js')).default;
      const opt = {
        margin: 15, 
        filename: `현장점검기록_${dateString}_${timeString}_${workerName}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
        pagebreak: { mode: ['css', 'legacy'] } 
      };

      html2pdf().set(opt).from(element).save().then(() => {
        setPrintItem(null); 
        setIsPdfGenerating(false); 
      });
    }, 100); 
  };

  const handlePrintPastReport = async (item: any) => {
    setIsPdfGenerating(true);
    setPrintItem(item); 
    
    setTimeout(async () => {
      const element = document.getElementById('past-report-pdf');
      if (element) {
        const images = Array.from(element.getElementsByTagName('img'));
        await Promise.all(images.map(img => {
          if (img.complete) return Promise.resolve();
          return new Promise(resolve => {
            img.onload = resolve;
            img.onerror = resolve; 
          });
        }));
      }
      setIsPdfGenerating(false);
      setTimeout(() => {
        window.print();
        setPrintItem(null);
      }, 300);
    }, 100);
  };

  const toggleGender = () => { const newGender = gender === 'M' ? 'F' : 'M'; setGender(newGender); localStorage.setItem(`kt_gender_${workerName}`, newGender); };
  
  const getCharacterImage = () => {
    if (level === 1) return gender === 'M' ? '/characters/level1_m.png' : '/characters/level1_f.png'; 
    if (level < 3) return gender === 'M' ? '/characters/level2_m.png' : '/characters/level2_f.png';
    return gender === 'M' ? '/characters/level3_m.png' : '/characters/level3_f.png'; 
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault(); if (!oldPwd || !newPwd) return alert('모두 입력해주세요.');
    const { data } = await supabase.from('workers').select('password').eq('id', workerId).single();
    if (data?.password !== oldPwd) return alert('현재 비밀번호가 일치하지 않습니다.');
    await supabase.from('workers').update({ password: newPwd }).eq('id', workerId);
    alert('비밀번호가 성공적으로 변경되었습니다.'); setShowSettingsModal(false); setOldPwd(''); setNewPwd('');
  };
  
  const handleLogout = () => { 
    if(window.confirm('정말 로그아웃 하시겠습니까?')) {
      localStorage.removeItem('kt_current_worker');
      router.push('/'); 
    }
  };
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      const compressedFiles = await Promise.all(newFiles.map(async (f) => { 
        try { 
          return await imageCompression(f, { 
            maxSizeMB: 0.3, 
            maxWidthOrHeight: 1024, 
            initialQuality: 0.7, 
            useWebWorker: true,
            preserveExif: true 
          }); 
        } catch { return f; } 
      }));
      const currentSaved = await localforage.getItem<File[]>('pending_photos') || []; const newTotalFiles = [...currentSaved, ...compressedFiles];
      await localforage.setItem('pending_photos', newTotalFiles);
      setFiles(newTotalFiles); setPreviewUrls(newTotalFiles.map(f => URL.createObjectURL(f))); setReport(null); setIsEditing(false);
    }
  };

  const removeFile = async (idx: number) => {
    const newFiles = files.filter((_, i) => i !== idx);
    await localforage.setItem('pending_photos', newFiles);
    setFiles(newFiles); setPreviewUrls(newFiles.map(f => URL.createObjectURL(f)));
  };
  
  const handleUploadAndAnalyze = async () => {
    if (files.length === 0) return alert('사진을 추가해주세요!');
    
    let currentWorkerId = workerId;
    if (!currentWorkerId) {
      const { data: tempWorker } = await supabase.from('workers').select('id').eq('worker_name', workerName).maybeSingle();
      if (tempWorker) {
        currentWorkerId = tempWorker.id;
        setWorkerId(tempWorker.id);
      } else {
        const { data: newW } = await supabase.from('workers').insert([{ worker_name: workerName, exp: 0, level: 1, password: '1234' }]).select().single();
        if (newW) {
          currentWorkerId = newW.id;
          setWorkerId(newW.id);
        }
      }
    }

    if (!currentWorkerId) return alert('작업자 계정 연동 중 오류 발생');

    setAnalyzing(true); setReport(null); setIsEditing(false);
    try {
      const uploadedUrls: string[] = [];
      
      for (const f of files) {
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${f.name ? f.name.split('.').pop() : 'png'}`;
        const { error: uploadError } = await supabase.storage.from('inspections').upload(fileName, f);
        
        if (uploadError) {
          throw new Error('스토리지 사진 저장 실패');
        }
        
        const { data } = supabase.storage.from('inspections').getPublicUrl(fileName);
        if (data?.publicUrl) {
          uploadedUrls.push(data.publicUrl);
        }
      }
      
      const imageUrlsString = uploadedUrls.join(',');

      const rawDate = new Date(files[0].lastModified); 
      const photoDateStr = `${rawDate.getFullYear()}년 ${rawDate.getMonth() + 1}월 ${rawDate.getDate()}일`;
      
      // ★ 카카오 API를 활용한 완벽한 한글 주소 추출 로직
      let finalLocationData = '위치 정보 없음';
      try {
        for (const f of files) {
          const loc = await exifr.gps(f);
          if (loc) {
            const lat = loc.latitude;
            const lng = loc.longitude;
            
            // 환경 변수에서 카카오 REST API 키 불러오기
            const kakaoKey = process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY;
            
            if (kakaoKey) {
              // 카카오 API 호출: x 파라미터에 경도, y 파라미터에 위도 배치
              const kakaoRes = await fetch(`https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${lng}&y=${lat}`, {
                headers: { Authorization: `KakaoAK ${kakaoKey}` }
              });
              
              if (kakaoRes.ok) {
                const kakaoData = await kakaoRes.json();
                if (kakaoData.documents && kakaoData.documents.length > 0) {
                  const doc = kakaoData.documents[0];
                  // 도로명 주소(road_address)가 있으면 최우선 적용, 없으면 지번 주소(address) 적용
                  const addressName = doc.road_address?.address_name || doc.address?.address_name;
                  finalLocationData = addressName || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
                } else {
                  finalLocationData = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
                }
              } else {
                finalLocationData = `${lat.toFixed(6)}, ${lng.toFixed(6)}`; // API 실패 시 좌표 폴백
              }
            } else {
              finalLocationData = `${lat.toFixed(6)}, ${lng.toFixed(6)}`; // 키 미설정 시 좌표 폴백
            }
            break; // 여러 장의 사진 중 첫 번째 사진에서 주소를 성공적으로 뽑으면 반복문 종료
          }
        }
      } catch (err) {
        console.log('GPS 추출 및 주소 변환 실패', err);
      }

      const formData = new FormData(); 
      files.forEach(f => formData.append('images', f)); 
      formData.append('photoDate', photoDateStr); 
      formData.append('photoLocation', finalLocationData); 
      formData.append('projectNumber', projectNumberInput || '미입력'); 
      formData.append('workType', workTypeInput || '미입력'); 
      formData.append('workDesc', workDescInput || '미입력'); 
      formData.append('inspector', workerName); 
      
      const res = await fetch('/api/analyze', { method: 'POST', body: formData }); 
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || '분석 실패');
      
      await localforage.removeItem('pending_photos'); 
      setFiles([]); 
      setReport(resData.report);
      
      const { data: insertedData, error: dbError } = await supabase.from('inspections').insert([
        { worker_id: currentWorkerId, image_url: imageUrlsString, ai_report_text: resData.report, status: '완료' }
      ]).select().single();
      
      if (dbError) throw new Error(`DB 저장 실패: ${dbError.message}`);

      if (insertedData) { 
        setCurrentReportId(insertedData.id); 
        setActiveReports(prev => [insertedData, ...prev]); 
      }
      
      const hasDanger = resData.report.includes('불량'); 
      if (hasDanger) alert('⚠️ 위험 요소 발견! 보너스 10 EXP 추가 지급');
      
      const gainedExp = (files.length * 5) + (hasDanger ? 10 : 0); 
      let tempExp = exp + gainedExp; let calcLevel = 1; let reqExp = 100;
      while (tempExp >= reqExp) { tempExp -= reqExp; calcLevel++; reqExp *= 2; }
      
      if (calcLevel > level) { 
        setShowLevelUpModal(true); 
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } }); 
        setTimeout(() => setShowLevelUpModal(false), 5000); 
      }
      
      setExpAndLevel(tempExp + (calcLevel > level ? 0 : tempExp), calcLevel);
      await supabase.from('workers').update({ exp: exp + gainedExp, level: calcLevel }).eq('id', currentWorkerId);
      
    } catch (err: any) { 
      alert(`오류 발생: ${err.message}`); 
    } finally { 
      setAnalyzing(false); 
    }
  };

  const mdComps = {
    table: (props: any) => <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', border: `1px solid ${theme.border}` }} {...props} /></div>,
    th: (props: any) => <th style={{ border: `1px solid ${theme.border}`, background: theme.mdTableHead, padding: '10px', textAlign: 'center', fontSize: '13px', color: theme.textMain }} {...props} />,
    td: (props: any) => <td style={{ border: `1px solid ${theme.border}`, padding: '10px', fontSize: '13px', textAlign: 'center', color: theme.textMain }} {...props} />,
    h3: (props: any) => <h3 style={{ fontSize: '18px', color: theme.textMain, marginTop: '20px', textAlign: 'center' }} {...props} />,
    h4: (props: any) => <div style={{ textAlign: 'center', fontSize: '16px', fontWeight: 'bold', margin: '20px 0 10px 0', color: theme.textMain }} {...props} />,
    ul: (props: any) => <ul style={{ paddingLeft: '20px', margin: '8px 0', color: theme.textMain }} {...props} />,
  };

  if (!isDataLoaded) {
    return <div style={{ padding: '60px', textAlign: 'center', fontFamily: "'Pretendard', sans-serif" }}>기록을 안전하게 불러오는 중입니다...</div>;
  }

  const displayReports = showTrash ? trashedReports : activeReports;

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '16px', fontFamily: "'Pretendard', sans-serif" }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes fadeInOut { 0% { opacity: 0; transform: translateY(10px); } 20% { opacity: 1; transform: translateY(0); } 80% { opacity: 1; transform: translateY(0); } 100% { opacity: 0; transform: translateY(-10px); } }
        .avoid-break { page-break-inside: avoid !important; break-inside: avoid !important; }
        @media screen { .print-only { display: none !important; } }
        @media print { 
          body, html { background-color: #fff !important; color: #000 !important; margin: 0; padding: 0; }
          body * { visibility: hidden; } 
          .print-area, .print-area * { visibility: visible; color: #000 !important; } 
          .print-area { position: absolute; left: 0; top: 0; width: 100%; } 
          .no-print { display: none !important; } 
        }
      `}} />

      {isPdfGenerating && (
        <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '60px', height: '60px', border: '5px solid rgba(255,255,255,0.2)', borderTop: '5px solid #10b981', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '24px' }} />
          <h3 style={{ color: 'white', fontSize: '18px', fontWeight: 'bold' }}>문서를 준비하고 있습니다...</h3>
          <p style={{ color: '#94a3b8', fontSize: '13px', marginTop: '10px' }}>(현장 사진 고화질 로딩 대기중)</p>
        </div>
      )}

      {showSettingsModal && (
        <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <form onSubmit={handleChangePassword} style={{ background: theme.cardBg, padding: '30px', borderRadius: '0', width: '90%', maxWidth: '320px', boxSizing: 'border-box', border: `1px solid ${theme.border}` }}>
            <h3 style={{ margin: '0 0 20px 0', textAlign: 'center', color: theme.textMain }}>비밀번호 변경</h3>
            <input type="password" placeholder="현재 비밀번호" value={oldPwd} onChange={e => setOldPwd(e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '0', border: `1px solid ${theme.border}`, boxSizing: 'border-box', background: theme.inputBg, color: theme.textMain }} />
            <input type="password" placeholder="새 비밀번호" value={newPwd} onChange={e => setNewPwd(e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '20px', borderRadius: '0', border: `1px solid ${theme.border}`, boxSizing: 'border-box', background: theme.inputBg, color: theme.textMain }} />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" onClick={() => setShowSettingsModal(false)} style={{ flex: 1, padding: '12px', background: theme.btnCancel, color: theme.textMain, border: 'none', borderRadius: '0', cursor: 'pointer' }}>취소</button>
              <button type="submit" style={{ flex: 1, padding: '12px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '0', cursor: 'pointer', fontWeight: 'bold' }}>저장</button>
            </div>
          </form>
        </div>
      )}

      {showLevelUpModal && (
        <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: theme.cardBg, padding: '40px', borderRadius: '0', textAlign: 'center', border: `1px solid ${theme.border}` }}><div style={{ fontSize: '60px' }}>🎉</div><h2 style={{ color: '#2563eb' }}>레벨 업! Lv.{level}</h2><button onClick={() => setShowLevelUpModal(false)} style={{ padding: '14px', background: '#2563eb', color: 'white', borderRadius: '0', border: 'none', width: '100%' }}>확인</button></div>
        </div>
      )}

      {analyzing && (
        <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', boxSizing: 'border-box' }}>
          <div style={{ width: '60px', height: '60px', border: '5px solid rgba(255,255,255,0.2)', borderTop: '5px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '24px' }} /><h3 style={{ color: '#60a5fa', fontSize: '15px', marginBottom: '16px', fontWeight: 'bold' }}>Vision AI 분석 중...</h3><div style={{ height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><p key={loadingTip} style={{ color: 'white', fontSize: '20px', fontWeight: 'bold', textAlign: 'center', animation: 'fadeInOut 1.5s ease-in-out forwards', margin: 0 }}>"{loadingTip}"</p></div>
        </div>
      )}

      <div className="no-print" style={{ padding: '16px', borderRadius: '0', background: theme.cardBg, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px', border: `1px solid ${theme.border}` }}>
        <div style={{ padding: '4px', background: 'transparent', position: 'relative', width: '90px', height: '90px', flexShrink: 0 }}>
          <img 
            src={getCharacterImage()} 
            alt="작업자 3D 캐릭터" 
            style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))', transform: 'scale(1.25)' }} 
          />
          <button 
            onClick={toggleGender} 
            style={{ position: 'absolute', bottom: '0px', right: '0px', background: '#475569', color: 'white', border: 'none', borderRadius: '50%', width: '28px', height: '28px', fontSize: '14px', cursor: 'pointer', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}
          >
            🔄
          </button>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '4px', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '16px', color: theme.textMain }}>{workerName}</h2><span style={{ fontSize: '11px', background: '#3b82f6', color: 'white', padding: '2px 6px', borderRadius: '0' }}>경기설계팀</span>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span style={{ color: '#2563eb', fontWeight: 'bold' }}>Lv.{level}</span>
            <div style={{ flex: 1, height: '10px', background: theme.btnCancel, borderRadius: '0' }}><div style={{ width: `${Math.min(exp % 100, 100)}%`, height: '100%', background: '#3b82f6' }} /></div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <button onClick={toggleTheme} style={{ padding: '6px 8px', background: theme.btnCancel, color: theme.textMain, borderRadius: '0', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>{isDarkMode ? '☀️ 밝게' : '🌙 어둡게'}</button>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button onClick={() => setShowSettingsModal(true)} style={{ flex: 1, padding: '6px 8px', background: theme.btnCancel, color: theme.textMain, borderRadius: '0', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>⚙️ 설정</button>
            <button onClick={handleLogout} style={{ flex: 1, padding: '6px 8px', background: '#ef4444', color: 'white', borderRadius: '0', border: 'none', cursor: 'pointer', fontSize: '12px' }}>로그아웃</button>
          </div>
        </div>
      </div>

      <div className="no-print" style={{ background: theme.cardBg, padding: '20px', borderRadius: '0', border: `1px solid ${theme.border}`, marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', color: theme.textMain }}>📝 사전 정보 입력</h3>
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', fontSize: '13px', color: theme.textSub, marginBottom: '6px', fontWeight: 'bold' }}>공사번호</label>
          <input type="text" value={projectNumberInput} onChange={e => setProjectNumberInput(e.target.value)} placeholder="예: 안산-설비-2026-0096" style={{ width: '100%', padding: '10px', borderRadius: '0', border: `1px solid ${theme.border}`, boxSizing: 'border-box', background: theme.inputBg, color: theme.textMain }} />
        </div>
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', fontSize: '13px', color: theme.textSub, marginBottom: '6px', fontWeight: 'bold' }}>작업공정</label>
          <input type="text" value={workTypeInput} onChange={e => setWorkTypeInput(e.target.value)} placeholder="예: 초고속 통신망 설비 점검" style={{ width: '100%', padding: '10px', borderRadius: '0', border: `1px solid ${theme.border}`, boxSizing: 'border-box', background: theme.inputBg, color: theme.textMain }} />
        </div>
        <div style={{ marginBottom: '4px' }}>
          <label style={{ display: 'block', fontSize: '13px', color: theme.textSub, marginBottom: '6px', fontWeight: 'bold' }}>작업내용</label>
          <input type="text" value={workDescInput} onChange={e => setWorkDescInput(e.target.value)} placeholder="예: 현장 안전 수칙 준수 및 자재 적재 상태 확인" style={{ width: '100%', padding: '10px', borderRadius: '0', border: `1px solid ${theme.border}`, boxSizing: 'border-box', background: theme.inputBg, color: theme.textMain }} />
        </div>
      </div>

      <div className="no-print" style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', textAlign: 'center', padding: '30px', background: theme.cardBg, border: `2px dashed ${theme.border}`, borderRadius: '0', cursor: 'pointer' }}>
          <div style={{ fontSize: '32px' }}>📸 사진 추가</div><input type="file" accept="image/*" multiple onChange={handleFileChange} style={{ display: 'none' }} />
        </label>
        {previewUrls.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '10px 0' }}>
            {previewUrls.map((url, i) => (<div key={i} style={{ position: 'relative' }}><img src={url} alt="미리보기" style={{ width: '80px', height: '80px', borderRadius: '0', objectFit: 'cover' }} /><button onClick={() => removeFile(i)} style={{ position: 'absolute', top: 0, right: 0, background: 'black', color: 'white', border: 'none' }}>X</button></div>))}
          </div>
        )}
      </div>

      <button className="no-print" onClick={handleUploadAndAnalyze} disabled={analyzing || files.length === 0} style={{ width: '100%', padding: '16px', background: files.length ? '#2563eb' : theme.btnCancel, color: files.length ? 'white' : theme.textSub, border: 'none', borderRadius: '0', cursor: 'pointer', fontWeight: 'bold' }}>일괄 분석하기</button>

      {report && (
        <div className={printItem ? "no-print" : "print-area"} style={{ marginTop: '20px', padding: '20px', background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: '0' }}>
          {isEditing ? (
            <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ background: '#1e293b', padding: '16px', borderRadius: '0', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h4 style={{ color: '#60a5fa', margin: 0, fontSize: '15px' }}>💻 조치사항 간편 입력</h4>
                  {lastSavedTime && <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 'bold' }}>✓ {lastSavedTime}</span>}
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {editForm.map((item, i) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', background: '#334155', padding: '10px', borderRadius: '0', alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ width: '140px', color: 'white', fontSize: '13px', fontWeight: 'bold' }}>{item.name}</div>
                      <select value={item.result} onChange={e => handleFormChange(i, 'result', e.target.value)} style={{ padding: '8px', borderRadius: '0', border: 'none', outline: 'none', backgroundColor: '#f1f5f9', color: '#0f172a', fontWeight: 'bold' }}>
                        <option value="">(상태 선택)</option><option value="양호">양호</option><option value="불량">불량</option>
                      </select>
                      <input type="text" placeholder="조치사항 입력..." value={item.action} onChange={e => handleFormChange(i, 'action', e.target.value)} style={{ flex: 1, minWidth: '150px', padding: '8px', borderRadius: '0', border: 'none', outline: 'none', backgroundColor: '#f1f5f9', color: '#0f172a' }} />
                      <input type="text" placeholder="비고..." value={item.note} onChange={e => handleFormChange(i, 'note', e.target.value)} style={{ width: '80px', padding: '8px', borderRadius: '0', border: 'none', outline: 'none', backgroundColor: '#f1f5f9', color: '#0f172a' }} />
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={handleCancelEdit} style={{ flex: 1, padding: '14px', background: theme.btnCancel, color: theme.textMain, border: 'none', borderRadius: '0', fontWeight: 'bold', cursor: 'pointer' }}>취소</button>
                <button onClick={handleUpdateReport} style={{ flex: 2, padding: '14px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '0', fontWeight: 'bold', cursor: 'pointer' }}>저장 (마크다운 자동 변환)</button>
              </div>
            </div>
          ) : (
            <>
              <div ref={reportRef}>
                <h2 className="print-only" style={{ textAlign: 'center', fontSize: '24px', borderBottom: `2px solid #000`, paddingBottom: '16px', marginBottom: '24px', color: '#000' }}>
                  {todayStr} {workerName} 안전점검 보고서
                </h2>
                <ReactMarkdown components={mdComps} remarkPlugins={[remarkGfm]}>{report}</ReactMarkdown>
                {previewUrls.length > 0 && (
                  <div style={{ marginTop: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <h4 style={{ width: '100%', borderBottom: `1px solid ${theme.border}`, paddingBottom: '8px', margin: '20px 0 10px 0', color: theme.textMain }}>📸 현장 사진 (첨부)</h4>
                    {previewUrls.map((url, i) => (<img key={i} src={url} alt="첨부사진" className="avoid-break" style={{ width: '48%', maxHeight: '300px', objectFit: 'contain', borderRadius: '0', border: `1px solid ${theme.border}` }} />))}
                  </div>
                )}
              </div>
              
              <div className="no-print" style={{ display: 'flex', gap: '10px', marginTop: '20px', flexWrap: 'wrap' }}>
                <button onClick={handleStartEdit} style={{ flex: 1, minWidth: '100px', padding: '12px', cursor: 'pointer', borderRadius: '0', border: `1px solid ${theme.border}`, background: theme.btnCancel, color: theme.textMain, fontWeight: 'bold' }}>수정</button>
                <button onClick={() => window.print()} style={{ flex: 1, minWidth: '100px', padding: '12px', background: '#10b981', color: 'white', border: 'none', borderRadius: '0', cursor: 'pointer', fontWeight: 'bold' }}>흰 바탕 인쇄</button>
                <button onClick={handleCapturePDF} style={{ flex: 1, minWidth: '120px', padding: '12px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '0', cursor: 'pointer', fontWeight: 'bold' }}>다크모드 원본 캡처</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* 과거 기록 영역 */}
      <div className="no-print" style={{ marginTop: '30px' }}>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
          <button onClick={() => { setShowPast(!showPast); setShowTrash(false); }} style={{ flex: 1, padding: '16px', background: showPast && !showTrash ? '#2563eb' : theme.cardBg, border: `1px solid ${theme.border}`, color: showPast && !showTrash ? 'white' : theme.textMain, borderRadius: '0', cursor: 'pointer', fontWeight: 'bold' }}>
            과거 기록 보기 ({activeReports.length}건)
          </button>
          <button onClick={() => { setShowPast(true); setShowTrash(true); }} style={{ width: '120px', padding: '16px', background: showTrash ? '#ef4444' : theme.cardBg, border: `1px solid ${theme.border}`, color: showTrash ? 'white' : theme.textMain, borderRadius: '0', cursor: 'pointer', fontWeight: 'bold' }}>
            🗑️ 휴지통 ({trashedReports.length})
          </button>
        </div>

        {showPast && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {displayReports.length === 0 && (
              <div style={{ padding: '30px', textAlign: 'center', color: theme.textSub }}>{showTrash ? '휴지통이 비어있습니다.' : '저장된 과거 기록이 없습니다.'}</div>
            )}
            {displayReports.map((item, i) => {
              const isExpanded = expandedReportId === item.id;
              const hasDanger = item.ai_report_text?.includes('불량');
              const savedUrls = item.image_url ? item.image_url.split(',').filter(Boolean) : [];
              const reportDate = new Date(item.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });

              return (
                <div key={item.id} style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: '0', overflow: 'hidden' }}>
                  <div onClick={() => setExpandedReportId(isExpanded ? null : item.id)} style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: isExpanded ? theme.mdTableHead : 'transparent' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <strong style={{ color: theme.textMain, fontSize: '15px' }}>{reportDate} 점검</strong>
                      <span style={{ padding: '4px 8px', fontSize: '11px', background: hasDanger ? '#ef4444' : '#10b981', color: 'white', borderRadius: '4px', fontWeight: 'bold' }}>{hasDanger ? '⚠️ 위험요소 검출' : '✅ 전체 양호'}</span>
                    </div>
                    <span style={{ color: theme.textSub, fontSize: '13px', fontWeight: 'bold' }}>{isExpanded ? '▲ 접기' : '▼ 펼치기'}</span>
                  </div>

                  {isExpanded && (
                    <div style={{ padding: '24px', borderTop: `1px solid ${theme.border}` }}>
                      <div style={{ background: theme.bg, padding: '16px', borderRadius: '0' }}><ReactMarkdown components={mdComps} remarkPlugins={[remarkGfm]}>{item.ai_report_text || ''}</ReactMarkdown></div>
                      {savedUrls.length > 0 && (
                        <div style={{ marginTop: '20px' }}>
                          <h4 style={{ width: '100%', borderBottom: `1px solid ${theme.border}`, paddingBottom: '8px', margin: '0 0 16px 0', color: theme.textMain }}>📸 첨부된 현장 사진</h4>
                          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>{savedUrls.map((u: string, idx: number) => (<img key={idx} src={u} alt="사진" style={{ width: '48%', maxHeight: '300px', objectFit: 'contain', borderRadius: '0', border: `1px solid ${theme.border}` }} />))}</div>
                        </div>
                      )}
                      
                      <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                        {showTrash ? (
                          <button onClick={() => handleRestore(item.id)} style={{ flex: 1, padding: '14px', background: '#10b981', color: 'white', border: 'none', borderRadius: '0', cursor: 'pointer', fontWeight: 'bold' }}>♻️ 정상 기록으로 복구</button>
                        ) : (
                          <>
                            <button onClick={() => handlePrintPastReport(item)} style={{ flex: 1, padding: '14px', background: theme.btnCancel, color: theme.textMain, border: 'none', borderRadius: '0', cursor: 'pointer', fontWeight: 'bold' }}>인쇄</button>
                            <button onClick={() => handleDownloadPastPDF(item)} style={{ flex: 1, padding: '14px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '0', cursor: 'pointer', fontWeight: 'bold' }}>PDF 다운로드</button>
                            <button onClick={() => handleSoftDelete(item.id)} style={{ flex: 0.5, padding: '14px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '0', cursor: 'pointer', fontWeight: 'bold' }}>삭제</button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {printItem && (() => {
        const pastDate = new Date(printItem.created_at);
        const pastDateStr = `${pastDate.getFullYear()}-${String(pastDate.getMonth() + 1).padStart(2, '0')}-${String(pastDate.getDate()).padStart(2, '0')}`;
        
        return (
          <div className="print-area print-only" style={{ background: 'white', color: 'black', width: '100%' }}>
            <div id="past-report-pdf" style={{ padding: '40px', background: 'white', color: 'black', width: '100%', maxWidth: '800px', margin: '0 auto', boxSizing: 'border-box' }}>
              <h2 style={{ textAlign: 'center', fontSize: '24px', borderBottom: '2px solid black', paddingBottom: '16px', marginBottom: '24px', color: 'black' }}>
                {pastDateStr} {workerName} 안전점검 보고서
              </h2>
              <div style={{ color: 'black' }}><ReactMarkdown components={mdComps} remarkPlugins={[remarkGfm]}>{printItem.ai_report_text}</ReactMarkdown></div>
              {printItem.image_url && (
                <div style={{ marginTop: '30px', pageBreakInside: 'avoid' }}>
                  <h4 style={{ width: '100%', borderBottom: `2px solid black`, paddingBottom: '8px', margin: '20px 0 15px 0', color: 'black', fontSize: '18px' }}>📸 현장 사진 (첨부)</h4>
                  <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                    {printItem.image_url.split(',').filter(Boolean).map((u: string, i: number) => (<img key={i} src={u} crossOrigin="anonymous" className="avoid-break" style={{ width: '47%', height: '300px', objectFit: 'cover', border: `1px solid #ccc` }} alt="첨부사진" />))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default function Dashboard() { return <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center' }}>로딩중...</div>}><DashboardContent /></Suspense>; }