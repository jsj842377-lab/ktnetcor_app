'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTheme } from '@/context/ThemeContext';
import imageCompression from 'browser-image-compression';
import { supabase } from '@/utils/supabase';
import confetti from 'canvas-confetti';
import {
  Package,
  ShieldAlert,
  Camera,
  Upload,
  RotateCcw,
  Printer,
  Download,
  Bot,
  Sparkles,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Edit3,
  Layers,
  History,
  X,
  ExternalLink,
} from 'lucide-react';
import ImageLightbox from '@/components/ImageLightbox';
import { PhotoThumb } from '@/components/PhotoThumb';
import TechnicalTermInput from '@/components/TechnicalTermInput';
import AiSpecVerifyAssistant from '@/components/AiSpecVerifyAssistant';
import { saveReportAsText, saveReportAsHtml } from '@/utils/reportSaver';
import { renameUploadedPhotos } from '@/utils/photoRenamer';
import {
  MATERIAL_CHECK_ITEMS,
  MaterialCheckRow,
  extractMaterialInfoFromMarkdown,
  buildMaterialReportMarkdown,
  exportMaterialInspectionExcel,
} from '@/utils/materialReportMarkdown';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const MAX_PHOTOS = 5;

function MaterialInspectionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isDarkMode, toggleTheme } = useTheme();

  // ─────────────────────────────────────────────────────────────
  // [Step 1] 사전 정보 입력 (Metadata)
  // ─────────────────────────────────────────────────────────────
  const [projectNumber, setProjectNumber] = useState<string>('안산-설비-2026-0096');
  const [materialType, setMaterialType] = useState<string>('FR-CNCO-W 22kV 60㎟');
  const [photoLocation, setPhotoLocation] = useState<string>('안산 야외 적재장 A구역');
  const [inspector, setInspector] = useState<string>('전현진');
  const [photoDate, setPhotoDate] = useState<string>(new Date().toISOString().slice(0, 10));

  // ─────────────────────────────────────────────────────────────
  // [Step 2] 자재 사진 업로드 및 압축 (최대 5장)
  // ─────────────────────────────────────────────────────────────
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [isCompressing, setIsCompressing] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 자동 AI 분석 실행 토글 스위치 상태 (기본값 활성화)
  const [autoAnalyze, setAutoAnalyze] = useState<boolean>(true);

  // ─────────────────────────────────────────────────────────────
  // [Step 3] AI Vision 분석 및 결과보고서
  // ─────────────────────────────────────────────────────────────
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [reportMarkdown, setReportMarkdown] = useState<string | null>(null);
  const [reportInfo, setReportInfo] = useState<any>(null);
  const [activeCheckRows, setActiveCheckRows] = useState<MaterialCheckRow[]>([]);
  const [summaryNote, setSummaryNote] = useState<string>('');

  // 조치사항 및 비고 모달 편집 상태
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editingRowIdx, setEditingRowIdx] = useState<number>(0);
  const [editAction, setEditAction] = useState<string>('');
  const [editNote, setEditNote] = useState<string>('');

  // 과거 실사 기록 및 모달 상태
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);

  // 챗봇 어시스턴트 모달 열기 상태
  const [showChatAssistant, setShowChatAssistant] = useState<boolean>(false);

  // 탭 상태: 'form' (표준 5대 점검표 실사보고서) vs 'chat' (AI 실사 챗봇 어시스턴트 패널)
  const [activeTab, setActiveTab] = useState<'form' | 'chat'>('form');

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'chat') {
      setActiveTab('chat');
    }
  }, [searchParams]);

  // 라이트박스 상태
  const [lightboxOpen, setLightboxOpen] = useState<boolean>(false);
  const [lightboxIndex, setLightboxIndex] = useState<number>(0);

  // 테마 정의
  const theme = isDarkMode
    ? {
        bg: '#0f172a',
        cardBg: '#1e293b',
        border: '#334155',
        textMain: '#f8fafc',
        textSub: '#94a3b8',
        inputBg: '#0f172a',
        btnCancel: '#334155',
      }
    : {
        bg: '#f8fafc',
        cardBg: '#ffffff',
        border: '#e2e8f0',
        textMain: '#0f172a',
        textSub: '#64748b',
        inputBg: '#ffffff',
        btnCancel: '#f1f5f9',
      };

  // 작업자 세션 로드 및 과거 기록 복구
  useEffect(() => {
    const savedWorker = localStorage.getItem('kt_current_worker');
    const queryWorker = searchParams.get('worker');
    const currentWorker = queryWorker || savedWorker || '전현진';
    setInspector(currentWorker);

    try {
      const saved = localStorage.getItem('kt_material_inspections');
      if (saved) {
        setHistoryRecords(JSON.parse(saved));
      }
    } catch (e) {
      console.warn('과거 자재실사 기록 로드 실패:', e);
    }

    try {
      const savedAuto = localStorage.getItem('kt_auto_analyze_material');
      if (savedAuto !== null) {
        setAutoAnalyze(savedAuto === 'true');
      }
    } catch (e) {
      console.warn('자동 분석 설정 로드 실패:', e);
    }
  }, [searchParams]);

  // [Step 3] AI Vision 분석 요청 실행 코어 함수
  const executeMaterialAnalyze = async (targetPhotos: File[]) => {
    if (targetPhotos.length === 0) {
      alert('자재 사진을 최소 1장 이상 등록해주세요 (전체 모습, 라벨 표기 부위 등).');
      return;
    }

    setIsAnalyzing(true);

    // 사진 자동 리네이밍 적용
    const renamedPhotos = renameUploadedPhotos(targetPhotos, {
      projectNumber,
      date: photoDate || new Date(),
      includeEntropy: true,
    });

    const formData = new FormData();
    renamedPhotos.forEach((f) => formData.append('images', f));
    formData.append('projectNumber', projectNumber);
    formData.append('materialType', materialType);
    formData.append('photoLocation', photoLocation);
    formData.append('inspector', inspector);
    formData.append('photoDate', photoDate);

    try {
      const res = await fetch('/api/material-analyze', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || '자재실사 분석에 실패했습니다.');
      }

      setReportMarkdown(data.report);
      setReportInfo(data.info);
      setActiveCheckRows(data.info.checks);
      setSummaryNote(data.info.summaryNote);

      if (data.info.overallResultLabel === 'O (적합)') {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      }

      // 새 실사 기록 저장 (로컬스토리지 및 Supabase)
      const targetUrls = targetPhotos.map((f) => URL.createObjectURL(f));
      const newRec = {
        id: `mat-${Date.now()}`,
        project_number: projectNumber,
        material_type: materialType,
        photo_location: photoLocation,
        inspector,
        photo_date: photoDate,
        image_urls: targetUrls,
        ai_report_text: data.report,
        status: '완료',
        overall_result: data.info.overallResultLabel,
        created_at: new Date().toISOString(),
      };

      const updatedHistory = [newRec, ...historyRecords];
      setHistoryRecords(updatedHistory);
      try {
        localStorage.setItem('kt_material_inspections', JSON.stringify(updatedHistory));
      } catch (e) {
        console.warn('로컬 저장 실패:', e);
      }

      // Supabase 비동기 적재 (실패해도 로컬 보존)
      try {
        await supabase.from('material_inspections').insert([
          {
            project_number: projectNumber,
            material_type: materialType,
            ai_report_text: data.report,
            status: '완료',
          },
        ]);
      } catch (sbErr) {
        console.warn('Supabase 연동 생략 (로컬 데이터 우선):', sbErr);
      }
    } catch (err: any) {
      alert(`자재실사 분석 오류: ${err?.message || '잠시 후 다시 시도해주세요.'}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRunMaterialAnalyze = () => {
    executeMaterialAnalyze(photos);
  };

  // 사진 업로드 및 압축 (browser-image-compression 적용)
  const handlePhotoFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fl = e.target.files;
    if (!fl || fl.length === 0) return;

    const filesArray = Array.from(fl);
    const availableSlots = MAX_PHOTOS - photos.length;
    if (availableSlots <= 0) {
      alert(`사진은 최대 ${MAX_PHOTOS}장까지만 등록 가능합니다.`);
      return;
    }

    const targetFiles = filesArray.slice(0, availableSlots);
    setIsCompressing(true);

    try {
      const compressOptions = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1600,
        useWebWorker: true,
      };

      const compressedFiles = await Promise.all(
        targetFiles.map(async (file) => {
          try {
            return await imageCompression(file, compressOptions);
          } catch {
            return file; // 압축 실패 시 원본 유지
          }
        })
      );

      const combined = [...photos, ...compressedFiles].slice(0, MAX_PHOTOS);
      setPhotos(combined);
      setPhotoUrls(combined.map((f) => URL.createObjectURL(f)));

      // 사진이 5장 등록되는 즉시 자동으로 분석 시작 (스위치 활성화 시)
      if (autoAnalyze && combined.length >= MAX_PHOTOS) {
        setTimeout(() => {
          executeMaterialAnalyze(combined);
        }, 150);
      }
    } catch (err) {
      console.error('이미지 압축 실패:', err);
    } finally {
      setIsCompressing(false);
    }
  };

  // 사진 삭제
  const handleRemovePhoto = (idx: number) => {
    const nextPhotos = photos.filter((_, i) => i !== idx);
    setPhotos(nextPhotos);
    setPhotoUrls(nextPhotos.map((f) => URL.createObjectURL(f)));
  };

  // 조치사항 및 비고 저장
  const handleSaveCheckItemEdit = () => {
    const nextRows = [...activeCheckRows];
    nextRows[editingRowIdx] = {
      ...nextRows[editingRowIdx],
      action: editAction,
      note: editNote,
    };
    setActiveCheckRows(nextRows);

    if (reportMarkdown) {
      const updatedMd = buildMaterialReportMarkdown(reportMarkdown, nextRows, summaryNote);
      setReportMarkdown(updatedMd);
      const newInfo = extractMaterialInfoFromMarkdown(updatedMd);
      setReportInfo(newInfo);
    }
    setIsEditModalOpen(false);
  };

  // 엑셀 내보내기 (협력사관리_자재실사_2026년_Q4.xlsx 구조)
  const handleExportExcel = () => {
    if (historyRecords.length === 0 && !reportInfo) {
      alert('내보낼 자재실사 기록이 없습니다. 먼저 자재실사를 1건 이상 실행해주세요.');
      return;
    }

    const itemsToExport =
      historyRecords.length > 0
        ? historyRecords
        : [
            {
              photo_date: photoDate,
              inspector,
              project_number: projectNumber,
              material_type: materialType,
              photo_location: photoLocation,
              overall_result: reportInfo?.overallResultLabel || 'O (적합)',
            },
          ];

    const records = itemsToExport.map((item) => ({
      date: item.photo_date || item.created_at?.slice(0, 10) || photoDate,
      period: '오후',
      inspector: item.inspector || inspector,
      partnerName: '경기설계팀',
      projectNumber: item.project_number || projectNumber,
      materialType: item.material_type || materialType,
      photoLocation: item.photo_location || photoLocation,
      overallResult: item.overall_result || 'O (적합)',
    }));

    exportMaterialInspectionExcel(records);
  };

  return (
    <div style={{ minHeight: '100vh', background: theme.bg, color: theme.textMain }}>
      {/* 헤더 네비게이션 */}
      <header
        className="no-print"
        style={{
          background: theme.cardBg,
          borderBottom: `1px solid ${theme.border}`,
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}
      >
        <div
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* 좌측 로고 및 시스템 타이틀 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Link
              href="/dashboard"
              style={{
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: theme.textMain,
              }}
            >
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  background: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                }}
              >
                <Package size={20} />
              </div>
              <div>
                <div style={{ fontWeight: '800', fontSize: '15px' }}>자재실사 시스템</div>
                <div style={{ fontSize: '11px', color: theme.textSub }}>현장 자재 규격 및 외관 품질검수</div>
              </div>
            </Link>

            {/* 자재실사 대화형 엑셀 시스템 바로가기 배지 */}
            <Link
              href="/material-audit"
              style={{
                textDecoration: 'none',
                marginLeft: '10px',
                fontSize: '11.5px',
                padding: '4px 10px',
                background: isDarkMode ? '#1e293b' : '#eff6ff',
                color: '#2563eb',
                border: '1px solid #bfdbfe',
                borderRadius: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontWeight: 'bold',
              }}
            >
              <FileSpreadsheet size={13} />
              <span>대용량 엑셀 실사 연동</span>
            </Link>
          </div>

          {/* 중앙 네비게이션 탭 */}
          <nav style={{ display: 'flex', gap: '8px' }}>
            <Link
              href="/dashboard"
              style={{
                textDecoration: 'none',
                padding: '7px 12px',
                color: theme.textSub,
                fontSize: '13px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <ShieldAlert size={15} />
              <span>안전점검</span>
            </Link>
            <div
              style={{
                padding: '7px 14px',
                background: '#2563eb',
                color: '#fff',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <Package size={15} />
              <span>자재실사 (QC)</span>
            </div>
            <Link
              href="/admin"
              style={{
                textDecoration: 'none',
                padding: '7px 12px',
                color: theme.textSub,
                fontSize: '13px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <span>관리자 대시보드</span>
            </Link>
          </nav>

          {/* 우측 도구: 챗봇 어시스턴트 열기, 기록, 테마 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setShowChatAssistant(true)}
              style={{
                padding: '7px 12px',
                background: '#8b5cf6',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12.5px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                boxShadow: '0 2px 4px rgba(139,92,246,0.3)',
              }}
            >
              <Bot size={14} />
              <span>AI 사전 계측 챗봇</span>
            </button>

            <button
              onClick={() => setShowHistoryModal(true)}
              style={{
                padding: '7px 11px',
                background: theme.btnCancel,
                color: theme.textMain,
                border: `1px solid ${theme.border}`,
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <History size={13} />
              <span>기록 ({historyRecords.length})</span>
            </button>

            <button
              onClick={handleExportExcel}
              style={{
                padding: '7px 11px',
                background: '#10b981',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
              title="협력사관리_자재실사_2026년_Q4.xlsx 엑셀 다운로드"
            >
              <FileSpreadsheet size={13} />
              <span>엑셀 내보내기</span>
            </button>

            <button
              onClick={toggleTheme}
              style={{
                padding: '7px 10px',
                background: theme.btnCancel,
                color: theme.textMain,
                border: `1px solid ${theme.border}`,
                borderRadius: '6px',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              {isDarkMode ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
      </header>

      {/* 메인 작업 영역 */}
      <main style={{ maxWidth: '1280px', margin: '20px auto', padding: '0 20px' }}>
        {/* 모드 전환 탭: [표준 5대 검수 실사보고서] vs [AI 실사 챗봇 어시스턴트] */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setActiveTab('form')}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              border: activeTab === 'form' ? '2px solid #2563eb' : `1px solid ${theme.border}`,
              background: activeTab === 'form' ? (isDarkMode ? '#1e3a8a' : '#eff6ff') : theme.cardBg,
              color: activeTab === 'form' ? (isDarkMode ? '#93c5fd' : '#1d4ed8') : theme.textSub,
              fontWeight: 'bold',
              fontSize: '13.5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: activeTab === 'form' ? '0 2px 4px rgba(37,99,235,0.15)' : 'none',
            }}
          >
            <FileText size={16} />
            <span>📋 표준 5대 검수 실사보고서 모드</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              border: activeTab === 'chat' ? '2px solid #8b5cf6' : `1px solid ${theme.border}`,
              background: activeTab === 'chat' ? (isDarkMode ? '#3b0764' : '#f5f3ff') : theme.cardBg,
              color: activeTab === 'chat' ? (isDarkMode ? '#c4b5fd' : '#7c3aed') : theme.textSub,
              fontWeight: 'bold',
              fontSize: '13.5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: activeTab === 'chat' ? '0 2px 4px rgba(139,92,246,0.2)' : 'none',
            }}
          >
            <Bot size={16} />
            <span>🤖 [AI 실사 챗봇 어시스턴트] (사전 계측 & 일치율 검증)</span>
            <span
              style={{
                fontSize: '10px',
                background: '#8b5cf6',
                color: '#ffffff',
                padding: '2px 6px',
                borderRadius: '4px',
                fontWeight: 'bold',
              }}
            >
              추천
            </span>
          </button>
        </div>

        {activeTab === 'chat' ? (
          <div style={{ height: 'calc(100vh - 180px)', minHeight: '680px', marginBottom: '24px' }}>
            <AiSpecVerifyAssistant
              initialMaterialName={materialType}
              initialDesignSpec={materialType}
              isDarkMode={isDarkMode}
              onClose={() => setActiveTab('form')}
              onApplyToReport={(data) => {
                setMaterialType(data.spec || data.materialName);
                if (data.photoUrls && data.photoUrls.length > 0) {
                  setPhotoUrls(data.photoUrls);
                }
                setActiveTab('form');
                alert(`AI 사전 계측 결과가 실사보고서에 반영되었습니다:\n- 규격: ${data.spec}\n- 일치율: ${data.matchRate}% (${data.status})\n\n이제 [AI 분석 및 보고서 생성]을 실행하시거나 추가 정보를 확인해주세요.`);
              }}
            />
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: reportMarkdown ? '1fr 1.15fr' : '1fr',
              gap: '24px',
              alignItems: 'start',
            }}
          >
            {/* 좌측 입력 폼 패널: Step 1 & Step 2 */}
            <div
              style={{
                background: theme.cardBg,
                border: `1px solid ${theme.border}`,
                borderRadius: '12px',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              }}
            >
              {/* 상단 챗봇 어시스턴트 배너 알림 */}
              <div
                style={{
                  background: isDarkMode ? '#1e1b4b' : '#f5f3ff',
                  border: '1.5px solid #c4b5fd',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Bot size={20} style={{ color: '#8b5cf6', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 'bold', color: theme.textMain }}>
                      AI 실사 챗봇 어시스턴트로 사전 계측 및 일치율을 검증해보세요
                    </div>
                    <div style={{ fontSize: '11.5px', color: theme.textSub }}>
                      설계 규격과 현장 사진 라벨 OCR을 비교하여 일치율(%)과 차이점을 대화형 카드로 자동 계산합니다.
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('chat')}
                  style={{
                    padding: '6px 12px',
                    background: '#8b5cf6',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '11.5px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: '0 1px 3px rgba(139,92,246,0.3)',
                  }}
                >
                  <Sparkles size={12} />
                  <span>챗봇 패널 열기</span>
                </button>
              </div>

              {/* 상단 타이틀 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 4px 0' }}>
                    자재 품질실사(QC) 신청 및 판정
                  </h2>
                  <p style={{ margin: 0, fontSize: '13px', color: theme.textSub }}>
                    현장에 반입된 자재 사진을 등록하면 AI Vision이 5대 검수 항목을 정밀 판정합니다.
                  </p>
                </div>

                {/* 프리셋 버튼 */}
                <button
                  type="button"
                  onClick={() => {
                    setProjectNumber('안산-설비-2026-0096');
                    setMaterialType('FR-CNCO-W 22kV 60㎟ (전력 케이블)');
                    setPhotoLocation('안산 야외 적재장 A구역');
                  }}
                  style={{
                    fontSize: '11.5px',
                    padding: '5px 9px',
                    background: isDarkMode ? '#334155' : '#f1f5f9',
                    border: `1px solid ${theme.border}`,
                    borderRadius: '6px',
                    color: theme.textMain,
                    cursor: 'pointer',
                    fontWeight: '600',
                  }}
                >
                  기본 예시 채우기
                </button>
              </div>

            {/* ───────────────────────────────────────────────────────── */}
            {/* [Step 1] 사전 정보 입력 (Metadata) */}
            {/* ───────────────────────────────────────────────────────── */}
            <div
              style={{
                border: `1px solid ${theme.border}`,
                borderRadius: '8px',
                padding: '16px',
                background: isDarkMode ? '#0f172a' : '#fafafa',
              }}
            >
              <div
                style={{
                  fontWeight: 'bold',
                  fontSize: '14px',
                  marginBottom: '12px',
                  color: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>[Step 1] 사전 정보 입력 (Metadata)</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px' }}>
                    공사번호 <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={projectNumber}
                    onChange={(e) => setProjectNumber(e.target.value)}
                    placeholder="예) 안산-설비-2026-0096"
                    style={{
                      width: '100%',
                      padding: '8px 11px',
                      borderRadius: '6px',
                      border: `1px solid ${theme.border}`,
                      background: theme.inputBg,
                      color: theme.textMain,
                      fontSize: '13px',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px' }}>
                    실사일자 <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={photoDate}
                    onChange={(e) => setPhotoDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 11px',
                      borderRadius: '6px',
                      border: `1px solid ${theme.border}`,
                      background: theme.inputBg,
                      color: theme.textMain,
                      fontSize: '13px',
                    }}
                  />
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px' }}>
                    자재명 및 규격 <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={materialType}
                    onChange={(e) => setMaterialType(e.target.value)}
                    placeholder="예) FR-CNCO-W 22kV 60㎟, 통신용 광케이블 48C"
                    style={{
                      width: '100%',
                      padding: '8px 11px',
                      borderRadius: '6px',
                      border: `1px solid ${theme.border}`,
                      background: theme.inputBg,
                      color: theme.textMain,
                      fontSize: '13px',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px' }}>
                    반입/적재 위치 <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={photoLocation}
                    onChange={(e) => setPhotoLocation(e.target.value)}
                    placeholder="예) 안산 야외 적재장 A구역"
                    style={{
                      width: '100%',
                      padding: '8px 11px',
                      borderRadius: '6px',
                      border: `1px solid ${theme.border}`,
                      background: theme.inputBg,
                      color: theme.textMain,
                      fontSize: '13px',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px' }}>
                    실사자 (자동 연동)
                  </label>
                  <input
                    type="text"
                    value={inspector}
                    onChange={(e) => setInspector(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 11px',
                      borderRadius: '6px',
                      border: `1px solid ${theme.border}`,
                      background: theme.btnCancel,
                      color: theme.textMain,
                      fontSize: '13px',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* ───────────────────────────────────────────────────────── */}
            {/* [Step 2] 자재 사진 업로드 및 압축 (최대 5장) */}
            {/* ───────────────────────────────────────────────────────── */}
            <div
              style={{
                border: `1px solid ${theme.border}`,
                borderRadius: '8px',
                padding: '16px',
                background: isDarkMode ? '#0f172a' : '#fafafa',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '10px',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#2563eb' }}>
                  [Step 2] 자재 사진 업로드 및 압축 (최대 5장)
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {/* '자동 AI 분석 실행' 토글 스위치 */}
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '600',
                      color: autoAnalyze ? (isDarkMode ? '#93c5fd' : '#1d4ed8') : theme.textSub,
                      background: autoAnalyze
                        ? (isDarkMode ? 'rgba(37,99,235,0.2)' : '#eff6ff')
                        : (isDarkMode ? '#334155' : '#f1f5f9'),
                      padding: '5px 11px',
                      borderRadius: '20px',
                      border: `1px solid ${autoAnalyze ? '#60a5fa' : theme.border}`,
                      userSelect: 'none',
                      transition: 'all 0.2s ease',
                    }}
                    title="사진이 5장 등록되는 즉시 자동으로 AI Vision 분석이 시작됩니다"
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Sparkles size={13} style={{ color: autoAnalyze ? '#2563eb' : theme.textSub }} />
                      <span>자동 AI 분석 실행</span>
                    </span>

                    {/* 토글 스위치 비주얼 */}
                    <div
                      style={{
                        position: 'relative',
                        width: '34px',
                        height: '18px',
                        background: autoAnalyze ? '#2563eb' : (isDarkMode ? '#64748b' : '#cbd5e1'),
                        borderRadius: '10px',
                        transition: 'background 0.2s ease',
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          top: '2px',
                          left: autoAnalyze ? '18px' : '2px',
                          width: '14px',
                          height: '14px',
                          background: '#ffffff',
                          borderRadius: '50%',
                          transition: 'left 0.2s ease',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                        }}
                      />
                    </div>
                    <input
                      type="checkbox"
                      checked={autoAnalyze}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setAutoAnalyze(val);
                        try {
                          localStorage.setItem('kt_auto_analyze_material', String(val));
                        } catch {
                          // ignore
                        }
                      }}
                      style={{ display: 'none' }}
                    />
                  </label>

                  <div style={{ fontSize: '12px', color: theme.textSub, fontWeight: 'bold' }}>
                    {photos.length} / {MAX_PHOTOS}장 등록
                  </div>
                </div>
              </div>

              <div
                style={{
                  fontSize: '12px',
                  color: theme.textSub,
                  marginBottom: '10px',
                  lineHeight: '1.4',
                  background: isDarkMode ? '#1e293b' : '#eff6ff',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #bfdbfe',
                }}
              >
                🎯 <strong>필수 촬영 대상:</strong> ① 자재 전체 모습, ② 라벨(규격/제조사 표기 부위), ③ 파손 및 부식 의심 부위
              </div>

              {/* 자동 AI 분석 안내 배너 */}
              {autoAnalyze && (
                <div
                  style={{
                    fontSize: '11.5px',
                    color: photos.length === MAX_PHOTOS ? '#16a34a' : (isDarkMode ? '#93c5fd' : '#2563eb'),
                    background: photos.length === MAX_PHOTOS
                      ? (isDarkMode ? 'rgba(22,163,74,0.15)' : '#f0fdf4')
                      : (isDarkMode ? 'rgba(37,99,235,0.12)' : '#eff6ff'),
                    border: `1px dashed ${photos.length === MAX_PHOTOS ? '#86efac' : '#bfdbfe'}`,
                    padding: '6px 10px',
                    borderRadius: '6px',
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Sparkles size={13} />
                  <span>
                    {photos.length === MAX_PHOTOS
                      ? (isAnalyzing ? '🚀 사진 5장 등록 완료! AI Vision 정밀 분석이 자동으로 시작되었습니다...' : '✅ 사진 5장 등록 완료됨 (분석 실행 완료)')
                      : `⚡ 자동 AI 분석 활성화: 사진 5장이 등록되는 즉시 자동으로 분석이 시작됩니다. (현재 ${photos.length}/5장)`}
                  </span>
                </div>
              )}

              {/* 드래그 앤 드롭 및 클릭 업로드 영역 */}
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${photos.length > 0 ? '#10b981' : '#3b82f6'}`,
                  borderRadius: '8px',
                  padding: '24px 16px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: isDarkMode ? '#1e293b' : '#ffffff',
                  transition: 'background 0.2s ease',
                }}
              >
                <Camera size={32} style={{ color: '#2563eb', margin: '0 auto 8px' }} />
                <div style={{ fontWeight: 'bold', fontSize: '13.5px', color: theme.textMain }}>
                  {isCompressing ? '사진 최적화 압축 중...' : '현장 자재 사진 추가 (촬영 또는 파일 선택)'}
                </div>
                <div style={{ fontSize: '11.5px', color: theme.textSub, marginTop: '4px' }}>
                  자동 압축(imageCompression) 적용 • JPG, PNG 지원
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoFiles}
                  style={{ display: 'none' }}
                />
              </div>

              {/* 업로드된 사진 미리보기 썸네일 그리드 */}
              {photoUrls.length > 0 && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(5, 1fr)',
                    gap: '10px',
                    marginTop: '14px',
                  }}
                >
                  {photoUrls.map((url, idx) => (
                    <div key={idx} style={{ position: 'relative' }}>
                      <img
                        src={url}
                        alt={`자재사진 ${idx + 1}`}
                        onClick={() => {
                          setLightboxIndex(idx);
                          setLightboxOpen(true);
                        }}
                        style={{
                          width: '100%',
                          height: '75px',
                          objectFit: 'cover',
                          borderRadius: '6px',
                          border: `1.5px solid ${theme.border}`,
                          cursor: 'pointer',
                        }}
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemovePhoto(idx);
                        }}
                        style={{
                          position: 'absolute',
                          top: '-6px',
                          right: '-6px',
                          background: '#ef4444',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '50%',
                          width: '20px',
                          height: '20px',
                          fontSize: '11px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                        title="사진 삭제"
                      >
                        ×
                      </button>
                      <div
                        style={{
                          fontSize: '10px',
                          textAlign: 'center',
                          marginTop: '2px',
                          color: theme.textSub,
                        }}
                      >
                        #{idx + 1}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* [Step 3 실행 버튼] */}
            <button
              type="button"
              disabled={isAnalyzing || photos.length === 0}
              onClick={handleRunMaterialAnalyze}
              style={{
                padding: '14px',
                background: isAnalyzing ? '#94a3b8' : '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: 'bold',
                cursor: isAnalyzing || photos.length === 0 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(37,99,235,0.3)',
                transition: 'all 0.2s ease',
              }}
            >
              <Sparkles size={18} />
              <span>{isAnalyzing ? 'AI Vision 자재 정밀 분석 중...' : 'AI Vision 자재실사 분석 시작'}</span>
            </button>
          </div>

          {/* ───────────────────────────────────────────────────────── */}
          {/* [Step 3] AI Vision 분석 및 결과보고서 렌더링 영역 */}
          {/* ───────────────────────────────────────────────────────── */}
          {reportMarkdown && reportInfo && (
            <div
              style={{
                background: theme.cardBg,
                border: `1.5px solid ${
                  reportInfo.overallResultLabel === 'O (적합)' ? '#10b981' : '#f43f5e'
                }`,
                borderRadius: '12px',
                padding: '24px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
                display: 'flex',
                flexDirection: 'column',
                gap: '18px',
              }}
            >
              {/* 상단 결과 배너 */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  background:
                    reportInfo.overallResultLabel === 'O (적합)'
                      ? isDarkMode
                        ? '#064e3b'
                        : '#dcfce7'
                      : isDarkMode
                      ? '#450a0a'
                      : '#ffe4e6',
                  color: reportInfo.overallResultLabel === 'O (적합)' ? '#15803d' : '#be123c',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {reportInfo.overallResultLabel === 'O (적합)' ? (
                    <CheckCircle2 size={24} />
                  ) : (
                    <AlertTriangle size={24} />
                  )}
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '16px' }}>
                      자재 판정 결과: {reportInfo.overallResultLabel}
                    </div>
                    <div style={{ fontSize: '12px', opacity: 0.9 }}>
                      {reportInfo.overallResultLabel === 'O (적합)'
                        ? '5대 검수 기준 전 항목 양호 — 현장 반입 및 사용 승인 권고'
                        : '불량 항목 검출 — 반입 중단 및 반품/교체 요망'}
                    </div>
                  </div>
                </div>

                {/* 보고서 도구 버튼들 */}
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => window.print()}
                    style={{
                      padding: '6px 10px',
                      background: theme.cardBg,
                      border: `1px solid ${theme.border}`,
                      borderRadius: '6px',
                      color: theme.textMain,
                      fontSize: '12px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Printer size={13} />
                    <span>인쇄</span>
                  </button>
                  <button
                    onClick={() => saveReportAsText(reportMarkdown, `${projectNumber}_자재실사보고서`)}
                    style={{
                      padding: '6px 10px',
                      background: theme.cardBg,
                      border: `1px solid ${theme.border}`,
                      borderRadius: '6px',
                      color: theme.textMain,
                      fontSize: '12px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Download size={13} />
                    <span>저장</span>
                  </button>
                </div>
              </div>

              {/* 5대 검수 항목 직접 편집 테이블 (조치사항 & 비고 수기 입력) */}
              <div
                style={{
                  border: `1px solid ${theme.border}`,
                  borderRadius: '8px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '10px 14px',
                    background: isDarkMode ? '#1e293b' : '#f1f5f9',
                    fontWeight: 'bold',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>■ 2. 자재 검수 항목 및 결과 (수기 검토 및 조치사항 보정)</span>
                  <span style={{ fontSize: '11px', color: theme.textSub }}>
                    클릭하여 조치사항/비고 입력
                  </span>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                  <thead>
                    <tr style={{ background: isDarkMode ? '#0f172a' : '#f8fafc', borderBottom: `1px solid ${theme.border}` }}>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>검수항목</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center', width: '90px' }}>결과</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>조치사항</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>비고</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center', width: '60px' }}>편집</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeCheckRows.map((row, idx) => (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: `1px solid ${theme.border}`,
                          background: row.result === '불량' ? (isDarkMode ? '#3b1d1d' : '#fef2f2') : 'transparent',
                        }}
                      >
                        <td style={{ padding: '9px 10px', fontWeight: '500' }}>{row.name}</td>
                        <td style={{ padding: '9px 10px', textAlign: 'center' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontWeight: 'bold',
                              fontSize: '11.5px',
                              background: row.result === '양호' ? '#dcfce7' : '#fee2e2',
                              color: row.result === '양호' ? '#15803d' : '#b91c1c',
                            }}
                          >
                            {row.result || '양호'}
                          </span>
                        </td>
                        <td style={{ padding: '9px 10px', color: theme.textSub }}>
                          {row.action || <span style={{ opacity: 0.4 }}>수기 입력 대기</span>}
                        </td>
                        <td style={{ padding: '9px 10px', color: theme.textSub }}>
                          {row.note || <span style={{ opacity: 0.4 }}>-</span>}
                        </td>
                        <td style={{ padding: '9px 10px', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingRowIdx(idx);
                              setEditAction(row.action);
                              setEditNote(row.note);
                              setIsEditModalOpen(true);
                            }}
                            style={{
                              padding: '3px 7px',
                              borderRadius: '4px',
                              background: '#2563eb',
                              color: '#fff',
                              border: 'none',
                              fontSize: '11px',
                              cursor: 'pointer',
                            }}
                          >
                            입력
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 공식 마크다운 보고서 본문 렌더링 */}
              <div
                style={{
                  background: isDarkMode ? '#0f172a' : '#ffffff',
                  border: `1px solid ${theme.border}`,
                  borderRadius: '8px',
                  padding: '18px',
                  fontSize: '13px',
                  lineHeight: '1.6',
                }}
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    table: ({ node, ...props }) => (
                      <table
                        style={{
                          width: '100%',
                          borderCollapse: 'collapse',
                          margin: '10px 0',
                          border: '1.5px solid #1e293b',
                        }}
                        {...props}
                      />
                    ),
                    th: ({ node, ...props }) => (
                      <th
                        style={{
                          border: '1px solid #cbd5e1',
                          padding: '6px 8px',
                          background: isDarkMode ? '#1e293b' : '#f1f5f9',
                          textAlign: 'left',
                          fontSize: '12px',
                        }}
                        {...props}
                      />
                    ),
                    td: ({ node, ...props }) => (
                      <td
                        style={{
                          border: '1px solid #cbd5e1',
                          padding: '6px 8px',
                          fontSize: '12px',
                        }}
                        {...props}
                      />
                    ),
                  }}
                >
                  {reportMarkdown}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      )}
    </main>

      {/* 조치사항 및 비고 상세 편집 모달 (전문 용어 자동 완성 TechnicalTermInput 탑재) */}
      {isEditModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 60,
            padding: '20px',
          }}
        >
          <div
            style={{
              background: theme.cardBg,
              border: `1px solid ${theme.border}`,
              borderRadius: '12px',
              padding: '24px',
              width: '100%',
              maxWidth: '540px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 'bold', fontSize: '15px' }}>
                ✏️ [{activeCheckRows[editingRowIdx]?.name}] 조치사항 및 비고 입력
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: theme.textSub, cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 'bold', marginBottom: '6px' }}>
                조치사항 (전문용어 자동완성 지원)
              </label>
              <TechnicalTermInput
                value={editAction}
                onChange={setEditAction}
                placeholder="예) 광분배함 전면 패널 접속부 재체결 완료, 5G 안테나 브라켓 보강 조치 등"
                theme={theme}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 'bold', marginBottom: '6px' }}>
                비고
              </label>
              <TechnicalTermInput
                value={editNote}
                onChange={setEditNote}
                placeholder="예) 현장 감리원 확인 완료, 반입 승인 필증 부착"
                theme={theme}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '6px',
                  background: theme.btnCancel,
                  color: theme.textMain,
                  border: `1px solid ${theme.border}`,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSaveCheckItemEdit}
                style={{
                  padding: '8px 18px',
                  borderRadius: '6px',
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                보고서에 저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI 실사 챗봇 어시스턴트 모달 (사전 계측 & 일치율 검증) */}
      {showChatAssistant && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 70,
            padding: '20px',
          }}
        >
          <div style={{ width: '100%', maxWidth: '820px', height: '90vh' }}>
            <AiSpecVerifyAssistant
              initialMaterialName={materialType}
              initialDesignSpec={materialType}
              isDarkMode={isDarkMode}
              onClose={() => setShowChatAssistant(false)}
              onApplyToReport={(data) => {
                setMaterialType(data.spec || data.materialName);
                if (data.photoUrls && data.photoUrls.length > 0) {
                  setPhotoUrls(data.photoUrls);
                }
                setShowChatAssistant(false);
                alert(`AI 사전 계측 결과가 반영되었습니다:\n- 규격: ${data.spec}\n- 일치율: ${data.matchRate}% (${data.status})`);
              }}
            />
          </div>
        </div>
      )}

      {/* 라이트박스 */}
      <ImageLightbox
        isOpen={lightboxOpen}
        images={photoUrls}
        initialIndex={lightboxIndex}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  );
}

export default function MaterialPage() {
  return (
    <Suspense
      fallback={
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          자재실사 시스템을 불러오는 중...
        </div>
      }
    >
      <MaterialInspectionContent />
    </Suspense>
  );
}
