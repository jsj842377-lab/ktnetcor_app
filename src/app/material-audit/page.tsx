'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTheme } from '@/context/ThemeContext';
import ImageLightbox from '@/components/ImageLightbox';
import MaterialReportOnePage from '@/components/MaterialReportOnePage';
import MaterialAuditSummaryDashboard from '@/components/MaterialAuditSummaryDashboard';
import TechnicalTermInput from '@/components/TechnicalTermInput';
import { saveReportAsText } from '@/utils/reportSaver';
import { renameUploadedPhotos } from '@/utils/photoRenamer';
import {
  parseExcelFile,
  createSampleExcelFile,
  ParsedExcelData,
  MaterialItem,
} from '@/utils/excelParser';
import {
  Package,
  ShieldAlert,
  FileText,
  Upload,
  Camera,
  RotateCcw,
  Printer,
  Download,
  Bot,
  ExternalLink,
  History,
  Sparkles,
  BarChart2,
  Send,
  Paperclip,
  FileSpreadsheet,
  Search,
  CheckCircle2,
  Edit3,
  AlertTriangle,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface ParsedDoc {
  docTitle: string;
  projectNumber: string;
  docDate: string;
  recipient: string;
  location: string;
  materials: MaterialItem[];
}

interface ChatMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  type?: 'text' | 'doc_picker' | 'item_picker' | 'photo_request' | 'count_result' | 'report_ready' | 'discrepancy_question' | 'photo_prompt_question';
  data?: any;
  timestamp: string;
}

interface AuditRecord {
  id: string;
  projectNumber: string;
  seq?: number;
  materialCode?: string;
  classSubcategory?: string;
  materialName: string;
  spec: string;
  docQty: number;
  measuredQty: number;
  unit: string;
  matchRate: number;
  status: string;
  statusLabel: string;
  reportMarkdown: string;
  photoUrls: string[];
  createdAt: string;
  inspector: string;
}

function MaterialAuditContent() {
  const searchParams = useSearchParams();
  const { isDarkMode, toggleTheme } = useTheme();

  const theme = isDarkMode ? {
    bg: '#0f172a', cardBg: '#1e293b', textMain: '#f8fafc', textSub: '#94a3b8',
    border: '#334155', inputBg: '#0f172a', mdTableHead: '#334155', btnCancel: '#334155'
  } : {
    bg: '#f8fafc', cardBg: '#ffffff', textMain: '#0f172a', textSub: '#475569',
    border: '#cbd5e1', inputBg: '#f8fafc', mdTableHead: '#f1f5f9', btnCancel: '#e2e8f0'
  };

  const [workerName, setWorkerName] = useState<string>('작업자');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentStep, setCurrentStep] = useState<'upload_doc' | 'select_item' | 'upload_photo' | 'counting' | 'completed'>('upload_doc');
  const [activeTab, setActiveTab] = useState<'chat' | 'analytics'>('chat');

  // 서류 관련 상태
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docPreviewUrl, setDocPreviewUrl] = useState<string | null>(null);
  const [parsedDoc, setParsedDoc] = useState<ParsedDoc | null>(null);
  const [selectedItem, setSelectedItem] = useState<MaterialItem | null>(null);
  const [isParsingDoc, setIsParsingDoc] = useState<boolean>(false);

  // 엑셀 파일(7MB) 및 대화형 챗봇 관련 상태
  const [parsedExcel, setParsedExcel] = useState<ParsedExcelData | null>(null);
  const [activeExcelSheet, setActiveExcelSheet] = useState<string>('ALL');
  const [itemSearchKeyword, setItemSearchKeyword] = useState<string>('');
  const [chatInputText, setChatInputText] = useState<string>('');
  const [isAiThinking, setIsAiThinking] = useState<boolean>(false);
  const chatFileInputRef = useRef<HTMLInputElement>(null);

  // 현장 자재 사진 관련 상태
  const [materialPhotos, setMaterialPhotos] = useState<File[]>([]);
  const [materialPhotoUrls, setMaterialPhotoUrls] = useState<string[]>([]);
  const [isCounting, setIsCounting] = useState<boolean>(false);

  // 계측 결과 및 보고서
  const [countResult, setCountResult] = useState<any>(null);
  const [activeReportText, setActiveReportText] = useState<string | null>(null);
  const [isPdfGenerating, setIsPdfGenerating] = useState<boolean>(false);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [historyRecords, setHistoryRecords] = useState<AuditRecord[]>([]);

  // 조치사항 및 비고 상세 편집 모달 상태
  const [isEditingRemarksModal, setIsEditingRemarksModal] = useState<boolean>(false);
  const [reportActionText, setReportActionText] = useState<string>('');
  const [reportNoteText, setReportNoteText] = useState<string>('');
  const [reportRecommendationText, setReportRecommendationText] = useState<string>('');

  // 모바일 뷰 전환 (챗봇 vs 실사보고서) 및 화면 크기 감지
  const [mobilePane, setMobilePane] = useState<'chat' | 'report'>('chat');
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(typeof window !== 'undefined' && window.innerWidth <= 960);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 사진 라이트박스
  const [lightboxOpen, setLightboxOpen] = useState<boolean>(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number>(0);

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  // 작업자 세션 로드
  useEffect(() => {
    const queryWorker = searchParams.get('worker');
    const savedWorker = localStorage.getItem('kt_current_worker');
    const name = queryWorker || savedWorker || '김철수';
    setWorkerName(name);

    // 과거 실사 기록 로컬 복구
    try {
      const savedHist = localStorage.getItem('kt_material_audits');
      if (savedHist) setHistoryRecords(JSON.parse(savedHist));
    } catch (e) {
      console.warn('과거 실사 기록 복구 실패:', e);
    }

    // 챗봇 초기 웰컴 메시지
    const initialMsg: ChatMessage = {
      id: 'msg-init',
      sender: 'bot',
      text: `반갑습니다, ${name}님! KT 경기설계팀 AI 자재실사 어시스턴트입니다.\n\n정확한 자재 계측을 위해 먼저 실사할 자재 서류(자재불출증, 거래명세표, 납품서 등)를 업로드하시거나 아래의 표준 서류 샘플 중 하나를 선택해주세요.`,
      type: 'doc_picker',
      timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages([initialMsg]);
  }, [searchParams]);

  // 스크롤 맨 아래로 이동
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isParsingDoc, isCounting]);

  // 1. 서류 파싱 요청 (파일 또는 샘플 프리셋)
  const handleParseDocument = async (fileOrPreset: File | string) => {
    setIsParsingDoc(true);

    // 1-A. 대용량 엑셀 파일(.xlsx, .xls, .csv) 직접 클라이언트 파싱 처리 (7MB급 지원)
    if (
      typeof fileOrPreset !== 'string' &&
      (fileOrPreset.name.match(/\.(xlsx|xls|csv)$/i) ||
        fileOrPreset.type.includes('spreadsheet') ||
        fileOrPreset.type.includes('excel'))
    ) {
      setDocFile(fileOrPreset);
      const sizeMb = (fileOrPreset.size / (1024 * 1024)).toFixed(1);

      setMessages((prev) => [
        ...prev,
        {
          id: `usr-${Date.now()}`,
          sender: 'user',
          text: `📊 [대용량 엑셀 서류 등록] ${fileOrPreset.name} (${sizeMb}MB)`,
          timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);

      try {
        const excelData = await parseExcelFile(fileOrPreset);
        setParsedExcel(excelData);
        setActiveExcelSheet('ALL');

        const doc: ParsedDoc = {
          docTitle: excelData.docTitle,
          projectNumber: excelData.projectNumber,
          docDate: excelData.docDate,
          recipient: excelData.recipient,
          location: excelData.location,
          materials: excelData.materials,
        };
        setParsedDoc(doc);
        setCurrentStep('select_item');

        setMessages((prev) => [
          ...prev,
          {
            id: `bot-${Date.now()}`,
            sender: 'bot',
            text: `📊 **${fileOrPreset.name} (${sizeMb}MB)** 엑셀 서류 분석이 완료되었습니다!\n\n📋 **문서명**: ${excelData.docTitle}\n🏢 **공사번호**: ${excelData.projectNumber}\n📍 **현장/납품장소**: ${excelData.location}\n📑 **감지 시트**: ${excelData.sheetNames.join(', ')} (총 ${excelData.sheetNames.length}개 시트)\n📦 **추출 자재**: 총 **${excelData.materials.length}건**\n\n아래 목록에서 실사할 자재를 선택하시거나, 하단 대화창에 **'광분배함 4개 실사할래'**처럼 말씀해주시면 대화하며 보고서를 완성할 수 있습니다! 💬`,
            type: 'item_picker',
            data: excelData.materials,
            timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      } catch (err: any) {
        setMessages((prev) => [
          ...prev,
          {
            id: `bot-err-${Date.now()}`,
            sender: 'bot',
            text: `⚠️ 엑셀 파일 분석 중 오류가 발생했습니다: ${err.message}\n파일 손상 여부를 확인하시거나 표준 샘플 엑셀을 이용해주세요.`,
            type: 'doc_picker',
            timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      } finally {
        setIsParsingDoc(false);
      }
      return;
    }

    // 1-B. 일반 이미지/PDF 또는 프리셋 샘플 서류 처리
    const formData = new FormData();

    if (typeof fileOrPreset === 'string') {
      formData.append('presetKey', fileOrPreset);
      setMessages((prev) => [
        ...prev,
        {
          id: `usr-${Date.now()}`,
          sender: 'user',
          text: `[서류 선택] ${
            fileOrPreset === 'telecom_fdf'
              ? '초고속망 광선로 자재불출증'
              : fileOrPreset === 'base_station'
              ? '5G 기지국 안테나 설비 납품서'
              : '지하 통신구 관로 자재인수증'
          }`,
          timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } else {
      formData.append('document', fileOrPreset);
      setDocFile(fileOrPreset);
      setDocPreviewUrl(URL.createObjectURL(fileOrPreset));
      setMessages((prev) => [
        ...prev,
        {
          id: `usr-${Date.now()}`,
          sender: 'user',
          text: `📄 [자재 서류 업로드] ${fileOrPreset.name} (${Math.round(fileOrPreset.size / 1024)}KB)`,
          timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }

    try {
      const res = await fetch('/api/material-audit/parse-document', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || '서류 분석에 실패했습니다.');
      }

      const doc: ParsedDoc = data.data;
      setParsedDoc(doc);
      setCurrentStep('select_item');

      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          sender: 'bot',
          text: `서류 분석이 완료되었습니다!\n\n📋 **서류명**: ${doc.docTitle}\n🏢 **공사번호**: ${doc.projectNumber}\n📍 **납품장소**: ${doc.location}\n\n서류에 등재된 아래 자재 품목 중 **오늘 현장에서 실사할 대상 자재**를 선택해주세요:`,
          type: 'item_picker',
          data: doc.materials,
          timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-err-${Date.now()}`,
          sender: 'bot',
          text: `⚠️ 서류 분석 중 문제가 발생했습니다: ${err.message}\n다시 시도하거나 표준 샘플 서류를 선택해주세요.`,
          type: 'doc_picker',
          timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsParsingDoc(false);
    }
  };

  // 1-C. 샘플 7MB 표준 실사 엑셀 로드
  const handleLoadSampleExcel = async () => {
    try {
      const sampleFile = createSampleExcelFile();
      await handleParseDocument(sampleFile);
    } catch (e: any) {
      console.error('샘플 엑셀 생성 실패:', e);
    }
  };

  // 1-D. 챗봇 대화형 메시지 전송 및 실사 보고서 대화 완성
  const handleSendChatMessage = async (directText?: string) => {
    const textToSend = (directText || chatInputText).trim();
    if (!textToSend || isAiThinking) return;

    setChatInputText('');
    const userMsgId = `usr-${Date.now()}`;
    const newHistory: ChatMessage[] = [
      ...messages,
      {
        id: userMsgId,
        sender: 'user',
        text: textToSend,
        timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      },
    ];
    setMessages(newHistory);
    setIsAiThinking(true);

    try {
      const res = await fetch('/api/material-audit/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: textToSend,
          conversationHistory: newHistory.slice(-8).map((m) => ({ role: m.sender, text: m.text })),
          excelSummary: parsedExcel?.rawSummary,
          availableMaterials: parsedExcel?.materials || parsedDoc?.materials || [],
          selectedItem,
          countResult,
          currentReportText: activeReportText,
          workerName,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '답변을 불러오지 못했습니다.');

      // 자재 선택 액션
      if (data.action === 'select_material' && data.selectedItem) {
        handleSelectItem(data.selectedItem);
      }

      // 수량/일치율 수정 액션
      if (data.action === 'update_count' && data.updatedCount) {
        setCountResult((prev: any) => ({
          ...prev,
          measuredQty: data.updatedCount.measuredQty,
          matchRate: data.updatedCount.matchRate,
          status: data.updatedCount.status || (data.updatedCount.matchRate >= 100 ? 'MATCH' : 'SHORTAGE'),
          statusLabel: data.updatedCount.statusLabel || (data.updatedCount.matchRate >= 100 ? '일치 (적합)' : '수량 부족 (경고)'),
        }));
      }

      // 보고서 갱신 또는 완성 액션
      if (data.reportMarkdown) {
        setActiveReportText(data.reportMarkdown);
        if (data.action === 'complete_report') {
          confetti({ particleCount: 100, spread: 60, origin: { y: 0.6 } });
        }
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          sender: 'bot',
          text: data.reply || '요청하신 내용을 처리했습니다.',
          type:
            data.action === 'select_material'
              ? 'photo_request'
              : data.action === 'complete_report'
              ? 'count_result'
              : 'text',
          data:
            data.action === 'select_material'
              ? data.selectedItem
              : data.action === 'complete_report'
              ? countResult
              : undefined,
          timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err: any) {
      console.warn('Chat error fallback:', err);
      let fallback = `네, '${textToSend}' 내용을 확인했습니다. `;
      const numMatch = textToSend.match(/([0-9]+)\s*(개|대|팩|조|m|롤|본)?/);
      if (numMatch && countResult && selectedItem) {
        const newQty = parseInt(numMatch[1], 10);
        const newRate = Math.round((newQty / selectedItem.docQty) * 100);
        const newStatus = newRate >= 100 ? '일치 (적합)' : '수량 부족 (경고)';
        setCountResult((prev: any) => ({
          ...prev,
          measuredQty: newQty,
          matchRate: newRate,
          statusLabel: newStatus,
        }));
        fallback = `실측 수량을 ${newQty}${selectedItem.unit}(일치율 ${newRate}%, ${newStatus})로 대화형 수정 반영했습니다.`;
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-fb-${Date.now()}`,
          sender: 'bot',
          text: fallback,
          timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsAiThinking(false);
    }
  };

  // 2. 자재 품목 선택 (자재코드, 클래스 소분류, 실사수량 3대 핵심 체크 및 실사수량 부재/불일치 처리)
  const handleSelectItem = (item: MaterialItem) => {
    setSelectedItem(item);
    setCurrentStep('upload_photo');

    const seq = item.seq || 1;
    const code = item.materialCode || `MAT-KT-${String(seq).padStart(4, '0')}`;
    const subCat = item.classSubcategory || item.category || '기본자재류';
    const hasActualQty = item.actualQty !== null && item.actualQty !== undefined;

    if (!hasActualQty) {
      // 실사 수량이 없을 시:
      // "실사 수량 계측을 실시하시겠습니까?"라고 물어 본 후 사진을 업로드 할 것을 요청
      setMessages((prev) => [
        ...prev,
        {
          id: `usr-${Date.now()}`,
          sender: 'user',
          text: `[순번 #${seq} ↔ 사진 #${seq}] **${item.name}** 선택 (자재코드: ${code} / 클래스 소분류: ${subCat} / 전산: ${item.docQty} ${item.unit})`,
          timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        },
        {
          id: `bot-${Date.now() + 1}`,
          sender: 'bot',
          text: `📋 **[자재실사 3대 핵심 체크 항목 확인]**\n- 1️⃣ **자재코드**: \`${code}\`\n- 2️⃣ **클래스 소분류**: **${subCat}**\n- 3️⃣ **실사 수량**: ⚠️ **실사 수량 미계측 (수량 없음)** (전산 장부: ${item.docQty} ${item.unit})\n\n❓ **'실사 수량 계측을 실시하시겠습니까?'**\n\n현장 자재 사진을 업로드해 주시면 AI 비전 계측을 통해 실사 수량을 자동으로 측정해 드립니다. 📸 (순번: #${seq} ↔ 현장 사진 #${seq} 연동)`,
          type: 'photo_prompt_question',
          data: item,
          timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } else {
      // 실사 수량이 이미 있을 시:
      const isMismatch = item.actualQty !== item.docQty;
      const mismatchNotice = isMismatch
        ? `\n\n⚠️ **[실사 수량 불일치 확인]**\n전산 수량(${item.docQty} ${item.unit})과 실사 수량(${item.actualQty} ${item.unit})이 **${Math.abs(item.docQty - (item.actualQty || 0))}개 불일치**합니다!\n\n**불일치 사유(시공 현장 투입, 포장 파손, 단순 오입고, 인근 현장 대여 등)를 말씀해 주시겠습니까?**`
        : `\n\n✅ **전산 수량과 실사 수량이 100% 일치합니다.** (정상 입고/불출 승인 대상)`;

      setMessages((prev) => [
        ...prev,
        {
          id: `usr-${Date.now()}`,
          sender: 'user',
          text: `[순번 #${seq} ↔ 사진 #${seq}] **${item.name}** 선택 (자재코드: ${code} / 클래스 소분류: ${subCat})`,
          timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        },
        {
          id: `bot-${Date.now() + 1}`,
          sender: 'bot',
          text: `📋 **[자재실사 3대 핵심 체크 항목 확인]**\n- 1️⃣ **자재코드**: \`${code}\`\n- 2️⃣ **클래스 소분류**: **${subCat}**\n- 3️⃣ **실사 수량**: **${item.actualQty} ${item.unit}** (전산 장부: ${item.docQty} ${item.unit})${mismatchNotice}`,
          type: isMismatch ? 'discrepancy_question' : 'photo_request',
          data: item,
          timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  };

  // 3. 사진 파일 추가
  const handlePhotoFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fl = e.target.files;
    if (!fl || fl.length === 0) return;
    const newFiles = Array.from(fl);
    const combined = [...materialPhotos, ...newFiles].slice(0, 5);
    setMaterialPhotos(combined);
    setMaterialPhotoUrls(combined.map((f) => URL.createObjectURL(f)));
  };

  // 4. AI 실사 계측 실행
  const handleRunCounting = async () => {
    if (materialPhotos.length === 0) {
      alert('현장 자재 사진을 최소 1장 이상 등록해주세요.');
      return;
    }
    if (!selectedItem || !parsedDoc) return;

    setIsCounting(true);
    setCurrentStep('counting');

    setMessages((prev) => [
      ...prev,
      {
        id: `usr-${Date.now()}`,
        sender: 'user',
        text: `📸 현장 사진 ${materialPhotos.length}장 업로드 완료. AI 시각 계측을 시작합니다.`,
        timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      },
    ]);

    const renamedPhotos = renameUploadedPhotos(materialPhotos, {
      projectNumber: parsedDoc.projectNumber,
      date: parsedDoc.docDate || new Date(),
      includeEntropy: true,
    });

    const seq = selectedItem.seq || 1;
    const materialCode = selectedItem.materialCode || `MAT-000${seq}`;
    const classSubcategory = selectedItem.classSubcategory || '통신선로자재류';

    const formData = new FormData();
    renamedPhotos.forEach((file) => formData.append('images', file));
    formData.append('materialName', selectedItem.name);
    formData.append('spec', selectedItem.spec);
    formData.append('docQty', selectedItem.docQty.toString());
    formData.append('unit', selectedItem.unit);
    formData.append('projectNumber', parsedDoc.projectNumber);
    formData.append('inspector', workerName);
    formData.append('location', parsedDoc.location);
    formData.append('docTitle', parsedDoc.docTitle);
    formData.append('docDate', parsedDoc.docDate);
    formData.append('seq', seq.toString());
    formData.append('materialCode', materialCode);
    formData.append('classSubcategory', classSubcategory);
    if (selectedItem.discrepancyReason) {
      formData.append('discrepancyReason', selectedItem.discrepancyReason);
    }

    try {
      const res = await fetch('/api/material-audit/count-and-report', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || '계측 분석에 실패했습니다.');
      }

      const result = data.data;
      setCountResult(result);
      setActiveReportText(result.reportMarkdown);
      setCurrentStep('completed');

      // 축하 효과 (일치율 100% 이상일 때)
      if (result.matchRate >= 100) {
        confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
      }

      // 새 실사 기록 로컬 저장
      const newRecord: AuditRecord = {
        id: `audit-${Date.now()}`,
        projectNumber: parsedDoc.projectNumber,
        seq,
        materialCode,
        classSubcategory,
        materialName: selectedItem.name,
        spec: selectedItem.spec,
        docQty: selectedItem.docQty,
        measuredQty: result.measuredQty,
        unit: selectedItem.unit,
        matchRate: result.matchRate,
        status: result.status,
        statusLabel: result.statusLabel,
        reportMarkdown: result.reportMarkdown,
        photoUrls: materialPhotoUrls,
        createdAt: new Date().toISOString(),
        inspector: workerName,
      };

      const updatedHistory = [newRecord, ...historyRecords];
      setHistoryRecords(updatedHistory);
      localStorage.setItem('kt_material_audits', JSON.stringify(updatedHistory));

      const isMismatch = result.measuredQty !== selectedItem.docQty;
      const mismatchText = isMismatch
        ? `\n\n⚠️ **[실사 수량 불일치 확인]**\n전산 수량(${selectedItem.docQty} ${selectedItem.unit})과 AI 실측 수량(${result.measuredQty} ${selectedItem.unit})이 **${Math.abs(selectedItem.docQty - result.measuredQty)}개 불일치**합니다!\n**불일치 사유(시공 현장 투입, 포장 파손, 단순 오입고 등)를 말씀해 주시겠습니까?**`
        : `\n\n✅ **전산 수량과 실사 수량이 100% 일치합니다.** (정상 입고/불출 승인)`;

      const botText = `🎉 **AI 시각 계측 및 실사 점검이 완료되었습니다!**\n\n📋 **[자재실사 3대 핵심 체크 결과]**\n- 1️⃣ **자재코드**: \`${materialCode}\`\n- 2️⃣ **클래스 소분류**: **${classSubcategory}**\n- 3️⃣ **실사 수량**: **${result.measuredQty} ${selectedItem.unit}** (전산 장부: ${selectedItem.docQty} ${selectedItem.unit} / 일치율: **${result.matchRate}%**, ${result.statusLabel})\n\n🔍 **순번**: No.${seq} (현장 사진 #${seq} 연동)\n💡 **계측 소견**: ${result.countingDetails}${mismatchText}`;

      // 챗봇 응답 메시지 전송
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-result-${Date.now()}`,
          sender: 'bot',
          text: botText,
          type: isMismatch ? 'discrepancy_question' : 'count_result',
          data: { ...result, materialCode, classSubcategory, seq },
          timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-err-${Date.now()}`,
          sender: 'bot',
          text: `⚠️ 사진 계측 중 오류가 발생했습니다: ${err.message}`,
          timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      setCurrentStep('upload_photo');
    } finally {
      setIsCounting(false);
    }
  };

  // 1장 PDF 다운로드
  const handleDownloadPDF = async () => {
    const el = document.getElementById('material-report-print-target');
    if (!el) {
      alert('보고서 영역을 찾을 수 없습니다.');
      return;
    }

    try {
      setIsPdfGenerating(true);
      const html2pdf = (await import('html2pdf.js')).default;
      const opt = {
        margin: [4, 4, 4, 4] as [number, number, number, number],
        filename: `자재실사보고서_${selectedItem?.name || '자재'}_${new Date().toISOString().slice(0, 10)}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
        pagebreak: { mode: ['avoid-all', 'css'] },
      };
      await html2pdf().set(opt).from(el).save();
    } catch (e: any) {
      alert(`PDF 생성 실패: ${e.message}`);
    } finally {
      setIsPdfGenerating(false);
    }
  };

  // 1장 인쇄
  const handlePrint = () => {
    window.print();
  };

  // 텍스트 저장
  const handleSaveText = () => {
    if (!activeReportText) return;
    saveReportAsText(activeReportText, `${selectedItem?.name || '자재'}_실사보고서_${new Date().toISOString().slice(0, 10)}.txt`);
  };

  // 새 실사 시작
  const handleReset = () => {
    setDocFile(null);
    setDocPreviewUrl(null);
    setParsedDoc(null);
    setParsedExcel(null);
    setActiveExcelSheet('ALL');
    setItemSearchKeyword('');
    setSelectedItem(null);
    setMaterialPhotos([]);
    setMaterialPhotoUrls([]);
    setCountResult(null);
    setActiveReportText(null);
    setCurrentStep('upload_doc');

    const resetMsg: ChatMessage = {
      id: `bot-reset-${Date.now()}`,
      sender: 'bot',
      text: '새로운 자재실사를 시작합니다. 실사할 서류를 업로드하거나 표준 샘플 서류를 선택해주세요.',
      type: 'doc_picker',
      timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, resetMsg]);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: theme.bg,
        color: theme.textMain,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', sans-serif",
      }}
    >
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 4mm 6mm;
          }
          body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            max-height: 297mm !important;
            overflow: hidden !important;
          }
          body * {
            visibility: hidden;
          }
          .material-print-area, .material-print-area * {
            visibility: visible;
            color: #000000 !important;
          }
          .material-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 194mm !important;
            margin: 0 auto !important;
            box-sizing: border-box !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            max-height: 284mm !important;
            overflow: hidden !important;
          }
          .material-print-area img {
            max-width: 100% !important;
            max-height: 100% !important;
            object-fit: contain !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* PDF 생성 오버레이 */}
      {isPdfGenerating && (
        <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '50px', height: '50px', border: '5px solid rgba(255,255,255,0.2)', borderTop: '5px solid #2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '20px' }} />
          <h3 style={{ color: 'white', fontSize: '17px', fontWeight: 'bold' }}>자재실사 보고서 PDF 생성 중...</h3>
        </div>
      )}

      {/* 최상단 글로벌 모듈 네비게이션 헤더 */}
      <header
        className="no-print"
        style={{
          borderBottom: `1px solid ${theme.border}`,
          background: theme.cardBg,
          padding: '12px 20px',
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}
      >
        <div
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          {/* 좌측: 로고 및 시스템 타이틀 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>📦</span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: theme.textMain }}>
                  현장 자재실사 계측 시스템
                </h1>
                <span style={{ fontSize: '11px', background: '#2563eb', color: '#ffffff', padding: '2px 6px', borderRadius: '3px', fontWeight: 'bold' }}>
                  AI Vision
                </span>
              </div>
              <div style={{ fontSize: '11px', color: theme.textSub, marginTop: '2px' }}>
                KT 경기설계팀 현장 서류 대조 및 자재 수량 시각 계측
              </div>
            </div>
          </div>

          {/* 중앙: 대분류 네비게이션 탭 (안전점검 vs 자재실사 vs 관리자) */}
          <nav
            style={{
              display: 'flex',
              background: theme.btnCancel,
              padding: '4px',
              borderRadius: '6px',
              border: `1px solid ${theme.border}`,
              gap: '4px',
            }}
          >
            <Link
              href={`/dashboard?worker=${encodeURIComponent(workerName)}`}
              style={{
                textDecoration: 'none',
                padding: '6px 14px',
                fontSize: '12.5px',
                fontWeight: '600',
                color: theme.textSub,
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease',
              }}
            >
              <ShieldAlert size={14} />
              <span>🛡️ 안전점검 시스템</span>
            </Link>

            <Link
              href={`/material?worker=${encodeURIComponent(workerName)}`}
              style={{
                textDecoration: 'none',
                padding: '6px 12px',
                fontSize: '12.5px',
                fontWeight: 'bold',
                background: theme.btnCancel,
                color: theme.textMain,
                border: `1px solid ${theme.border}`,
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Package size={14} />
              <span>자재실사 (QC)</span>
            </Link>

            <div
              style={{
                padding: '6px 14px',
                fontSize: '12.5px',
                fontWeight: '800',
                background: '#2563eb',
                color: '#ffffff',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 4px rgba(37,99,235,0.25)',
              }}
            >
              <FileSpreadsheet size={14} />
              <span>대용량 엑셀 실사</span>
            </div>
          </nav>

          {/* 우측: 작업자 정보 및 도구 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ textAlign: 'right', fontSize: '12px' }}>
              <div style={{ fontWeight: 'bold', color: theme.textMain }}>{workerName} 실사관</div>
              <div style={{ fontSize: '10.5px', color: theme.textSub }}>경기설계팀 자재관리부</div>
            </div>
            <button
              onClick={() => setShowHistory((v) => !v)}
              style={{
                padding: '6px 10px',
                background: showHistory ? '#2563eb' : theme.btnCancel,
                color: showHistory ? '#ffffff' : theme.textMain,
                border: `1px solid ${theme.border}`,
                borderRadius: '4px',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontWeight: 'bold',
              }}
              title="과거 실사 기록 열람"
            >
              <History size={13} />
              <span>기록 ({historyRecords.length})</span>
            </button>
            <button
              onClick={toggleTheme}
              style={{
                padding: '6px 10px',
                background: theme.btnCancel,
                color: theme.textMain,
                border: `1px solid ${theme.border}`,
                borderRadius: '4px',
                fontSize: '12px',
                cursor: 'pointer',
                fontWeight: 'bold',
              }}
            >
              {isDarkMode ? '☀️ 밝게' : '🌙 어둡게'}
            </button>
          </div>
        </div>
      </header>

      {/* 뷰 모드 전환 탭: [챗봇 자재실사] vs [최근 10회 일치율 요약 대시보드] */}
      <div
        className="no-print"
        style={{
          maxWidth: '1280px',
          margin: '14px auto 0',
          padding: '0 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            background: theme.btnCancel,
            padding: '4px',
            borderRadius: '8px',
            border: `1px solid ${theme.border}`,
            gap: '4px',
          }}
        >
          <button
            onClick={() => setActiveTab('chat')}
            style={{
              padding: '7px 16px',
              fontSize: '13px',
              fontWeight: activeTab === 'chat' ? '800' : '600',
              background: activeTab === 'chat' ? '#2563eb' : 'transparent',
              color: activeTab === 'chat' ? '#ffffff' : theme.textSub,
              borderRadius: '5px',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: activeTab === 'chat' ? '0 1px 3px rgba(37,99,235,0.3)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <Bot size={15} />
            <span>🤖 대화형 자재실사 (챗봇)</span>
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            style={{
              padding: '7px 16px',
              fontSize: '13px',
              fontWeight: activeTab === 'analytics' ? '800' : '600',
              background: activeTab === 'analytics' ? '#2563eb' : 'transparent',
              color: activeTab === 'analytics' ? '#ffffff' : theme.textSub,
              borderRadius: '5px',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: activeTab === 'analytics' ? '0 1px 3px rgba(37,99,235,0.3)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <BarChart2 size={15} />
            <span>📊 실사 일치율 요약 대시보드 (최근 10회)</span>
            <span
              style={{
                fontSize: '10px',
                background: activeTab === 'analytics' ? '#ffffff' : '#2563eb',
                color: activeTab === 'analytics' ? '#2563eb' : '#ffffff',
                padding: '1px 6px',
                borderRadius: '10px',
                fontWeight: 'bold',
              }}
            >
              Recharts
            </span>
          </button>
        </div>

        {activeTab === 'chat' && activeReportText && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
              <span>실사 보고서 생성 완료됨</span>
            </span>
            <button
              onClick={() => setActiveTab('analytics')}
              style={{
                fontSize: '11.5px',
                color: '#2563eb',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 'bold',
                textDecoration: 'underline',
              }}
            >
              10회 추이 통계 확인 →
            </button>
          </div>
        )}
      </div>

      {activeTab === 'analytics' ? (
        /* Recharts 요약 대시보드 뷰 */
        <main
          className="no-print"
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            padding: '20px',
            boxSizing: 'border-box',
          }}
        >
          <MaterialAuditSummaryDashboard
            historyRecords={historyRecords}
            theme={theme}
            onSelectAudit={(item) => {
              if (item.reportMarkdown) {
                setActiveReportText(item.reportMarkdown);
                if (item.photoUrls) setMaterialPhotoUrls(item.photoUrls);
                setCountResult({
                  matchRate: item.matchRate,
                  measuredQty: item.measuredQty,
                  docQty: item.docQty,
                  unit: item.unit,
                  statusLabel: item.statusLabel,
                });
                setSelectedItem({
                  id: item.id,
                  seq: (item as any).seq || 1,
                  materialCode: (item as any).materialCode || 'MAT-0001',
                  classSubcategory: (item as any).classSubcategory || '기본자재류',
                  name: item.materialName,
                  spec: item.spec,
                  docQty: item.docQty,
                  unit: item.unit,
                  actualQty: item.measuredQty,
                });
                setActiveTab('chat');
              }
            }}
          />
        </main>
      ) : (
        <>
          {/* 모바일 화면 전용 뷰 전환기: activeReportText가 있을 때 챗봇 vs 1장 실사보고서 토글 */}
          {activeReportText && isMobile && (
            <div
              className="no-print"
              style={{
                maxWidth: '1280px',
                margin: '8px auto 0',
                padding: '0 14px',
                display: 'flex',
                gap: '8px',
              }}
            >
              <button
                type="button"
                onClick={() => setMobilePane('chat')}
                style={{
                  flex: 1,
                  padding: '11px 16px',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  borderRadius: '8px',
                  border: 'none',
                  background: mobilePane === 'chat' ? '#2563eb' : theme.btnCancel,
                  color: mobilePane === 'chat' ? '#ffffff' : theme.textMain,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: mobilePane === 'chat' ? '0 2px 4px rgba(37,99,235,0.3)' : 'none',
                }}
              >
                <Bot size={16} />
                <span>💬 챗봇 대화</span>
              </button>
              <button
                type="button"
                onClick={() => setMobilePane('report')}
                style={{
                  flex: 1,
                  padding: '11px 16px',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  borderRadius: '8px',
                  border: 'none',
                  background: mobilePane === 'report' ? '#2563eb' : theme.btnCancel,
                  color: mobilePane === 'report' ? '#ffffff' : theme.textMain,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: mobilePane === 'report' ? '0 2px 4px rgba(37,99,235,0.3)' : 'none',
                }}
              >
                <FileText size={16} />
                <span>📄 1장 실사보고서</span>
              </button>
            </div>
          )}
          {/* 메인 콘텐츠 영역: 모바일에서는 1열 전폭, 데스크탑에서는 2열 구조 */}
          <main
            style={{
              maxWidth: '1280px',
              margin: '0 auto',
              padding: isMobile ? '12px 10px' : '20px',
              display: 'grid',
              gridTemplateColumns: activeReportText && !isMobile ? '1fr 1fr' : '1fr',
              gap: '20px',
              boxSizing: 'border-box',
            }}
          >
          {/* 좌측: 챗봇 대화창 영역 */}
          <section
            className="no-print"
            style={{
              display: isMobile && activeReportText && mobilePane === 'report' ? 'none' : 'flex',
              background: theme.cardBg,
              border: `1px solid ${theme.border}`,
              borderRadius: '8px',
              flexDirection: 'column',
              height: isMobile ? 'calc(100vh - 160px)' : 'calc(100vh - 120px)',
              minHeight: isMobile ? '500px' : '640px',
              overflow: 'hidden',
            }}
          >
          {/* 챗봇 헤더 */}
          <div
            style={{
              padding: '12px 18px',
              borderBottom: `1px solid ${theme.border}`,
              background: isDarkMode ? '#1e293b' : '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: '#2563eb',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Bot size={18} />
              </div>
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 'bold', color: theme.textMain }}>
                  KT AI 자재실사 챗봇
                </div>
                <div style={{ fontSize: '11px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                  <span>실시간 시각 계측 엔진 준비완료</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {currentStep !== 'upload_doc' && (
                <button
                  onClick={handleReset}
                  style={{
                    padding: '5px 10px',
                    fontSize: '11.5px',
                    background: theme.btnCancel,
                    color: theme.textMain,
                    border: `1px solid ${theme.border}`,
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  title="새 자재 실사 시작"
                >
                  <RotateCcw size={12} />
                  <span>새로 실사하기</span>
                </button>
              )}
            </div>
          </div>

          {/* 챗 메시지 리스트 스크롤 영역 */}
          <div
            style={{
              flex: 1,
              padding: '16px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            {messages.map((msg) => {
              const isBot = msg.sender === 'bot';
              return (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    flexDirection: isBot ? 'row' : 'row-reverse',
                    alignItems: 'flex-start',
                    gap: '10px',
                  }}
                >
                  {/* 아바타 */}
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: isBot ? '#2563eb' : '#475569',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      fontSize: '14px',
                    }}
                  >
                    {isBot ? '🤖' : '👷'}
                  </div>

                  {/* 메시지 버블 및 인터랙티브 카드 */}
                  <div style={{ maxWidth: '82%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div
                      style={{
                        background: isBot ? (isDarkMode ? '#1e293b' : '#f1f5f9') : '#2563eb',
                        color: isBot ? theme.textMain : '#ffffff',
                        padding: '12px 14px',
                        borderRadius: isBot ? '2px 12px 12px 12px' : '12px 2px 12px 12px',
                        fontSize: '13px',
                        lineHeight: 1.5,
                        whiteSpace: 'pre-line',
                        border: isBot ? `1px solid ${theme.border}` : 'none',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                      }}
                    >
                      {msg.text}
                    </div>

                    {/* Step 1 서류 선택/업로드 카드 */}
                    {msg.type === 'doc_picker' && (
                      <div
                        style={{
                          background: theme.cardBg,
                          border: `1.5px dashed ${theme.border}`,
                          borderRadius: '8px',
                          padding: '14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px',
                        }}
                      >
                        {/* 엑셀 파일 직접 업로드 영역 (7MB급 지원) */}
                        <div
                          style={{
                            background: isDarkMode ? '#064e3b22' : '#f0fdf4',
                            border: '1.5px solid #86efac',
                            borderRadius: '8px',
                            padding: '12px 14px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <FileSpreadsheet size={18} color="#16a34a" />
                              <strong style={{ fontSize: '13px', color: '#15803d' }}>
                                📊 자재실사 엑셀 파일 업로드 (권장)
                              </strong>
                            </div>
                            <span
                              style={{
                                fontSize: '10.5px',
                                background: '#16a34a',
                                color: 'white',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontWeight: 'bold',
                              }}
                            >
                              7MB급 지원
                            </span>
                          </div>

                          <div style={{ fontSize: '11px', color: isDarkMode ? '#86efac' : '#166534', lineHeight: 1.4 }}>
                            보유하신 현장 자재불출대장, 납품명세서 엑셀 파일(.xlsx, .xls, .csv, 최대 7MB+)을 등록하시면
                            시트별 자재 목록을 즉시 추출하고 챗봇과 대화하며 실사할 수 있습니다.
                          </div>

                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '2px' }}>
                            <label
                              style={{
                                flex: 1,
                                minWidth: '150px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                padding: '10px 14px',
                                background: '#16a34a',
                                color: 'white',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '12.5px',
                                fontWeight: 'bold',
                                boxShadow: '0 2px 4px rgba(22,163,74,0.25)',
                              }}
                            >
                              <Upload size={14} />
                              <span>내 엑셀 파일 등록 (.xlsx / .xls)</span>
                              <input
                                type="file"
                                accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                                style={{ display: 'none' }}
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) handleParseDocument(f);
                                }}
                              />
                            </label>

                            <button
                              onClick={handleLoadSampleExcel}
                              disabled={isParsingDoc}
                              style={{
                                padding: '10px 14px',
                                background: isDarkMode ? '#1e293b' : '#ffffff',
                                color: '#15803d',
                                border: '1px solid #86efac',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                              }}
                              title="7MB 규격의 KT 경기설계팀 표준 자재실사 엑셀 샘플을 즉시 불러옵니다."
                            >
                              <FileSpreadsheet size={14} />
                              <span>7MB 표준 실사 엑셀 불러오기</span>
                            </button>
                          </div>
                        </div>

                        <div style={{ fontSize: '12px', fontWeight: 'bold', color: theme.textMain, marginTop: '2px' }}>
                          📌 또는 표준 샘플 서류 원클릭 선택
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '6px' }}>
                          <button
                            onClick={() => handleParseDocument('telecom_fdf')}
                            disabled={isParsingDoc}
                            style={{
                              padding: '8px 10px',
                              fontSize: '11.5px',
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              border: '1px solid #bfdbfe',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              textAlign: 'left',
                              fontWeight: '600',
                            }}
                          >
                            <div>⚡ 광선로 자재불출증</div>
                            <div style={{ fontSize: '10px', color: '#60a5fa', marginTop: '2px' }}>FDF, 슬리브, 라바콘 등</div>
                          </button>
                          <button
                            onClick={() => handleParseDocument('base_station')}
                            disabled={isParsingDoc}
                            style={{
                              padding: '8px 10px',
                              fontSize: '11.5px',
                              background: '#f0fdf4',
                              color: '#15803d',
                              border: '1px solid #bbf7d0',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              textAlign: 'left',
                              fontWeight: '600',
                            }}
                          >
                            <div>📡 5G 기지국 납품서</div>
                            <div style={{ fontSize: '10px', color: '#4ade80', marginTop: '2px' }}>안테나, 피뢰침 설비 등</div>
                          </button>
                          <button
                            onClick={() => handleParseDocument('cable_duct')}
                            disabled={isParsingDoc}
                            style={{
                              padding: '8px 10px',
                              fontSize: '11.5px',
                              background: '#faf5ff',
                              color: '#7e22ce',
                              border: '1px solid #e9d5ff',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              textAlign: 'left',
                              fontWeight: '600',
                            }}
                          >
                            <div>🚇 통신구 관로 인수증</div>
                            <div style={{ fontSize: '10px', color: '#c084fc', marginTop: '2px' }}>맨홀뚜껑, 케이블행거 등</div>
                          </button>
                        </div>

                        <div style={{ textAlign: 'center', fontSize: '11px', color: theme.textSub, margin: '2px 0' }}>
                          ── 또는 서류 사진/스캔본 업로드 ──
                        </div>

                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            padding: '10px',
                            background: theme.btnCancel,
                            borderRadius: '6px',
                            cursor: 'pointer',
                            border: `1px solid ${theme.border}`,
                            fontSize: '12px',
                            fontWeight: 'bold',
                            color: theme.textMain,
                          }}
                        >
                          <Upload size={14} />
                          <span>실사 서류 사진/스캔본 등록</span>
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleParseDocument(f);
                            }}
                          />
                        </label>
                      </div>
                    )}

                    {/* Step 2 서류 품목 선택 카드 (엑셀 멀티시트 및 검색 지원) */}
                    {msg.type === 'item_picker' && msg.data && (
                      <div
                        style={{
                          background: theme.cardBg,
                          border: `1px solid ${theme.border}`,
                          borderRadius: '8px',
                          overflow: 'hidden',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          padding: '12px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                          <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={14} />
                            <span>실사 대상 자재를 선택하세요 (또는 챗봇에 말씀하세요)</span>
                          </div>
                          {parsedExcel && (
                            <span style={{ fontSize: '11px', color: theme.textSub, background: theme.btnCancel, padding: '2px 6px', borderRadius: '4px' }}>
                              총 {msg.data.length}개 품목
                            </span>
                          )}
                        </div>

                        {/* 엑셀 다중 워크시트 필터 탭 */}
                        {parsedExcel && parsedExcel.sheetNames.length > 1 && (
                          <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '2px' }}>
                            <button
                              onClick={() => setActiveExcelSheet('ALL')}
                              style={{
                                padding: '4px 8px',
                                fontSize: '11px',
                                borderRadius: '4px',
                                border: 'none',
                                cursor: 'pointer',
                                fontWeight: activeExcelSheet === 'ALL' ? 'bold' : 'normal',
                                background: activeExcelSheet === 'ALL' ? '#2563eb' : theme.btnCancel,
                                color: activeExcelSheet === 'ALL' ? '#ffffff' : theme.textSub,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              전체 시트 ({parsedExcel.materials.length})
                            </button>
                            {parsedExcel.sheetNames.map((sName) => {
                              const count = parsedExcel.sheetMaterials[sName]?.length || 0;
                              return (
                                <button
                                  key={sName}
                                  onClick={() => setActiveExcelSheet(sName)}
                                  style={{
                                    padding: '4px 8px',
                                    fontSize: '11px',
                                    borderRadius: '4px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontWeight: activeExcelSheet === sName ? 'bold' : 'normal',
                                    background: activeExcelSheet === sName ? '#2563eb' : theme.btnCancel,
                                    color: activeExcelSheet === sName ? '#ffffff' : theme.textSub,
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {sName} ({count})
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {/* 자재 검색 입력 필터 */}
                        <div style={{ position: 'relative' }}>
                          <Search
                            size={14}
                            style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: theme.textSub }}
                          />
                          <input
                            type="text"
                            value={itemSearchKeyword}
                            onChange={(e) => setItemSearchKeyword(e.target.value)}
                            placeholder="품목명 검색 (예: 광분배함, 안테나, 케이블...)"
                            style={{
                              width: '100%',
                              padding: '7px 10px 7px 30px',
                              borderRadius: '6px',
                              border: `1px solid ${theme.border}`,
                              background: theme.inputBg,
                              color: theme.textMain,
                              fontSize: '11.5px',
                              outline: 'none',
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>

                        {/* 자재 리스트 */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '240px', overflowY: 'auto' }}>
                          {(() => {
                            const filtered = (msg.data as MaterialItem[]).filter((item: any) => {
                              const matchSheet =
                                activeExcelSheet === 'ALL' || !item.sheetName || item.sheetName === activeExcelSheet;
                              const matchKw =
                                !itemSearchKeyword ||
                                item.name.toLowerCase().includes(itemSearchKeyword.toLowerCase()) ||
                                (item.spec && item.spec.toLowerCase().includes(itemSearchKeyword.toLowerCase()));
                              return matchSheet && matchKw;
                            });

                            if (filtered.length === 0) {
                              return (
                                <div style={{ textAlign: 'center', padding: '16px', fontSize: '11.5px', color: theme.textSub }}>
                                  검색 조건에 맞는 자재가 없습니다.
                                </div>
                              );
                            }

                            return filtered.map((item: any) => {
                              const seq = item.seq || 1;
                              const code = item.materialCode || `MAT-000${seq}`;
                              const subCat = item.classSubcategory || item.category || '기본자재류';
                              const hasActual = item.actualQty !== null && item.actualQty !== undefined;
                              const isMismatch = hasActual && item.actualQty !== item.docQty;

                              return (
                                <div
                                  key={item.id}
                                  onClick={() => handleSelectItem(item)}
                                  style={{
                                    padding: '12px 14px',
                                    background: selectedItem?.id === item.id ? '#eff6ff' : theme.cardBg,
                                    border: `1.5px solid ${selectedItem?.id === item.id ? '#2563eb' : theme.border}`,
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '12px',
                                    transition: 'all 0.15s ease',
                                  }}
                                >
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    {/* 상단 순번(사진연동) 및 3대 핵심 속성 뱃지 */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '5px' }}>
                                      <span style={{ fontSize: '11px', background: '#0f172a', color: '#ffffff', padding: '2px 7px', borderRadius: '4px', fontWeight: '800' }}>
                                        순번 #{seq} 📸 사진 #{seq}
                                      </span>
                                      <span style={{ fontSize: '11px', background: '#e0e7ff', color: '#3730a3', padding: '2px 7px', borderRadius: '4px', fontWeight: 'bold' }}>
                                        코드: {code}
                                      </span>
                                      <span style={{ fontSize: '11px', background: '#ecfdf5', color: '#065f46', padding: '2px 7px', borderRadius: '4px', fontWeight: 'bold' }}>
                                        {subCat}
                                      </span>
                                      {item.sheetName && (
                                        <span style={{ fontSize: '10px', background: isDarkMode ? '#334155' : '#f1f5f9', color: theme.textSub, padding: '1px 5px', borderRadius: '3px' }}>
                                          {item.sheetName}
                                        </span>
                                      )}
                                    </div>

                                    {/* 품명 및 규격 */}
                                    <div style={{ fontSize: '14.5px', fontWeight: 'bold', color: theme.textMain, lineHeight: 1.3 }}>
                                      {item.name}
                                    </div>
                                    <div style={{ fontSize: '12.5px', color: theme.textSub, marginTop: '3px' }}>
                                      사양: {item.spec}
                                    </div>
                                  </div>

                                  {/* 우측 수량 대조 뱃지 (전산 vs 실사) */}
                                  <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
                                    <span
                                      style={{
                                        fontSize: '12.5px',
                                        fontWeight: '800',
                                        padding: '4px 10px',
                                        background: hasActual ? (isMismatch ? '#ef4444' : '#10b981') : '#f59e0b',
                                        color: 'white',
                                        borderRadius: '6px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                      }}
                                    >
                                      {hasActual ? `실사: ${item.actualQty}${item.unit}` : '⚠️ 실사 미계측'}
                                    </span>
                                    <span style={{ fontSize: '12px', color: theme.textSub }}>
                                      전산: <strong>{item.docQty}{item.unit}</strong>
                                    </span>
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>

                        <div style={{ fontSize: '10.5px', color: theme.textSub, textAlign: 'center', paddingTop: '2px' }}>
                          💡 챗봇 대화창에 <strong>&apos;광분배함 실사할래&apos;</strong>처럼 말씀하셔도 자동 선택됩니다.
                        </div>
                      </div>
                    )}

                    {/* Step 3 현장 자재 사진 촬영 / 업로드 카드 */}
                    {msg.type === 'photo_request' && (
                      <div
                        style={{
                          background: theme.cardBg,
                          border: `1px solid ${theme.border}`,
                          borderRadius: '8px',
                          padding: '14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px',
                        }}
                      >
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <label
                            style={{
                              flex: 1,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              padding: '12px',
                              background: '#2563eb',
                              color: 'white',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontWeight: 'bold',
                              fontSize: '12.5px',
                            }}
                          >
                            <Camera size={16} />
                            <span>현장 사진 촬영 / 추가</span>
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              capture="environment"
                              style={{ display: 'none' }}
                              onChange={handlePhotoFiles}
                            />
                          </label>
                        </div>

                        {/* 업로드된 사진 미리보기 썸네일 그리드 */}
                        {materialPhotoUrls.length > 0 && (
                          <div>
                            <div style={{ fontSize: '11.5px', color: theme.textSub, marginBottom: '6px' }}>
                              등록된 현장 사진 ({materialPhotoUrls.length}/5장)
                            </div>
                            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                              {materialPhotoUrls.map((url, pIdx) => (
                                <div
                                  key={pIdx}
                                  style={{
                                    position: 'relative',
                                    width: '74px',
                                    height: '74px',
                                    borderRadius: '6px',
                                    overflow: 'hidden',
                                    border: '1px solid #cbd5e1',
                                    flexShrink: 0,
                                    background: '#f8fafc',
                                  }}
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={url}
                                    alt="자재 사진"
                                    onClick={() => {
                                      setLightboxImages(materialPhotoUrls);
                                      setLightboxIndex(pIdx);
                                      setLightboxOpen(true);
                                    }}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in' }}
                                  />
                                </div>
                              ))}
                            </div>

                            {/* AI 계측 시작 버튼 */}
                            <button
                              onClick={handleRunCounting}
                              disabled={isCounting}
                              style={{
                                width: '100%',
                                marginTop: '10px',
                                padding: '12px',
                                background: isCounting ? '#94a3b8' : '#10b981',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                fontWeight: '800',
                                fontSize: '14px',
                                cursor: isCounting ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                boxShadow: '0 2px 6px rgba(16,185,129,0.3)',
                              }}
                            >
                              <Sparkles size={16} />
                              <span>{isCounting ? 'AI 정밀 시각 계측 진행 중...' : '🔍 AI 실사 계측 및 일치율 산출'}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 실사 수량이 없을 시: '실사 수량 계측을 실시하시겠습니까?' 질문 및 사진 업로드 요청 카드 */}
                    {msg.type === 'photo_prompt_question' && (
                      <div
                        style={{
                          background: isDarkMode ? '#1e293b' : '#eff6ff',
                          border: '1.5px solid #3b82f6',
                          borderRadius: '8px',
                          padding: '14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#1d4ed8', fontWeight: 'bold', fontSize: '14px' }}>
                          <Sparkles size={16} />
                          <span>실사 수량 계측을 실시하시겠습니까?</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '13px', color: theme.textMain, lineHeight: 1.4 }}>
                          현장 자재 사진을 업로드해 주시면 AI 비전 계측을 통해 실사 수량을 자동으로 측정해 드립니다. 📸
                          (순번 #{selectedItem?.seq || 1} ↔ 사진 #{selectedItem?.seq || 1} 연동)
                        </p>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <label
                            style={{
                              flex: 1,
                              minWidth: '160px',
                              padding: '11px 16px',
                              background: '#2563eb',
                              color: 'white',
                              borderRadius: '6px',
                              fontWeight: 'bold',
                              fontSize: '13.5px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              boxShadow: '0 2px 4px rgba(37,99,235,0.3)',
                            }}
                          >
                            <Camera size={16} />
                            <span>📸 실사 수량 계측 실시 (사진 업로드)</span>
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              capture="environment"
                              style={{ display: 'none' }}
                              onChange={handlePhotoFiles}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              handleSendChatMessage('직접 실사 수량을 입력할게요.');
                            }}
                            style={{
                              padding: '11px 14px',
                              background: theme.btnCancel,
                              color: theme.textMain,
                              border: `1px solid ${theme.border}`,
                              borderRadius: '6px',
                              fontWeight: '600',
                              fontSize: '13px',
                              cursor: 'pointer',
                            }}
                          >
                            🔢 직접 수량 입력
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 실사수량 불일치 시 사유 질문 및 빠른 선택 칩 카드 */}
                    {msg.type === 'discrepancy_question' && (
                      <div
                        style={{
                          background: isDarkMode ? '#3b1d1d' : '#fff1f2',
                          border: '1.5px solid #f43f5e',
                          borderRadius: '8px',
                          padding: '14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#e11d48', fontWeight: 'bold', fontSize: '13.5px' }}>
                          <AlertTriangle size={16} />
                          <span>실사 수량 불일치 사유를 선택하거나 입력해주세요:</span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {[
                            '시공 현장 투입 완료',
                            '운반 중 포장 파손 1건',
                            '인근 타현장 긴급 대여',
                            '물류센터 오입고 확인',
                            '현장 실사 재계측 필요',
                          ].map((reasonText) => (
                            <button
                              key={reasonText}
                              type="button"
                              onClick={() => {
                                handleSendChatMessage(`불일치 사유: ${reasonText}`);
                              }}
                              style={{
                                padding: '7px 12px',
                                background: isDarkMode ? '#1e293b' : '#ffffff',
                                color: '#e11d48',
                                border: '1px solid #fda4af',
                                borderRadius: '20px',
                                fontSize: '12.5px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              + {reasonText}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Step 4 계측 결과 요약 카드 */}
                    {msg.type === 'count_result' && msg.data && (
                      <div
                        style={{
                          background: msg.data.matchRate >= 100 ? '#ecfdf5' : '#fef2f2',
                          border: `1.5px solid ${msg.data.matchRate >= 100 ? '#10b981' : '#ef4444'}`,
                          borderRadius: '8px',
                          padding: '14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '14px', fontWeight: '900', color: msg.data.matchRate >= 100 ? '#047857' : '#b91c1c' }}>
                            {msg.data.matchRate >= 100 ? '✅ 수량 일치 (적합)' : '⚠️ 수량 불일치 (주의)'}
                          </span>
                          <span
                            style={{
                              fontSize: '18px',
                              fontWeight: '900',
                              color: msg.data.matchRate >= 100 ? '#059669' : '#dc2626',
                            }}
                          >
                            {msg.data.matchRate}%
                          </span>
                        </div>

                        {/* 수량 대조 표 */}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '8px',
                            background: '#ffffff',
                            padding: '10px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>전산상 장부 수량</div>
                            <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#1e293b' }}>
                              {msg.data.docQty} {msg.data.unit}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>AI 사진 실측 수량</div>
                            <div
                              style={{
                                fontSize: '15px',
                                fontWeight: 'bold',
                                color: msg.data.matchRate >= 100 ? '#059669' : '#dc2626',
                              }}
                            >
                              {msg.data.measuredQty} {msg.data.unit}
                            </div>
                          </div>
                        </div>

                        {/* 불일치 시 빠른 사유 선택 칩 */}
                        {msg.data.matchRate < 100 && (
                          <div style={{ marginTop: '2px' }}>
                            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#dc2626', marginBottom: '6px' }}>
                              ⚠️ 불일치 사유 선택하기:
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                              {['시공 현장 투입 완료', '운반 중 포장 파손 1건', '인근 현장 긴급 대여', '물류센터 오입고'].map((reason) => (
                                <button
                                  key={reason}
                                  type="button"
                                  onClick={() => handleSendChatMessage(`불일치 사유: ${reason}`)}
                                  style={{
                                    padding: '5px 10px',
                                    background: '#ffffff',
                                    color: '#dc2626',
                                    border: '1px solid #fca5a5',
                                    borderRadius: '16px',
                                    fontSize: '11.5px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                  }}
                                >
                                  + {reason}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 조치 및 보고서 액션 버튼 */}
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => {
                              if (isMobile) {
                                setMobilePane('report');
                              } else {
                                const el = document.getElementById('report-panel');
                                if (el) el.scrollIntoView({ behavior: 'smooth' });
                              }
                            }}
                            style={{
                              flex: 1,
                              padding: '10px',
                              background: '#2563eb',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              fontWeight: 'bold',
                              fontSize: '12px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px',
                            }}
                          >
                            <FileText size={14} />
                            <span>{isMobile ? '📄 1장 실사보고서 보기' : '우측 실사보고서 열람'}</span>
                          </button>
                          <button
                            onClick={handleReset}
                            style={{
                              padding: '10px 14px',
                              background: theme.btnCancel,
                              color: theme.textMain,
                              border: `1px solid ${theme.border}`,
                              borderRadius: '4px',
                              fontWeight: 'bold',
                              fontSize: '12px',
                              cursor: 'pointer',
                            }}
                          >
                            다음 자재 실사
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 타임스탬프 */}
                    <div style={{ fontSize: '10px', color: theme.textSub, marginTop: '2px', alignSelf: isBot ? 'flex-start' : 'flex-end' }}>
                      {msg.timestamp}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* AI 생각중/분석중 애니메이션 */}
            {(isParsingDoc || isCounting || isAiThinking) && (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#2563eb', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  🤖
                </div>
                <div style={{ background: theme.btnCancel, padding: '10px 16px', borderRadius: '12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '12px', height: '12px', border: '2px solid #2563eb', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  <span>
                    {isParsingDoc
                      ? '7MB 엑셀 서류를 판독 및 구조화하고 있습니다...'
                      : isCounting
                      ? '사진에서 자재의 개수와 일치율을 정밀 계측하고 있습니다...'
                      : 'AI 챗봇이 보고서 내용 및 답변을 작성하는 중입니다...'}
                  </span>
                </div>
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>

          {/* 챗봇 하단 인터랙티브 대화 입력 바 */}
          <div
            className="no-print"
            style={{
              borderTop: `1px solid ${theme.border}`,
              background: theme.cardBg,
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            {/* 파일 첨부 히든 input */}
            <input
              ref={chatFileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv,image/*,.pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.name.match(/\.(xlsx|xls|csv)$/i) || f.type.includes('spreadsheet') || f.type.includes('excel')) {
                  handleParseDocument(f);
                } else if (f.type.startsWith('image/')) {
                  const combined = [...materialPhotos, f].slice(0, 5);
                  setMaterialPhotos(combined);
                  setMaterialPhotoUrls(combined.map((file) => URL.createObjectURL(file)));
                  if (selectedItem) setCurrentStep('upload_photo');
                } else {
                  handleParseDocument(f);
                }
              }}
            />

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={() => chatFileInputRef.current?.click()}
                disabled={isParsingDoc || isCounting || isAiThinking}
                style={{
                  padding: '9px 12px',
                  background: theme.btnCancel,
                  color: theme.textMain,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  flexShrink: 0,
                }}
                title="7MB 엑셀 서류 또는 현장 자재 사진 첨부"
              >
                <FileSpreadsheet size={15} color="#16a34a" />
                <span>엑셀/사진 첨부</span>
              </button>

              <div style={{ flex: 1, minWidth: 0 }}>
                <TechnicalTermInput
                  value={chatInputText}
                  onChange={setChatInputText}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendChatMessage();
                  }}
                  disabled={isAiThinking}
                  placeholder={
                    isAiThinking
                      ? 'AI 챗봇이 생각 중입니다...'
                      : !parsedExcel && !parsedDoc
                      ? '엑셀 서류(7MB)를 첨부하시거나 대화를 시작하세요...'
                      : !selectedItem
                      ? '실사할 자재명을 말씀해주세요 (예: 광분배함 4개 실사할게)'
                      : !countResult
                      ? '자재 사진을 올려주시거나 질문을 입력하세요...'
                      : '수량 수정이나 비고/조치사항 지시를 입력하세요 (예: 비고에 광분배함 포장 정상 추가해줘)'
                  }
                  theme={{
                    inputBg: theme.inputBg,
                    border: theme.border,
                    textMain: theme.textMain,
                    textSub: theme.textSub,
                    cardBg: theme.cardBg,
                    btnCancel: theme.btnCancel,
                  }}
                  showQuickPills={true}
                  fieldType="general"
                />
              </div>

              <button
                onClick={() => handleSendChatMessage()}
                disabled={!chatInputText.trim() || isAiThinking}
                style={{
                  padding: '10px 16px',
                  background: chatInputText.trim() && !isAiThinking ? '#2563eb' : theme.btnCancel,
                  color: chatInputText.trim() && !isAiThinking ? '#ffffff' : theme.textSub,
                  border: 'none',
                  borderRadius: '6px',
                  cursor: chatInputText.trim() && !isAiThinking ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '12.5px',
                  fontWeight: 'bold',
                  flexShrink: 0,
                  boxShadow: chatInputText.trim() && !isAiThinking ? '0 2px 4px rgba(37,99,235,0.25)' : 'none',
                }}
              >
                <Send size={14} />
                <span>전송</span>
              </button>
            </div>

            {/* 빠른 추천 대화 칩 */}
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
              {!parsedExcel && (
                <button
                  onClick={handleLoadSampleExcel}
                  disabled={isParsingDoc}
                  style={{
                    padding: '4px 9px',
                    fontSize: '11px',
                    background: '#ecfdf5',
                    color: '#059669',
                    border: '1px solid #a7f3d0',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    fontWeight: 'bold',
                  }}
                >
                  📊 7MB 표준 엑셀 로드
                </button>
              )}
              {parsedExcel && (
                <button
                  onClick={() => handleSendChatMessage('이 엑셀 서류에 등록된 주요 자재 품목과 수량을 요약해줘')}
                  disabled={isAiThinking}
                  style={{
                    padding: '4px 9px',
                    fontSize: '11px',
                    background: theme.btnCancel,
                    color: theme.textMain,
                    border: `1px solid ${theme.border}`,
                    borderRadius: '4px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  🔍 엑셀 자재 요약 질문
                </button>
              )}
              {selectedItem && (
                <button
                  onClick={() => handleSendChatMessage(`선택된 [${selectedItem.name}] 자재의 현장 실사 기준과 주의사항을 알려줘`)}
                  disabled={isAiThinking}
                  style={{
                    padding: '4px 9px',
                    fontSize: '11px',
                    background: theme.btnCancel,
                    color: theme.textMain,
                    border: `1px solid ${theme.border}`,
                    borderRadius: '4px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  💡 실사 주의사항 질의
                </button>
              )}
              {countResult && (
                <>
                  <button
                    onClick={() => handleSendChatMessage('실측 수량을 1개 적게 수정한 후 일치율을 다시 계산해줘')}
                    disabled={isAiThinking}
                    style={{
                      padding: '4px 9px',
                      fontSize: '11px',
                      background: '#fef2f2',
                      color: '#dc2626',
                      border: '1px solid #fecaca',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      fontWeight: 'bold',
                    }}
                  >
                    ✏️ 수량 오차 수정
                  </button>
                  <button
                    onClick={() => handleSendChatMessage('특이사항 비고란에 현장 외관 포장 및 봉인 라벨 정상이라고 추가해줘')}
                    disabled={isAiThinking}
                    style={{
                      padding: '4px 9px',
                      fontSize: '11px',
                      background: theme.btnCancel,
                      color: theme.textMain,
                      border: `1px solid ${theme.border}`,
                      borderRadius: '4px',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    📝 외관 상태 비고 추가
                  </button>
                  <button
                    onClick={() => handleSendChatMessage('현재 실사 결과로 공식 자재실사 결과보고서를 완성해줘')}
                    disabled={isAiThinking}
                    style={{
                      padding: '4px 9px',
                      fontSize: '11px',
                      background: '#eff6ff',
                      color: '#2563eb',
                      border: '1px solid #bfdbfe',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      fontWeight: 'bold',
                    }}
                  >
                    📄 보고서 완성하기
                  </button>
                </>
              )}
            </div>
          </div>
        </section>

        {/* 우측: 현장 자재실사 결과보고서 (A4 1페이지 출력 및 저장 패널) */}
        {activeReportText && (
          <section
            id="report-panel"
            style={{
              display: isMobile && mobilePane === 'chat' ? 'none' : 'flex',
              background: theme.cardBg,
              border: `1px solid ${theme.border}`,
              borderRadius: '8px',
              padding: isMobile ? '12px 8px' : '16px',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            {/* 보고서 상단 툴바 */}
            <div
              className="no-print"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px',
                paddingBottom: '12px',
                borderBottom: `1px solid ${theme.border}`,
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: theme.textMain }}>
                  📄 현장 자재실사 결과보고서
                </h3>
                <span style={{ fontSize: '11px', color: theme.textSub }}>
                  A4 1장 인쇄 및 결재 규격 표준 보고서
                </span>
              </div>

              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => {
                    if (activeReportText) {
                      if (!reportActionText) {
                        setReportActionText(
                          selectedItem?.name?.includes('광')
                            ? '광분배함 광점퍼코드 곡률반경 유지 및 먼지 보호캡(Dust Cap) 체결 조치'
                            : '5G 안테나 브래킷 볼트 규정 토크로 재조임 및 방수 테이핑 보강 완료'
                        );
                      }
                      if (!reportNoteText) {
                        setReportNoteText('현장 외관 포장 손상 없음 및 봉인 라벨(Seal) 정상 확인');
                      }
                      if (!reportRecommendationText) {
                        setReportRecommendationText('장부 수량 및 현장 실측 상태 적합 판정 완료');
                      }
                    }
                    setIsEditingRemarksModal(true);
                  }}
                  style={{
                    padding: '8px 12px',
                    background: '#eff6ff',
                    color: '#1d4ed8',
                    border: '1px solid #bfdbfe',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  title="보고서의 조치사항 및 비고를 전문 용어 자동완성과 함께 직접 수정합니다."
                >
                  <Edit3 size={13} />
                  <span>조치사항·비고 직접 수정</span>
                </button>
                <button
                  onClick={handleSaveText}
                  style={{
                    padding: '8px 10px',
                    background: theme.btnCancel,
                    color: theme.textMain,
                    border: `1px solid ${theme.border}`,
                    borderRadius: '4px',
                    fontSize: '11.5px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                  }}
                  title="텍스트 파일로 저장"
                >
                  📝 .txt
                </button>
                <button
                  onClick={handlePrint}
                  style={{
                    padding: '8px 12px',
                    background: theme.btnCancel,
                    color: theme.textMain,
                    border: `1px solid ${theme.border}`,
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Printer size={13} />
                  <span>1장 인쇄</span>
                </button>
                <button
                  onClick={handleDownloadPDF}
                  style={{
                    padding: '8px 14px',
                    background: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: '0 2px 4px rgba(37,99,235,0.25)',
                  }}
                >
                  <Download size={13} />
                  <span>1장 PDF 다운로드</span>
                </button>
              </div>
            </div>

            {/* A4 1페이지 자재실사 보고서 렌더러 */}
            <div
              id="material-report-print-target"
              className="material-print-area"
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                boxShadow: '0 4px 15px rgba(0,0,0,0.06)',
                margin: '0 auto',
                width: '100%',
              }}
            >
              <MaterialReportOnePage
                reportText={activeReportText}
                photoUrls={materialPhotoUrls}
                workerName={workerName}
                dateStr={new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                materialName={selectedItem?.name}
                matchRate={countResult?.matchRate}
                measuredQty={countResult?.measuredQty}
                docQty={selectedItem?.docQty}
                unit={selectedItem?.unit}
                onPhotoClick={(idx) => {
                  setLightboxImages(materialPhotoUrls);
                  setLightboxIndex(idx);
                  setLightboxOpen(true);
                }}
              />
            </div>
          </section>
        )}
      </main>
      </>
      )}

      {/* 과거 자재실사 기록 슬라이드 오버 드로어 */}
      {showHistory && (
        <div
          className="no-print"
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            width: '380px',
            maxWidth: '90vw',
            background: theme.cardBg,
            borderLeft: `1px solid ${theme.border}`,
            boxShadow: '-4px 0 20px rgba(0,0,0,0.2)',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              padding: '16px',
              borderBottom: `1px solid ${theme.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <History size={16} color="#2563eb" />
              <strong style={{ fontSize: '15px', color: theme.textMain }}>과거 자재실사 기록</strong>
            </div>
            <button
              onClick={() => setShowHistory(false)}
              style={{ background: 'none', border: 'none', color: theme.textSub, cursor: 'pointer', fontSize: '16px' }}
            >
              ✕
            </button>
          </div>

          {/* 대시보드 빠른 이동 버튼 */}
          <div style={{ padding: '12px 14px 4px 14px' }}>
            <button
              onClick={() => {
                setActiveTab('analytics');
                setShowHistory(false);
              }}
              style={{
                width: '100%',
                padding: '9px 12px',
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                boxShadow: '0 2px 4px rgba(37,99,235,0.2)',
              }}
            >
              <BarChart2 size={14} />
              <span>📊 10회 일치율 요약 대시보드 열기</span>
            </button>
          </div>

          <div style={{ flex: 1, padding: '10px 14px 14px 14px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {historyRecords.length === 0 ? (
              <div style={{ textAlign: 'center', color: theme.textSub, padding: '30px 0', fontSize: '13px' }}>
                저장된 자재실사 기록이 없습니다.
              </div>
            ) : (
              historyRecords.map((rec) => (
                <div
                  key={rec.id}
                  onClick={() => {
                    setActiveReportText(rec.reportMarkdown);
                    setMaterialPhotoUrls(rec.photoUrls);
                    setCountResult({
                      matchRate: rec.matchRate,
                      measuredQty: rec.measuredQty,
                      docQty: rec.docQty,
                      unit: rec.unit,
                      statusLabel: rec.statusLabel,
                    });
                    setSelectedItem({
                      id: rec.id,
                      seq: rec.seq || 1,
                      materialCode: rec.materialCode || 'MAT-0001',
                      classSubcategory: rec.classSubcategory || '기본자재류',
                      name: rec.materialName,
                      spec: rec.spec,
                      docQty: rec.docQty,
                      unit: rec.unit,
                      actualQty: rec.measuredQty,
                    });
                    setShowHistory(false);
                  }}
                  style={{
                    padding: '12px',
                    borderRadius: '6px',
                    border: `1px solid ${theme.border}`,
                    background: theme.btnCancel,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '13px', color: theme.textMain }}>{rec.materialName}</strong>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 'bold',
                        padding: '1px 6px',
                        borderRadius: '3px',
                        background: rec.matchRate >= 100 ? '#d1fae5' : '#fee2e2',
                        color: rec.matchRate >= 100 ? '#059669' : '#dc2626',
                      }}
                    >
                      일치율 {rec.matchRate}%
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: theme.textSub }}>
                    장부 {rec.docQty}{rec.unit} vs 실측 {rec.measuredQty}{rec.unit}
                  </div>
                  <div style={{ fontSize: '10px', color: '#94a3b8', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{rec.projectNumber}</span>
                    <span>{new Date(rec.createdAt).toLocaleDateString('ko-KR')}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 5. 현장 자재실사 조치사항 및 비고 직접 수정 모달 (전문용어 자동완성 & 오타 제안) */}
      {isEditingRemarksModal && (
        <div
          className="no-print"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(3px)',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            style={{
              background: theme.cardBg,
              border: `1px solid ${theme.border}`,
              borderRadius: '8px',
              width: '100%',
              maxWidth: '680px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              padding: '24px',
              gap: '18px',
            }}
          >
            {/* 모달 헤더 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `1px solid ${theme.border}`, paddingBottom: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 'bold', color: theme.textMain }}>
                    ✏️ 실사 보고서 조치사항 및 비고 수정
                  </h3>
                  <span style={{ fontSize: '11px', background: '#dbeafe', color: '#1d4ed8', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                    전문 용어 자동완성 &amp; 오타 제안
                  </span>
                </div>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: theme.textSub }}>
                  광분배함, 5G 안테나 등 전문 용어 입력 시 실시간 자동 완성 및 오타를 감지하여 1클릭으로 교정합니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingRemarksModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: theme.textSub,
                  cursor: 'pointer',
                  fontSize: '18px',
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>

            {/* 입력 폼 영역 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* 1. 조치사항 입력 */}
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 'bold', color: theme.textMain, marginBottom: '6px' }}>
                  🛠️ 현장 조치사항 (Action Items)
                </label>
                <TechnicalTermInput
                  fieldType="action"
                  value={reportActionText}
                  onChange={setReportActionText}
                  placeholder="예: 광분배함 먼지 보호캡(Dust Cap) 체결 조치, 5G 안테나 볼트 재조임 완료"
                  theme={theme}
                  showQuickPills={true}
                />
              </div>

              {/* 2. 비고 및 특이사항 입력 */}
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 'bold', color: theme.textMain, marginBottom: '6px' }}>
                  📝 현장 비고 및 특이사항 (Remarks &amp; Notes)
                </label>
                <TechnicalTermInput
                  fieldType="note"
                  value={reportNoteText}
                  onChange={setReportNoteText}
                  placeholder="예: 외관 포장 손상 없음 및 봉인 라벨(Seal) 정상 확인, 공사번호 일치"
                  theme={theme}
                  showQuickPills={true}
                />
              </div>

              {/* 3. 종합 검토의견 입력 */}
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 'bold', color: theme.textMain, marginBottom: '6px' }}>
                  📋 종합 검토 및 승인 의견
                </label>
                <TechnicalTermInput
                  isTextarea
                  rows={2}
                  fieldType="general"
                  value={reportRecommendationText}
                  onChange={setReportRecommendationText}
                  placeholder="예: 장부 수량 및 시각 계측 수량 전량 일치하여 자재 불출 승인 완료"
                  theme={theme}
                  showQuickPills={false}
                />
              </div>
            </div>

            {/* 모달 푸터 버튼 */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: `1px solid ${theme.border}`, paddingTop: '14px' }}>
              <button
                type="button"
                onClick={() => setIsEditingRemarksModal(false)}
                style={{
                  padding: '9px 16px',
                  background: theme.btnCancel,
                  color: theme.textMain,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '12.5px',
                }}
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  let updated = activeReportText || '';
                  const remarksSection = `
#### ■ 4. 현장 조치사항 및 비고
| 구분 | 내용 |
|---|---|
| **조치사항 (Action)** | ${reportActionText || '(특이사항 없음)'} |
| **현장 비고 (Note)** | ${reportNoteText || '(정상)'} |
| **종합 검토의견** | ${reportRecommendationText || '(적합)'} |
`;
                  if (updated.includes('현장 조치사항 및 비고')) {
                    updated = updated.replace(/####\s*■\s*4\.\s*현장\s*조치사항\s*및\s*비고[\s\S]*?(?=(?:####|$))/, remarksSection.trim() + '\n\n');
                  } else {
                    updated = updated.trim() + '\n\n' + remarksSection.trim();
                  }
                  setActiveReportText(updated);
                  setIsEditingRemarksModal(false);
                  alert('조치사항 및 비고가 현장 자재실사 결과보고서에 정상 반영되었습니다.');
                }}
                style={{
                  padding: '9px 18px',
                  background: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '12.5px',
                  boxShadow: '0 2px 4px rgba(37,99,235,0.3)',
                }}
              >
                ✓ 보고서에 반영 및 저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 사진 라이트박스 */}
      <ImageLightbox
        isOpen={lightboxOpen}
        images={lightboxImages}
        initialIndex={lightboxIndex}
        title="현장 자재 증빙 사진 확대 검사"
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  );
}

export default function MaterialAuditPage() {
  return (
    <Suspense
      fallback={
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', color: '#64748b' }}>
          자재실사 시스템을 로딩 중입니다...
        </div>
      }
    >
      <MaterialAuditContent />
    </Suspense>
  );
}
