'use client';

import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  Bot,
  Camera,
  Upload,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  X,
  Send,
  Layers,
  ArrowRight,
  ShieldAlert,
  FileCheck,
  RefreshCw,
  FileSpreadsheet,
  Search,
  Check,
} from 'lucide-react';
import confetti from 'canvas-confetti';

export interface CrossCheckItem {
  item: string;
  excel_val: string;
  detected_val: string;
  is_match: boolean;
}

export interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp?: string;
  meta?: {
    matchRate?: number;
    status?: string; // '적합' | '부적합' | '확인필요'
    detectedSpec?: string;
    designSpec?: string;
    diff?: string;
    visualCondition?: string;
    actionProposal?: string;
    crossCheckTable?: CrossCheckItem[];
    photoUrls?: string[];
  };
}

export interface BomMaterialItem {
  id: string;
  code: string;
  name: string;
  spec: string;
  unit: string;
  docQty: number;
  tolerance: string;
}

const DEFAULT_BOM_ITEMS: BomMaterialItem[] = [
  {
    id: 'bom-1',
    code: 'MAT-KT-0101',
    name: '전력 케이블',
    spec: 'FR-CNCO-W 22kV 60㎟, 길이 50m',
    unit: 'm',
    docQty: 50,
    tolerance: '±2%',
  },
  {
    id: 'bom-2',
    code: 'MAT-KT-0102',
    name: '통신용 광케이블',
    spec: '단모드(SM) 48Core 방수형, 길이 300m',
    unit: 'm',
    docQty: 300,
    tolerance: '±1%',
  },
  {
    id: 'bom-3',
    code: 'MAT-KT-0103',
    name: '광분배함 (FDF)',
    spec: 'FDF 24Core 랙마운트형 SC타입 (전면 개방형)',
    unit: '대',
    docQty: 5,
    tolerance: '0% (완전일치)',
  },
  {
    id: 'bom-4',
    code: 'MAT-KT-0104',
    name: '5G 안테나 유닛',
    spec: '3.5GHz 대역 64T64R 매시브MIMO 안테나',
    unit: '대',
    docQty: 3,
    tolerance: '0% (완전일치)',
  },
  {
    id: 'bom-5',
    code: 'MAT-KT-0105',
    name: '고압 전선 (규격 불일치 테스트)',
    spec: '70㎟ 단면적, 내전압 22.9kV, 길이 100m',
    unit: 'm',
    docQty: 100,
    tolerance: '±2%',
  },
];

interface AiSpecVerifyAssistantProps {
  initialMaterialName?: string;
  initialDesignSpec?: string;
  onApplyToReport?: (data: {
    materialName: string;
    spec: string;
    matchRate: number;
    status: string;
    summary: string;
    photoUrls: string[];
  }) => void;
  onClose?: () => void;
  isDarkMode?: boolean;
}

export default function AiSpecVerifyAssistant({
  initialMaterialName = '전력 케이블',
  initialDesignSpec = 'FR-CNCO-W 22kV 60㎟, 길이 50m',
  onApplyToReport,
  onClose,
  isDarkMode = false,
}: AiSpecVerifyAssistantProps) {
  // ─────────────────────────────────────────────────────────────
  // 1. 엑셀 BOM 연동 상태
  // ─────────────────────────────────────────────────────────────
  const [bomItems, setBomItems] = useState<BomMaterialItem[]>(DEFAULT_BOM_ITEMS);
  const [selectedBomId, setSelectedBomId] = useState<string>('bom-1');
  const [bomFileName, setBomFileName] = useState<string>('표준_자재발주_BOM_규격서.xlsx');

  // Step 1: 기준 규격
  const [materialName, setMaterialName] = useState<string>(initialMaterialName);
  const [designSpec, setDesignSpec] = useState<string>(initialDesignSpec);
  const [tolerance, setTolerance] = useState<string>('±2%');

  // Step 2: 사진 업로드
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [autoAnalyze, setAutoAnalyze] = useState<boolean>(true);

  // Step 3 & 4: 챗봇 대화
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init',
      sender: 'ai',
      text: `안녕하세요! 💡 **엑셀 기반 자재 비교 챗봇 어시스턴트**입니다.\n\n1️⃣ 발급받으신 자재 규격 엑셀(BOM)을 업로드하시거나 아래 드롭다운에서 **[오늘 실사할 자재 항목]**을 선택해주세요.\n2️⃣ 현장 자재의 규격 라벨과 전체 모습 사진을 촬영하시면, AI Vision & OCR이 엑셀 기준값과 항목별로 정밀 교차 검증을 수행합니다.`,
      timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputText, setInputText] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [lastAnalysis, setLastAnalysis] = useState<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const excelFileInputRef = useRef<HTMLInputElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const theme = isDarkMode
    ? {
        bg: '#0f172a',
        cardBg: '#1e293b',
        border: '#334155',
        textMain: '#f8fafc',
        textSub: '#94a3b8',
        inputBg: '#0f172a',
        aiBubble: '#1e293b',
        userBubble: '#2563eb',
        thBg: '#0f172a',
      }
    : {
        bg: '#f8fafc',
        cardBg: '#ffffff',
        border: '#e2e8f0',
        textMain: '#0f172a',
        textSub: '#64748b',
        inputBg: '#ffffff',
        aiBubble: '#ffffff',
        userBubble: '#2563eb',
        thBg: '#f1f5f9',
      };

  useEffect(() => {
    chatScrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAnalyzing]);

  // ─────────────────────────────────────────────────────────────
  // 1. 엑셀 파일 파싱 (BOM 연동)
  // ─────────────────────────────────────────────────────────────
  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (jsonRows.length < 2) {
        alert('엑셀 파일에 유효한 데이터 행이 없습니다.');
        return;
      }

      // 헤더 및 행 탐색
      let headerIdx = 0;
      for (let i = 0; i < Math.min(jsonRows.length, 10); i++) {
        const rowStr = (jsonRows[i] || []).join(' ').toLowerCase();
        if (rowStr.includes('품명') || rowStr.includes('자재') || rowStr.includes('규격') || rowStr.includes('사양')) {
          headerIdx = i;
          break;
        }
      }

      const headers = (jsonRows[headerIdx] || []).map((h: any) => String(h || '').trim());
      const nameCol = headers.findIndex((h) => h.includes('품명') || h.includes('자재명') || h.includes('물품'));
      const specCol = headers.findIndex((h) => h.includes('규격') || h.includes('사양') || h.includes('스펙'));
      const codeCol = headers.findIndex((h) => h.includes('코드') || h.includes('번호'));
      const qtyCol = headers.findIndex((h) => h.includes('수량') || h.includes('장부'));
      const unitCol = headers.findIndex((h) => h.includes('단위'));

      const parsedItems: BomMaterialItem[] = [];
      for (let r = headerIdx + 1; r < jsonRows.length; r++) {
        const row = jsonRows[r];
        if (!row || row.length === 0) continue;

        const name = String(row[nameCol !== -1 ? nameCol : 1] || '').trim();
        const spec = String(row[specCol !== -1 ? specCol : 2] || '').trim();
        if (!name && !spec) continue;

        const code = String(row[codeCol !== -1 ? codeCol : 0] || `MAT-${String(parsedItems.length + 1).padStart(4, '0')}`).trim();
        const qty = parseFloat(String(row[qtyCol !== -1 ? qtyCol : 3] || '1')) || 1;
        const unit = String(row[unitCol !== -1 ? unitCol : 4] || '개').trim();

        parsedItems.push({
          id: `excel-bom-${parsedItems.length + 1}`,
          code,
          name: name || '표준 자재',
          spec: spec || '표준 규격 사양',
          unit: unit || '개',
          docQty: qty,
          tolerance: '±2%',
        });
      }

      if (parsedItems.length > 0) {
        setBomItems(parsedItems);
        setBomFileName(file.name);
        handleSelectBomItem(parsedItems[0].id, parsedItems);

        setMessages((prev) => [
          ...prev,
          {
            id: `sys-${Date.now()}`,
            sender: 'ai',
            text: `📊 **엑셀 파일 [${file.name}] 파싱 완료!**\n총 **${parsedItems.length}개 자재 항목**이 드롭다운에 등록되었습니다.\n첫 번째 자재 **[${parsedItems[0].name}]**(${parsedItems[0].spec})이(가) 기준 규격으로 자동 세팅되었습니다. 📸`,
            timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      } else {
        alert('엑셀 파일에서 자재 품명/규격 열을 찾지 못했습니다. 기본 샘플로 유지합니다.');
      }
    } catch (err) {
      console.error('엑셀 파싱 오류:', err);
      alert('엑셀 파일 파싱에 실패했습니다. 올바른 .xlsx 또는 .csv 파일인지 확인해주세요.');
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 2. 드롭다운에서 실사 자재 선택
  // ─────────────────────────────────────────────────────────────
  const handleSelectBomItem = (bomId: string, currentItems = bomItems) => {
    setSelectedBomId(bomId);
    const item = currentItems.find((b) => b.id === bomId);
    if (!item) return;

    setMaterialName(item.name);
    setDesignSpec(item.spec);
    setTolerance(item.tolerance || '±2%');

    // 챗봇 안내 메시지 자동 전송
    setMessages((prev) => [
      ...prev,
      {
        id: `bom-sel-${Date.now()}`,
        sender: 'ai',
        text: `📋 **[엑셀 기준 규격 선택 완료]**\n- 🏷️ **자재코드**: \`${item.code}\`\n- 📦 **자재명(품명)**: **${item.name}**\n- 📐 **설계 기준 규격**: **${item.spec}**\n- 🔢 **전산 장부 수량**: ${item.docQty} ${item.unit} (허용 오차: ${item.tolerance})\n\n이제 현장 자재의 **규격 라벨(스펙 표기부)**과 전체 모습 사진을 촬영/등록해 주세요. AI가 라벨 문자를 판독(OCR)하여 항목별로 교차 검증을 시작합니다! 📸`,
        timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  // 사진 선택 핸들러
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newFiles = Array.from(files).slice(0, 5);
    setPhotos(newFiles);
    const newUrls = newFiles.map((f) => URL.createObjectURL(f));
    setPhotoUrls(newUrls);

    // 스위치가 활성화되어 있으면 사진이 5장 등록되는 즉시 자동으로 분석 시작
    if (autoAnalyze && newFiles.length >= 5) {
      setTimeout(() => {
        handleRunAnalysisWithPhotos(newFiles, newUrls);
      }, 150);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 3 & 4. AI 실시간 계측 및 일치율 분석 (OCR 정밀 교차 검증)
  // ─────────────────────────────────────────────────────────────
  const handleRunAnalysisWithPhotos = async (targetPhotos: File[], targetUrls?: string[]) => {
    if (targetPhotos.length === 0) {
      alert('자재 라벨 또는 전체 모습 사진을 최소 1장 등록해주세요.');
      return;
    }
    if (!designSpec.trim()) {
      alert('설계 기준 규격을 입력하거나 엑셀 드롭다운에서 자재를 선택해주세요.');
      return;
    }

    setIsAnalyzing(true);

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: `[정밀 계측 요청] 엑셀 자재: ${materialName} | 설계 규격: ${designSpec} | 사진 ${targetPhotos.length}장 라벨 OCR 교차 검증 요청`,
      timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsg]);

    const formData = new FormData();
    targetPhotos.forEach((f) => formData.append('images', f));
    formData.append('materialName', materialName);
    formData.append('designSpec', designSpec);
    formData.append('tolerance', tolerance);
    formData.append('conversationHistory', JSON.stringify(messages.slice(-6)));

    try {
      const res = await fetch('/api/material-audit/spec-verify', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || '분석에 실패했습니다.');
      }

      setLastAnalysis(data);

      if (data.match_rate >= 90) {
        confetti({ particleCount: 90, spread: 65, origin: { y: 0.7 } });
      }

      const activeUrls = targetUrls || photoUrls;
      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: data.reply_text || '규격 대조 및 사전 계측 결과가 완료되었습니다.',
        timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        meta: {
          matchRate: data.match_rate,
          status: data.status,
          detectedSpec: data.detected_spec,
          designSpec: designSpec,
          diff: data.differences,
          visualCondition: data.visual_condition,
          actionProposal: data.action_proposal,
          crossCheckTable: data.cross_check_table || [],
          photoUrls: activeUrls,
        },
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'ai',
          text: `⚠️ 분석 중 오류가 발생했습니다: ${err?.message || '네트워크 연결을 확인해주세요.'}`,
          timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRunAnalysis = () => {
    handleRunAnalysisWithPhotos(photos, photoUrls);
  };

  // 추가 대화 전송
  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text.trim() || isAnalyzing) return;

    setInputText('');
    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsg]);

    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/material-audit/spec-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          materialName,
          designSpec,
          tolerance,
          userMessage: text,
          conversationHistory: [...messages, userMsg],
        }),
      });
      const data = await res.json();

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: data.reply_text || data.comparison_summary || '검토되었습니다.',
        timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        meta: {
          matchRate: data.match_rate,
          status: data.status,
          detectedSpec: data.detected_spec,
          designSpec,
          diff: data.differences,
          visualCondition: data.visual_condition,
          actionProposal: data.action_proposal,
          crossCheckTable: data.cross_check_table || [],
        },
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      console.warn('Chat send error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div
      style={{
        background: theme.cardBg,
        border: `1.5px solid ${theme.border}`,
        borderRadius: '12px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        height: '100%',
        maxHeight: '880px',
      }}
    >
      {/* 헤더 */}
      <div
        style={{
          padding: '14px 18px',
          background: isDarkMode ? '#1e293b' : '#2563eb',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Bot size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 'bold', fontSize: '15px' }}>
              💡 엑셀 기반 자재 비교 챗봇 시스템 (BOM 교차 검증)
            </div>
            <div style={{ fontSize: '11px', opacity: 0.9 }}>
              엑셀 규격서 파싱 드롭다운 • 사진 라벨 OCR • 일치율 & 오차 자동 계산
            </div>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
              padding: '6px',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* 4단계 스텝 가이드 바 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          background: isDarkMode ? '#0f172a' : '#f1f5f9',
          borderBottom: `1px solid ${theme.border}`,
          fontSize: '11px',
          textAlign: 'center',
          padding: '8px 4px',
          gap: '4px',
        }}
      >
        <div style={{ fontWeight: 'bold', color: '#2563eb' }}>1. 엑셀 BOM 업로드 & 선택</div>
        <div style={{ fontWeight: photos.length > 0 ? 'bold' : 'normal', color: photos.length > 0 ? '#2563eb' : theme.textSub }}>
          2. 라벨 & 외관 사진 촬영
        </div>
        <div style={{ fontWeight: lastAnalysis ? 'bold' : 'normal', color: lastAnalysis ? '#2563eb' : theme.textSub }}>
          3. AI Vision OCR 교차검증
        </div>
        <div style={{ fontWeight: lastAnalysis ? 'bold' : 'normal', color: lastAnalysis ? (lastAnalysis.match_rate >= 90 ? '#10b981' : '#ef4444') : theme.textSub }}>
          4. 일치율 & 오차 리포팅
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────── */}
      {/* 1 & 2단계 작업 패널 (엑셀 업로드, 드롭다운 자재선택, 사진) */}
      {/* ───────────────────────────────────────────────────────── */}
      <div
        style={{
          padding: '12px 16px',
          background: isDarkMode ? '#1e293b' : '#f8fafc',
          borderBottom: `1px solid ${theme.border}`,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        {/* [1단계] 엑셀 파일 업로드 & 오늘 실사할 자재 드롭다운 */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 'bold', color: theme.textMain, display: 'flex', alignItems: 'center', gap: '5px' }}>
              <FileSpreadsheet size={15} style={{ color: '#10b981' }} />
              <span>[Step 1: 엑셀 파일 업로드 & 실사 자재 선택 (BOM 연동)]</span>
            </span>

            <div style={{ display: 'flex', gap: '6px' }}>
              {/* 엑셀 파일 업로드 버튼 */}
              <label
                style={{
                  fontSize: '11px',
                  padding: '4px 10px',
                  borderRadius: '5px',
                  background: '#10b981',
                  color: '#ffffff',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Upload size={12} />
                <span>엑셀 파일 업로드 (.xlsx)</span>
                <input
                  ref={excelFileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleExcelUpload}
                  style={{ display: 'none' }}
                />
              </label>

              {/* 기본 샘플 BOM 다시 채우기 */}
              <button
                type="button"
                onClick={() => {
                  setBomItems(DEFAULT_BOM_ITEMS);
                  setBomFileName('표준_자재발주_BOM_규격서.xlsx');
                  handleSelectBomItem('bom-1', DEFAULT_BOM_ITEMS);
                }}
                style={{
                  fontSize: '11px',
                  padding: '4px 8px',
                  borderRadius: '5px',
                  background: isDarkMode ? '#334155' : '#e2e8f0',
                  color: theme.textMain,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                💡 기본 샘플
              </button>
            </div>
          </div>

          {/* 오늘 실사할 자재 드롭다운 (Select) */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px' }}>
            <div style={{ position: 'relative' }}>
              <select
                value={selectedBomId}
                onChange={(e) => handleSelectBomItem(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1.5px solid #2563eb',
                  background: isDarkMode ? '#0f172a' : '#ffffff',
                  color: theme.textMain,
                  fontSize: '12.5px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                {bomItems.map((item, idx) => (
                  <option key={item.id} value={item.id}>
                    {idx + 1}. [{item.code}] {item.name} | {item.spec} ({item.docQty}{item.unit})
                  </option>
                ))}
              </select>
            </div>

            {/* 허용 오차 직접 조정 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: theme.textSub, flexShrink: 0 }}>허용오차:</span>
              <input
                type="text"
                value={tolerance}
                onChange={(e) => setTolerance(e.target.value)}
                placeholder="±2%"
                style={{
                  width: '100%',
                  padding: '7px 8px',
                  borderRadius: '6px',
                  border: `1px solid ${theme.border}`,
                  background: theme.inputBg,
                  color: theme.textMain,
                  fontSize: '12px',
                  fontWeight: 'bold',
                }}
              />
            </div>
          </div>

          <div style={{ fontSize: '11px', color: theme.textSub, marginTop: '4px' }}>
            📁 현재 로드된 규격서: <strong>{bomFileName}</strong> (총 {bomItems.length}개 품목 탐색됨)
          </div>
        </div>

        {/* [2단계] 자재 사진 업로드 및 정밀 비교 실행 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', paddingTop: '4px', borderTop: `1px dashed ${theme.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '220px' }}>
            <label
              style={{
                padding: '7px 12px',
                background: photos.length > 0 ? '#10b981' : '#2563eb',
                color: '#fff',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Camera size={14} />
              <span>{photos.length > 0 ? `사진 ${photos.length}장 등록됨` : '📸 [Step 2] 자재 라벨 & 전체 모습 사진 등록'}</span>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                capture="environment"
                onChange={handlePhotoUpload}
                style={{ display: 'none' }}
              />
            </label>

            {/* '자동 AI 분석 실행' 토글 스위치 */}
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: '600',
                color: autoAnalyze ? (isDarkMode ? '#93c5fd' : '#1d4ed8') : theme.textSub,
                background: autoAnalyze
                  ? (isDarkMode ? 'rgba(37,99,235,0.2)' : '#eff6ff')
                  : (isDarkMode ? '#334155' : '#f1f5f9'),
                padding: '4px 8px',
                borderRadius: '16px',
                border: `1px solid ${autoAnalyze ? '#60a5fa' : theme.border}`,
                userSelect: 'none',
              }}
              title="사진이 5장 등록되는 즉시 자동으로 AI Vision 분석이 시작됩니다"
            >
              <Sparkles size={11} style={{ color: autoAnalyze ? '#2563eb' : theme.textSub }} />
              <span>자동 AI 분석</span>
              <div
                style={{
                  position: 'relative',
                  width: '28px',
                  height: '15px',
                  background: autoAnalyze ? '#2563eb' : (isDarkMode ? '#64748b' : '#cbd5e1'),
                  borderRadius: '10px',
                  transition: 'background 0.2s ease',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: '1.5px',
                    left: autoAnalyze ? '14px' : '2px',
                    width: '12px',
                    height: '12px',
                    background: '#ffffff',
                    borderRadius: '50%',
                    transition: 'left 0.2s ease',
                  }}
                />
              </div>
              <input
                type="checkbox"
                checked={autoAnalyze}
                onChange={(e) => setAutoAnalyze(e.target.checked)}
                style={{ display: 'none' }}
              />
            </label>

            {photoUrls.length > 0 && (
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                {photoUrls.map((u, i) => (
                  <img
                    key={i}
                    src={u}
                    alt="thumb"
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '4px',
                      objectFit: 'cover',
                      border: '1px solid #3b82f6',
                    }}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setPhotos([]);
                    setPhotoUrls([]);
                  }}
                  style={{
                    padding: '4px 6px',
                    fontSize: '10.5px',
                    background: 'transparent',
                    border: 'none',
                    color: '#ef4444',
                    cursor: 'pointer',
                  }}
                >
                  지우기
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={isAnalyzing}
            onClick={handleRunAnalysis}
            style={{
              padding: '9px 18px',
              background: isAnalyzing ? '#94a3b8' : '#2563eb',
              color: '#ffffff',
              borderRadius: '6px',
              border: 'none',
              fontSize: '13px',
              fontWeight: 'bold',
              cursor: isAnalyzing ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 6px rgba(37,99,235,0.3)',
            }}
          >
            {isAnalyzing ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>AI Vision OCR 대조 중...</span>
              </>
            ) : (
              <>
                <Sparkles size={14} />
                <span>🔍 AI Vision & OCR 정밀 비교 실행</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 대화창 본문 */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          background: theme.bg,
        }}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '100%',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                flexDirection: msg.sender === 'user' ? 'row-reverse' : 'row',
                maxWidth: '90%',
              }}
            >
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: msg.sender === 'user' ? '#2563eb' : '#059669',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  flexShrink: 0,
                  marginTop: '2px',
                }}
              >
                {msg.sender === 'user' ? '나' : <Bot size={15} />}
              </div>

              <div
                style={{
                  background: msg.sender === 'user' ? theme.userBubble : theme.aiBubble,
                  color: msg.sender === 'user' ? '#ffffff' : theme.textMain,
                  padding: '12px 15px',
                  borderRadius: msg.sender === 'user' ? '12px 2px 12px 12px' : '2px 12px 12px 12px',
                  fontSize: '13px',
                  lineHeight: '1.5',
                  border: msg.sender === 'user' ? 'none' : `1px solid ${theme.border}`,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {msg.text}

                {/* ───────────────────────────────────────────────────── */}
                {/* AI 분석 결과 메타 카드 (일치율 자동 계산 & 차이점 리포팅) */}
                {/* ───────────────────────────────────────────────────── */}
                {msg.meta && (
                  <div
                    style={{
                      marginTop: '12px',
                      padding: '14px',
                      borderRadius: '8px',
                      background: isDarkMode ? '#0f172a' : '#f8fafc',
                      border: `1.5px solid ${
                        (msg.meta.matchRate ?? 100) >= 90 ? '#10b981' : '#f43f5e'
                      }`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    {/* 일치율 배지 (초록 vs 빨강) */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                      {(msg.meta.matchRate ?? 100) >= 90 ? (
                        <div
                          style={{
                            background: '#dcfce7',
                            color: '#15803d',
                            padding: '5px 12px',
                            borderRadius: '20px',
                            fontWeight: 'bold',
                            fontSize: '13px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            boxShadow: '0 1px 3px rgba(21,128,61,0.2)',
                          }}
                        >
                          <CheckCircle2 size={16} />
                          <span>✅ 일치율 {msg.meta.matchRate}% (적합 판정)</span>
                        </div>
                      ) : (
                        <div
                          style={{
                            background: '#ffe4e6',
                            color: '#be123c',
                            padding: '5px 12px',
                            borderRadius: '20px',
                            fontWeight: 'bold',
                            fontSize: '13px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            boxShadow: '0 1px 3px rgba(190,18,60,0.2)',
                          }}
                        >
                          <AlertTriangle size={16} />
                          <span>⚠️ 일치율 {msg.meta.matchRate}% (규격 상이 / 부적합)</span>
                        </div>
                      )}

                      <span style={{ fontSize: '11.5px', color: theme.textSub }}>
                        품질 판정: <strong>{msg.meta.status}</strong>
                      </span>
                    </div>

                    {/* 엑셀 기준값 vs 사진 인식값(OCR) 항목별 교차 검증 테이블 */}
                    {msg.meta.crossCheckTable && msg.meta.crossCheckTable.length > 0 && (
                      <div
                        style={{
                          border: `1px solid ${theme.border}`,
                          borderRadius: '6px',
                          overflow: 'hidden',
                          background: isDarkMode ? '#1e293b' : '#ffffff',
                        }}
                      >
                        <div
                          style={{
                            background: isDarkMode ? '#0f172a' : '#f1f5f9',
                            padding: '6px 10px',
                            fontSize: '11.5px',
                            fontWeight: 'bold',
                            color: theme.textMain,
                            borderBottom: `1px solid ${theme.border}`,
                          }}
                        >
                          📋 엑셀 BOM 기준값 vs 현장 사진(라벨 OCR) 항목별 교차 검증 결과
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                          <thead>
                            <tr style={{ background: isDarkMode ? '#1e293b' : '#f8fafc', borderBottom: `1px solid ${theme.border}` }}>
                              <th style={{ padding: '6px 8px', textAlign: 'left', width: '90px' }}>검증 항목</th>
                              <th style={{ padding: '6px 8px', textAlign: 'left' }}>엑셀 기준 규격</th>
                              <th style={{ padding: '6px 8px', textAlign: 'left' }}>사진 라벨 식별 (OCR)</th>
                              <th style={{ padding: '6px 8px', textAlign: 'center', width: '65px' }}>판정</th>
                            </tr>
                          </thead>
                          <tbody>
                            {msg.meta.crossCheckTable.map((row, rIdx) => (
                              <tr
                                key={rIdx}
                                style={{
                                  borderBottom: `1px solid ${theme.border}`,
                                  background: row.is_match
                                    ? 'transparent'
                                    : isDarkMode
                                    ? '#3b1d1d'
                                    : '#fef2f2',
                                }}
                              >
                                <td style={{ padding: '6px 8px', fontWeight: 'bold' }}>{row.item}</td>
                                <td style={{ padding: '6px 8px', color: theme.textSub }}>{row.excel_val}</td>
                                <td
                                  style={{
                                    padding: '6px 8px',
                                    color: row.is_match ? theme.textMain : '#dc2626',
                                    fontWeight: row.is_match ? 'normal' : 'bold',
                                  }}
                                >
                                  {row.detected_val}
                                </td>
                                <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                  {row.is_match ? (
                                    <span style={{ color: '#15803d', fontWeight: 'bold' }}>✅ 일치</span>
                                  ) : (
                                    <span style={{ color: '#b91c1c', fontWeight: 'bold' }}>⚠️ 불일치</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* 차이점 및 오차 발생 시 자동 계산 경고 박스 */}
                    {(msg.meta.matchRate ?? 100) < 90 && (
                      <div
                        style={{
                          background: isDarkMode ? '#450a0a' : '#fff1f2',
                          border: '1.5px solid #fecdd3',
                          padding: '11px',
                          borderRadius: '6px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '5px',
                        }}
                      >
                        <div style={{ color: '#e11d48', fontWeight: 'bold', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <AlertTriangle size={15} />
                          <span>⚠️ 규격 불일치 경고 (오차 수치 자동 계산)</span>
                        </div>
                        <div style={{ fontSize: '12px', color: theme.textMain, lineHeight: 1.4 }}>
                          • <strong>차이점:</strong> {msg.meta.diff}
                        </div>
                        <div style={{ fontSize: '12px', color: '#be123c', fontWeight: 'bold', lineHeight: 1.4 }}>
                          • 🚨 <strong>조치 제안:</strong> {msg.meta.actionProposal}
                        </div>
                      </div>
                    )}

                    {/* 외관 품질 및 소견 요약 */}
                    <div style={{ fontSize: '11.5px', color: theme.textSub }}>
                      🔍 <strong>외관 분석:</strong> {msg.meta.visualCondition}
                    </div>

                    {/* 보고서 반영 버튼 */}
                    {onApplyToReport && (
                      <button
                        type="button"
                        onClick={() => {
                          onApplyToReport({
                            materialName,
                            spec: msg.meta?.detectedSpec || designSpec,
                            matchRate: msg.meta?.matchRate || 100,
                            status: msg.meta?.status || '적합',
                            summary: msg.meta?.diff !== '없음' ? msg.meta?.diff || '' : '규격 정밀 일치 및 외관 양호',
                            photoUrls: photoUrls,
                          });
                        }}
                        style={{
                          marginTop: '4px',
                          padding: '8px 14px',
                          background: '#2563eb',
                          color: '#fff',
                          borderRadius: '6px',
                          border: 'none',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                        }}
                      >
                        <FileCheck size={14} />
                        <span>이 분석 결과를 1장 실사보고서에 반영하기</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
            {msg.timestamp && (
              <span style={{ fontSize: '10px', color: theme.textSub, marginTop: '2px', padding: '0 4px' }}>
                {msg.timestamp}
              </span>
            )}
          </div>
        ))}
        <div ref={chatScrollRef} />
      </div>

      {/* 하단 대화 입력창 */}
      <div
        style={{
          padding: '10px 14px',
          background: isDarkMode ? '#1e293b' : '#ffffff',
          borderTop: `1px solid ${theme.border}`,
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
        }}
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
          placeholder="추가 질의 입력 (예: '케이블 피복 파손 여부는 어때?', '인증 번호 다시 확인해줘')..."
          style={{
            flex: 1,
            padding: '9px 12px',
            borderRadius: '6px',
            border: `1px solid ${theme.border}`,
            background: theme.inputBg,
            color: theme.textMain,
            fontSize: '13px',
          }}
        />
        <button
          type="button"
          onClick={() => handleSendMessage()}
          disabled={!inputText.trim() || isAnalyzing}
          style={{
            padding: '9px 14px',
            borderRadius: '6px',
            background: !inputText.trim() || isAnalyzing ? '#94a3b8' : '#2563eb',
            color: '#fff',
            border: 'none',
            fontWeight: 'bold',
            fontSize: '13px',
            cursor: !inputText.trim() || isAnalyzing ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <Send size={14} />
          <span>전송</span>
        </button>
      </div>
    </div>
  );
}
