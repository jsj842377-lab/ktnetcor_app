'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import {
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Package,
  Layers,
  ArrowRight,
  ShieldAlert,
  Info,
  Calendar,
  Sparkles,
} from 'lucide-react';

export interface AuditHistoryItem {
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
  status: string; // 'MATCH' | 'SHORTAGE' | 'EXCESS'
  statusLabel: string;
  reportMarkdown?: string;
  photoUrls?: string[];
  createdAt: string;
  inspector: string;
}

interface MaterialAuditSummaryDashboardProps {
  historyRecords?: AuditHistoryItem[];
  theme?: any;
  onSelectAudit?: (item: AuditHistoryItem) => void;
}

// 초기 데이터가 적을 때 10회의 연속 실사 이력을 보여주기 위한 기본 표본 데이터
const SAMPLE_PAST_10_AUDITS: AuditHistoryItem[] = [
  {
    id: 'sample-audit-1',
    projectNumber: '안산-광선로-2026-0210',
    materialName: '옥외용 광분배함(FDF)',
    spec: '24C 벽부형 알루미늄',
    docQty: 4,
    measuredQty: 4,
    unit: '개',
    matchRate: 100,
    status: 'MATCH',
    statusLabel: '일치 (적합)',
    createdAt: '2026-10-15T09:10:00Z',
    inspector: '김철수',
  },
  {
    id: 'sample-audit-2',
    projectNumber: '안산-광선로-2026-0210',
    materialName: '광접속 보호 슬리브',
    spec: '40mm 단심용 (100개입)',
    docQty: 5,
    measuredQty: 4,
    unit: '팩',
    matchRate: 80,
    status: 'SHORTAGE',
    statusLabel: '수량 부족 (1팩 미납)',
    createdAt: '2026-10-15T09:25:00Z',
    inspector: '김철수',
  },
  {
    id: 'sample-audit-3',
    projectNumber: '성남-분당-2026-0315',
    materialName: '5G Massive MIMO 안테나',
    spec: '3.5GHz 64T64R',
    docQty: 3,
    measuredQty: 3,
    unit: '대',
    matchRate: 100,
    status: 'MATCH',
    statusLabel: '일치 (적합)',
    createdAt: '2026-10-14T14:00:00Z',
    inspector: '이영희',
  },
  {
    id: 'sample-audit-4',
    projectNumber: '성남-분당-2026-0315',
    materialName: '동축 점퍼 케이블',
    spec: '1/2인치 5m 딘-딘',
    docQty: 12,
    measuredQty: 10,
    unit: '가닥',
    matchRate: 83,
    status: 'SHORTAGE',
    statusLabel: '수량 부족 (-2가닥)',
    createdAt: '2026-10-14T14:30:00Z',
    inspector: '이영희',
  },
  {
    id: 'sample-audit-5',
    projectNumber: '수원-팔달-2026-0188',
    materialName: '주철 맨홀 뚜껑 및 틀',
    spec: '원형 648mm 차도용 20톤',
    docQty: 2,
    measuredQty: 2,
    unit: '조',
    matchRate: 100,
    status: 'MATCH',
    statusLabel: '일치 (적합)',
    createdAt: '2026-10-13T10:15:00Z',
    inspector: '박민수',
  },
  {
    id: 'sample-audit-6',
    projectNumber: '수원-팔달-2026-0188',
    materialName: '광접속 보호 슬리브',
    spec: '40mm 단심용 (100개입)',
    docQty: 10,
    measuredQty: 8,
    unit: '팩',
    matchRate: 80,
    status: 'SHORTAGE',
    statusLabel: '수량 부족 (-2팩)',
    createdAt: '2026-10-13T11:00:00Z',
    inspector: '박민수',
  },
  {
    id: 'sample-audit-7',
    projectNumber: '안양-동안-2026-0142',
    materialName: '접지동봉',
    spec: '14Φ × 1000mm KS규격',
    docQty: 6,
    measuredQty: 6,
    unit: '개',
    matchRate: 100,
    status: 'MATCH',
    statusLabel: '일치 (적합)',
    createdAt: '2026-10-12T15:20:00Z',
    inspector: '정동진',
  },
  {
    id: 'sample-audit-8',
    projectNumber: '안양-동안-2026-0142',
    materialName: '공사용 반사 라바콘',
    spec: '70cm 고휘도 반사체',
    docQty: 8,
    measuredQty: 8,
    unit: '개',
    matchRate: 100,
    status: 'MATCH',
    statusLabel: '일치 (적합)',
    createdAt: '2026-10-12T16:00:00Z',
    inspector: '정동진',
  },
  {
    id: 'sample-audit-9',
    projectNumber: '화성-동탄-2026-0099',
    materialName: '동축 점퍼 케이블',
    spec: '1/2인치 5m 딘-딘',
    docQty: 8,
    measuredQty: 7,
    unit: '가닥',
    matchRate: 88,
    status: 'SHORTAGE',
    statusLabel: '수량 부족 (-1가닥)',
    createdAt: '2026-10-11T13:40:00Z',
    inspector: '강태석',
  },
  {
    id: 'sample-audit-10',
    projectNumber: '화성-동탄-2026-0099',
    materialName: '광케이블 접속함체 (OFJC)',
    spec: '직선/분기 겸용 48C',
    docQty: 2,
    measuredQty: 2,
    unit: '조',
    matchRate: 100,
    status: 'MATCH',
    statusLabel: '일치 (적합)',
    createdAt: '2026-10-11T14:10:00Z',
    inspector: '강태석',
  },
];

function AuditChartTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isMatch = data.matchRate === 100;

    return (
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(4px)',
          color: '#ffffff',
          padding: '12px 14px',
          borderRadius: '6px',
          border: '1px solid #334155',
          boxShadow: '0 8px 20px rgba(0,0,0,0.3)',
          fontSize: '12px',
          fontFamily: 'inherit',
          lineHeight: 1.4,
          maxWidth: '280px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
          <strong style={{ fontSize: '13px', color: '#60a5fa' }}>{data.materialName}</strong>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 'bold',
              padding: '2px 6px',
              borderRadius: '3px',
              background: isMatch ? '#059669' : '#dc2626',
              color: '#ffffff',
            }}
          >
            {data.matchRate}%
          </span>
        </div>

        <div style={{ color: '#94a3b8', fontSize: '11px', marginBottom: '6px' }}>
          사양: {data.spec} | 공사: {data.projectNumber}
        </div>

        <div style={{ background: '#1e293b', padding: '6px 8px', borderRadius: '4px', marginBottom: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#cbd5e1' }}>서류 수량:</span>
            <strong style={{ color: '#ffffff' }}>{data.docQty} {data.unit}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#cbd5e1' }}>AI 실측 수량:</span>
            <strong style={{ color: isMatch ? '#34d399' : '#f87171' }}>{data.measuredQty} {data.unit}</strong>
          </div>
          {data.diff !== 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#fca5a5', fontWeight: 'bold', borderTop: '1px solid #334155', paddingTop: '4px', marginTop: '4px' }}>
              <span>오차 수량:</span>
              <span>{data.diff > 0 ? `+${data.diff}` : data.diff} {data.unit}</span>
            </div>
          )}
        </div>

        <div style={{ fontSize: '10.5px', color: '#94a3b8', display: 'flex', justifyContent: 'space-between' }}>
          <span>실사자: {data.inspector}</span>
          <span>{data.createdAt.slice(0, 10)}</span>
        </div>
      </div>
    );
  }
  return null;
}

export default function MaterialAuditSummaryDashboard({
  historyRecords = [],
  theme,
  onSelectAudit,
}: MaterialAuditSummaryDashboardProps) {
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [filterMode, setFilterMode] = useState<'all' | 'discrepancy' | 'matched'>('all');
  const [selectedBar, setSelectedBar] = useState<any | null>(null);

  const currentTheme = theme || {
    bg: '#f8fafc',
    cardBg: '#ffffff',
    textMain: '#0f172a',
    textSub: '#475569',
    border: '#cbd5e1',
    inputBg: '#f8fafc',
    mdTableHead: '#f1f5f9',
    btnCancel: '#e2e8f0',
  };

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 1. 최근 10회 데이터 구성 (실제 사용자의 기록 우선 + 부족분은 표본으로 채워 항상 10개 트렌드 유지)
  const last10Audits: AuditHistoryItem[] = useMemo(() => {
    const combined = [...historyRecords];
    if (combined.length < 10) {
      const needed = 10 - combined.length;
      combined.push(...SAMPLE_PAST_10_AUDITS.slice(0, needed));
    }
    return combined.slice(0, 10);
  }, [historyRecords]);

  // 2. Recharts용 차트 데이터 포맷팅
  const chartData = useMemo(() => {
    return last10Audits.map((item, idx) => {
      const shortName = item.materialName.length > 7
        ? item.materialName.slice(0, 6) + '..'
        : item.materialName;
      const datePart = item.createdAt ? item.createdAt.slice(5, 10) : `0${10 - idx}`;
      const diff = item.measuredQty - item.docQty;

      return {
        ...item,
        index: idx + 1,
        chartLabel: `${idx + 1}. ${shortName}`,
        datePart,
        diff,
        isDiscrepant: item.matchRate !== 100,
      };
    });
  }, [last10Audits]);

  // 3. 필터링된 차트 데이터
  const displayChartData = useMemo(() => {
    if (filterMode === 'discrepancy') {
      return chartData.filter((d) => d.isDiscrepant);
    }
    if (filterMode === 'matched') {
      return chartData.filter((d) => !d.isDiscrepant);
    }
    return chartData;
  }, [chartData, filterMode]);

  // 4. 반복 불일치 품목 및 통계 집계
  const analytics = useMemo(() => {
    const totalCount = last10Audits.length;
    const matchCount = last10Audits.filter((a) => a.matchRate === 100).length;
    const discrepancyCount = totalCount - matchCount;
    const complianceRate = Math.round((matchCount / totalCount) * 100);

    const sumRate = last10Audits.reduce((acc, curr) => acc + curr.matchRate, 0);
    const avgMatchRate = Math.round(sumRate / totalCount);

    // 품목별 불일치 빈도수 집계
    const discrepancyFrequency: Record<
      string,
      { count: number; totalAttempts: number; sumDiff: number; unit: string; lastProject: string }
    > = {};

    last10Audits.forEach((a) => {
      const key = a.materialName;
      if (!discrepancyFrequency[key]) {
        discrepancyFrequency[key] = {
          count: 0,
          totalAttempts: 0,
          sumDiff: 0,
          unit: a.unit,
          lastProject: a.projectNumber,
        };
      }
      discrepancyFrequency[key].totalAttempts += 1;
      if (a.matchRate !== 100) {
        discrepancyFrequency[key].count += 1;
        discrepancyFrequency[key].sumDiff += (a.measuredQty - a.docQty);
      }
    });

    // 2회 이상 반복 불일치 발생 품목 추출
    const recurringDiscrepancies = Object.entries(discrepancyFrequency)
      .filter(([_, stats]) => stats.count >= 2)
      .map(([name, stats]) => ({
        materialName: name,
        discrepancyCount: stats.count,
        totalAttempts: stats.totalAttempts,
        failRate: Math.round((stats.count / stats.totalAttempts) * 100),
        sumDiff: stats.sumDiff,
        unit: stats.unit,
        lastProject: stats.lastProject,
      }))
      .sort((a, b) => b.discrepancyCount - a.discrepancyCount);

    // 단발성 불일치 품목 (1회 발생)
    const singleDiscrepancies = Object.entries(discrepancyFrequency)
      .filter(([_, stats]) => stats.count === 1)
      .map(([name, stats]) => ({
        materialName: name,
        sumDiff: stats.sumDiff,
        unit: stats.unit,
        lastProject: stats.lastProject,
      }));

    return {
      totalCount,
      matchCount,
      discrepancyCount,
      complianceRate,
      avgMatchRate,
      recurringDiscrepancies,
      singleDiscrepancies,
    };
  }, [last10Audits]);

  return (
    <div
      style={{
        background: currentTheme.cardBg,
        border: `1px solid ${currentTheme.border}`,
        borderRadius: '8px',
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        color: currentTheme.textMain,
      }}
    >
      {/* 1. 상단 통계 헤더 배너 (KPI & 일치율 지표) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          borderBottom: `1px solid ${currentTheme.border}`,
          paddingBottom: '14px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>📊</span>
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: currentTheme.textMain }}>
              최근 10회 자재실사 일치율 분석 대시보드
            </h3>
            <span
              style={{
                fontSize: '11px',
                background: analytics.discrepancyCount > 0 ? '#fee2e2' : '#ecfdf5',
                color: analytics.discrepancyCount > 0 ? '#b91c1c' : '#047857',
                border: `1px solid ${analytics.discrepancyCount > 0 ? '#fca5a5' : '#a7f3d0'}`,
                padding: '2px 8px',
                borderRadius: '4px',
                fontWeight: 'bold',
              }}
            >
              {analytics.discrepancyCount > 0
                ? `⚠️ 불일치 ${analytics.discrepancyCount}건 발생`
                : '✅ 전회 적합 완료'}
            </span>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
            최근 10건의 자재 실사 결과를 시각화하고, 반복적으로 오차가 발생하는 품목을 자동 추적합니다.
          </p>
        </div>

        {/* 4대 주요 핵심 KPI 카드 */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              padding: '8px 12px',
              borderRadius: '6px',
              textAlign: 'center',
              minWidth: '85px',
            }}
          >
            <div style={{ fontSize: '10.5px', color: '#64748b' }}>평균 일치율</div>
            <div
              style={{
                fontSize: '17px',
                fontWeight: '900',
                color: analytics.avgMatchRate >= 95 ? '#059669' : '#dc2626',
              }}
            >
              {analytics.avgMatchRate}%
            </div>
          </div>

          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              padding: '8px 12px',
              borderRadius: '6px',
              textAlign: 'center',
              minWidth: '85px',
            }}
          >
            <div style={{ fontSize: '10.5px', color: '#64748b' }}>적합 준수율</div>
            <div style={{ fontSize: '17px', fontWeight: '900', color: '#2563eb' }}>
              {analytics.complianceRate}%
            </div>
          </div>

          <div
            style={{
              background: analytics.discrepancyCount > 0 ? '#fef2f2' : '#f8fafc',
              border: `1px solid ${analytics.discrepancyCount > 0 ? '#fecaca' : '#e2e8f0'}`,
              padding: '8px 12px',
              borderRadius: '6px',
              textAlign: 'center',
              minWidth: '85px',
            }}
          >
            <div style={{ fontSize: '10.5px', color: analytics.discrepancyCount > 0 ? '#dc2626' : '#64748b', fontWeight: 'bold' }}>
              오차 발생
            </div>
            <div
              style={{
                fontSize: '17px',
                fontWeight: '900',
                color: analytics.discrepancyCount > 0 ? '#dc2626' : '#059669',
              }}
            >
              {analytics.discrepancyCount}회
            </div>
          </div>
        </div>
      </div>

      {/* 2. 반복 불일치 품목 알림 배너 (Recurring Discrepancy Highlight) */}
      {analytics.recurringDiscrepancies.length > 0 && (
        <div
          style={{
            background: '#fff1f2',
            border: '1.5px solid #fda4af',
            borderRadius: '6px',
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#be123c', fontWeight: '800', fontSize: '13.5px' }}>
              <ShieldAlert size={18} />
              <span>반복 오차 검출 품목 ({analytics.recurringDiscrepancies.length}종 집중 관리 권고)</span>
            </div>
            <span style={{ fontSize: '11px', color: '#e11d48', background: '#ffe4e6', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
              협력사 납품 및 송장 수량 정밀 재확인 요망
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '8px' }}>
            {analytics.recurringDiscrepancies.map((rec, idx) => (
              <div
                key={idx}
                style={{
                  background: '#ffffff',
                  border: '1px solid #fecdd3',
                  borderRadius: '5px',
                  padding: '9px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <strong style={{ fontSize: '13px', color: '#0f172a' }}>{rec.materialName}</strong>
                    <span style={{ fontSize: '10.5px', background: '#f43f5e', color: 'white', padding: '1px 5px', borderRadius: '3px', fontWeight: 'bold' }}>
                      {rec.discrepancyCount}회 불일치
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                    누적 부족 수량: <strong style={{ color: '#e11d48' }}>{rec.sumDiff} {rec.unit}</strong> | 최근 공사: {rec.lastProject}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '10px', color: '#94a3b8' }}>불일치율</div>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#e11d48' }}>
                    {rec.failRate}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Recharts 바 차트 컨트롤 및 필터 탭 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => setFilterMode('all')}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: filterMode === 'all' ? 'bold' : 'normal',
              background: filterMode === 'all' ? '#1e293b' : '#f1f5f9',
              color: filterMode === 'all' ? '#ffffff' : '#475569',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            최근 10회 전체보기
          </button>
          <button
            onClick={() => setFilterMode('discrepancy')}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: filterMode === 'discrepancy' ? 'bold' : 'normal',
              background: filterMode === 'discrepancy' ? '#ef4444' : '#fee2e2',
              color: filterMode === 'discrepancy' ? '#ffffff' : '#b91c1c',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span>⚠️ 오차 발생 건만 ({analytics.discrepancyCount})</span>
          </button>
          <button
            onClick={() => setFilterMode('matched')}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: filterMode === 'matched' ? 'bold' : 'normal',
              background: filterMode === 'matched' ? '#10b981' : '#d1fae5',
              color: filterMode === 'matched' ? '#ffffff' : '#047857',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            100% 일치 건만 ({analytics.matchCount})
          </button>
        </div>

        {/* 범례 표시 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: '#64748b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#10b981' }} />
            <span>100% 정상 일치</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#ef4444' }} />
            <span>수량 부족 (오차)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#3b82f6' }} />
            <span>수량 초과</span>
          </div>
        </div>
      </div>

      {/* 4. Recharts 인터랙티브 바 차트 렌더링 영역 */}
      <div
        style={{
          width: '100%',
          height: '280px',
          background: currentTheme.inputBg,
          border: `1px solid ${currentTheme.border}`,
          borderRadius: '6px',
          padding: '10px 10px 0 0',
          boxSizing: 'border-box',
        }}
      >
        {isMounted ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={displayChartData}
              margin={{ top: 15, right: 20, left: -10, bottom: 25 }}
              onClick={(state: any) => {
                if (state && state.activePayload && state.activePayload.length) {
                  const clicked = state.activePayload[0].payload;
                  setSelectedBar(clicked);
                  if (onSelectAudit) onSelectAudit(clicked);
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis
                dataKey="chartLabel"
                tick={{ fontSize: 11, fill: '#475569' }}
                interval={0}
                angle={-15}
                textAnchor="end"
                height={40}
              />
              <YAxis
                domain={[0, 120]}
                ticks={[0, 25, 50, 75, 100, 120]}
                unit="%"
                tick={{ fontSize: 11, fill: '#64748b' }}
              />
              <Tooltip content={<AuditChartTooltip />} />
              {/* 100% 기준선 강조 */}
              <ReferenceLine
                y={100}
                stroke="#10b981"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: '기준 (100%)',
                  position: 'right',
                  fill: '#059669',
                  fontSize: 10.5,
                  fontWeight: 'bold',
                }}
              />
              <Bar dataKey="matchRate" radius={[4, 4, 0, 0]} maxBarSize={45}>
                {displayChartData.map((entry, index) => {
                  let barColor = '#10b981';
                  if (entry.matchRate < 100) barColor = '#ef4444';
                  else if (entry.matchRate > 100) barColor = '#3b82f6';

                  return (
                    <Cell
                      key={`cell-${index}`}
                      fill={barColor}
                      cursor="pointer"
                      opacity={selectedBar?.id === entry.id ? 1 : 0.88}
                      stroke={selectedBar?.id === entry.id ? '#0f172a' : 'none'}
                      strokeWidth={2}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '13px' }}>
            차트를 렌더링하고 있습니다...
          </div>
        )}
      </div>

      {/* 5. 선택된 바 상세 정보 또는 빠른 리스트 카드 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: '8px',
          maxHeight: '170px',
          overflowY: 'auto',
          paddingRight: '4px',
        }}
      >
        {displayChartData.map((item) => {
          const isMatch = item.matchRate === 100;
          const isSelected = selectedBar?.id === item.id;

          return (
            <div
              key={item.id}
              onClick={() => {
                setSelectedBar(item);
                if (onSelectAudit) onSelectAudit(item);
              }}
              style={{
                border: isSelected
                  ? '1.5px solid #2563eb'
                  : `1px solid ${isMatch ? '#e2e8f0' : '#fecaca'}`,
                background: isSelected
                  ? '#eff6ff'
                  : isMatch
                  ? '#ffffff'
                  : '#fff5f5',
                padding: '9px 12px',
                borderRadius: '5px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '3px',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '12px', color: '#0f172a' }}>{item.materialName}</strong>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: '800',
                    color: isMatch ? '#059669' : '#dc2626',
                  }}
                >
                  {item.matchRate}%
                </span>
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                장부: {item.docQty}{item.unit} / 실측: <strong style={{ color: isMatch ? '#059669' : '#dc2626' }}>{item.measuredQty}{item.unit}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#94a3b8' }}>
                <span>{item.projectNumber}</span>
                <span>{item.datePart}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
