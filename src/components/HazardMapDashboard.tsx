'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  InspectionLocationPoint,
  convertReportToLocationPoint,
  SAMPLE_HAZARD_LOCATIONS,
} from '@/utils/locationParser';
import {
  AlertTriangle,
  ShieldCheck,
  MapPin,
  Layers,
  Search,
  Maximize2,
  Navigation,
  ExternalLink,
  Calendar,
  User,
  Activity,
  X,
  FileText,
  Eye,
} from 'lucide-react';

interface HazardMapDashboardProps {
  reports: any[];
  onSelectReport?: (reportId: string) => void;
  onPhotoClick?: (photos: string[], index: number) => void;
  theme?: any;
}

export default function HazardMapDashboard({
  reports = [],
  onSelectReport,
  onPhotoClick,
  theme,
}: HazardMapDashboardProps) {
  const cardBg = theme?.cardBg || '#ffffff';
  const borderColor = theme?.border || '#cbd5e1';
  const textMain = theme?.textMain || '#0f172a';
  const textSub = theme?.textSub || '#64748b';

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);

  const [selectedPoint, setSelectedPoint] = useState<InspectionLocationPoint | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'danger' | 'ok'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [tileMode, setTileMode] = useState<'streets' | 'satellite'>('streets');
  const [isMapReady, setIsMapReady] = useState<boolean>(false);
  const [includeSamples, setIncludeSamples] = useState<boolean>(true);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

  // 1. 보고서 데이터 가공 및 포인트 목록 생성
  const allPoints: InspectionLocationPoint[] = useMemo(() => {
    const realPoints = reports
      .filter((r) => !r.deleted_at)
      .map((r, i) => convertReportToLocationPoint(r, i));

    if (includeSamples) {
      // 실제 보고서와 샘플 합치기 (실제 보고서 우선)
      return [...realPoints, ...SAMPLE_HAZARD_LOCATIONS];
    }
    return realPoints.length > 0 ? realPoints : SAMPLE_HAZARD_LOCATIONS;
  }, [reports, includeSamples]);

  // 2. 필터링된 포인트 목록
  const filteredPoints = useMemo(() => {
    return allPoints.filter((pt) => {
      // 상태 필터
      if (filterMode === 'danger' && pt.status !== 'danger') return false;
      if (filterMode === 'ok' && pt.status !== 'ok') return false;

      // 검색어 필터
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesProj = pt.projectNumber.toLowerCase().includes(q);
        const matchesInspector = pt.inspector.toLowerCase().includes(q);
        const matchesLocation = pt.locationText.toLowerCase().includes(q);
        const matchesWork = pt.workType.toLowerCase().includes(q) || pt.workDesc.toLowerCase().includes(q);
        const matchesDanger = pt.dangerItems.some((d) => d.name.toLowerCase().includes(q) || d.note.toLowerCase().includes(q));
        if (!matchesProj && !matchesInspector && !matchesLocation && !matchesWork && !matchesDanger) {
          return false;
        }
      }
      return true;
    });
  }, [allPoints, filterMode, searchQuery]);

  // 통계 집계
  const stats = useMemo(() => {
    const total = allPoints.length;
    const danger = allPoints.filter((p) => p.status === 'danger').length;
    const ok = allPoints.filter((p) => p.status === 'ok').length;
    const rate = total > 0 ? Math.round((danger / total) * 100) : 0;
    const latestDanger = allPoints.find((p) => p.status === 'danger');
    return { total, danger, ok, rate, latestDanger };
  }, [allPoints]);

  // 3. Leaflet 맵 초기화
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let isMounted = true;

    const initMap = async () => {
      const L = (await import('leaflet')).default;

      if (!mapContainerRef.current) return;
      if (mapInstanceRef.current) return;

      // 초기 중심: 경기도 안산/성남 권역 (37.33, 126.98)
      const map = L.map(mapContainerRef.current, {
        center: [37.3300, 126.9800],
        zoom: 11,
        zoomControl: false,
        attributionControl: false,
      });

      // 줌 컨트롤 우측 하단 배치
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // 타일 레이어 (기본: OSM)
      const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        subdomains: ['a', 'b', 'c'],
      });
      streetLayer.addTo(map);
      tileLayerRef.current = streetLayer;

      // 마커 레이어 그룹
      const markersLayer = L.layerGroup().addTo(map);
      markersLayerRef.current = markersLayer;

      mapInstanceRef.current = map;
      if (isMounted) setIsMapReady(true);
    };

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // 4. 타일 레이어 전환 (일반 / 위성)
  useEffect(() => {
    if (!isMapReady || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    (async () => {
      const L = (await import('leaflet')).default;

      if (tileLayerRef.current) {
        map.removeLayer(tileLayerRef.current);
      }

      if (tileMode === 'streets') {
        const street = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          subdomains: ['a', 'b', 'c'],
        });
        street.addTo(map);
        tileLayerRef.current = street;
      } else {
        // Esri Satellite
        const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 18,
        });
        sat.addTo(map);
        tileLayerRef.current = sat;
      }
    })();
  }, [tileMode, isMapReady]);

  // 5. 마커 렌더링
  useEffect(() => {
    if (!isMapReady || !mapInstanceRef.current || !markersLayerRef.current) return;

    (async () => {
      const L = (await import('leaflet')).default;
      const markersLayer = markersLayerRef.current;
      markersLayer.clearLayers();

      const bounds = L.latLngBounds([]);

      filteredPoints.forEach((point) => {
        const isDanger = point.status === 'danger';
        const isSelected = selectedPoint?.id === point.id;

        // 커스텀 HTML 핀 생성 (위험 펄스 애니메이션 + SVG 엠블럼)
        const markerHtml = `
          <div class="hazard-marker-wrapper ${isDanger ? 'marker-danger' : 'marker-ok'} ${isSelected ? 'marker-selected' : ''}" style="
            position: relative;
            cursor: pointer;
            width: ${isSelected ? '44px' : '36px'};
            height: ${isSelected ? '44px' : '36px'};
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
          ">
            ${
              isDanger
                ? `<div class="pulse-ring" style="
                    position: absolute;
                    width: 100%;
                    height: 100%;
                    border-radius: 50%;
                    background: rgba(239, 68, 68, 0.45);
                    animation: hazard-pulse 1.8s infinite ease-out;
                  "></div>`
                : ''
            }
            <div style="
              width: 100%;
              height: 100%;
              border-radius: 50%;
              background: ${isDanger ? '#ef4444' : '#10b981'};
              border: ${isSelected ? '3px solid #ffffff' : '2px solid #ffffff'};
              box-shadow: 0 4px 10px rgba(0,0,0,0.35);
              display: flex;
              align-items: center;
              justify-content: center;
              color: #ffffff;
              font-weight: bold;
              font-size: ${isSelected ? '18px' : '15px'};
              transform: ${isSelected ? 'scale(1.15)' : 'scale(1)'};
            ">
              ${isDanger ? '⚠️' : '🛡️'}
            </div>
            ${
              isDanger && point.dangerCheckCount > 0
                ? `<div style="
                    position: absolute;
                    top: -4px;
                    right: -4px;
                    background: #991b1b;
                    color: white;
                    border: 1.5px solid white;
                    border-radius: 999px;
                    font-size: 10px;
                    font-weight: 800;
                    padding: 0 4px;
                    min-width: 16px;
                    height: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                  ">${point.dangerCheckCount}</div>`
                : ''
            }
          </div>
        `;

        const icon = L.divIcon({
          html: markerHtml,
          className: 'custom-hazard-div-icon',
          iconSize: [isSelected ? 44 : 36, isSelected ? 44 : 36],
          iconAnchor: [isSelected ? 22 : 18, isSelected ? 22 : 18],
        });

        const marker = L.marker([point.latitude, point.longitude], { icon });

        // 툴팁 설정
        const tooltipContent = `
          <div style="font-family: inherit; font-size: 12px; line-height: 1.35; padding: 2px;">
            <div style="font-weight: bold; color: ${isDanger ? '#dc2626' : '#059669'}; margin-bottom: 2px;">
              ${isDanger ? '🚨 위험 검출 구역' : '✅ 안전 점검 완료'}
            </div>
            <div style="font-weight: 600; color: #1e293b;">${point.projectNumber}</div>
            <div style="color: #64748b; font-size: 11px;">${point.locationText.split('(')[0].trim()}</div>
          </div>
        `;
        marker.bindTooltip(tooltipContent, {
          direction: 'top',
          offset: [0, -18],
          opacity: 0.95,
        });

        marker.on('click', () => {
          setSelectedPoint(point);
          mapInstanceRef.current.setView([point.latitude, point.longitude], Math.max(mapInstanceRef.current.getZoom(), 13), {
            animate: true,
          });
        });

        marker.addTo(markersLayer);
        bounds.extend([point.latitude, point.longitude]);
      });

      // 필터 변경 시 자동 바운드 맞춤 (마커가 있을 때만)
      if (filteredPoints.length > 0 && !selectedPoint) {
        mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
      }
    })();
  }, [filteredPoints, isMapReady, selectedPoint]);

  // 전체 화면 맞춤 버튼 동작
  const handleFitBounds = () => {
    if (!mapInstanceRef.current || filteredPoints.length === 0) return;
    (async () => {
      const L = (await import('leaflet')).default;
      const bounds = L.latLngBounds([]);
      filteredPoints.forEach((p) => bounds.extend([p.latitude, p.longitude]));
      mapInstanceRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
    })();
  };

  // 내 현재 위치로 이동
  const handleLocateMe = () => {
    if (!navigator.geolocation || !mapInstanceRef.current) {
      alert('현재 브라우저에서 위치 정보를 지원하지 않거나 권한이 없습니다.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserLocation([latitude, longitude]);
        mapInstanceRef.current.setView([latitude, longitude], 14, { animate: true });

        const L = (await import('leaflet')).default;
        const userIcon = L.divIcon({
          html: `<div style="width: 20px; height: 20px; border-radius: 50%; background: #2563eb; border: 3px solid white; box-shadow: 0 0 10px rgba(37,99,235,0.8);"></div>`,
          className: 'user-loc-icon',
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });
        L.marker([latitude, longitude], { icon: userIcon }).addTo(mapInstanceRef.current).bindTooltip('내 현재 위치').openTooltip();
      },
      (err) => {
        alert('현재 위치를 가져오지 못했습니다: ' + err.message);
      }
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        width: '100%',
        color: '#1a1a1a',
      }}
    >
      <style jsx global>{`
        @keyframes hazard-pulse {
          0% {
            transform: scale(0.9);
            opacity: 0.9;
          }
          70% {
            transform: scale(2.2);
            opacity: 0;
          }
          100% {
            transform: scale(2.3);
            opacity: 0;
          }
        }
        .custom-hazard-div-icon {
          background: transparent !important;
          border: none !important;
        }
        .leaflet-container {
          font-family: inherit;
        }
      `}</style>

      {/* 1. 상단 통계 지표 배너 (KPI & 위험 경보) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '10px',
        }}
      >
        {/* 총 점검 위치 */}
        <div
          style={{
            background: 'var(--card-bg, #ffffff)',
            border: '1px solid var(--border, #e2e8f0)',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              background: '#f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#334155',
            }}
          >
            <MapPin size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>총 점검 구역</div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
              {stats.total} <span style={{ fontSize: '12px', fontWeight: 'normal' }}>개소</span>
            </div>
          </div>
        </div>

        {/* 🚨 위험 검출 구역 */}
        <div
          onClick={() => setFilterMode('danger')}
          style={{
            background: filterMode === 'danger' ? '#fef2f2' : 'var(--card-bg, #ffffff)',
            border: filterMode === 'danger' ? '1.5px solid #ef4444' : '1px solid var(--border, #e2e8f0)',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          title="클릭하여 위험 구역만 보기"
        >
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              background: '#fee2e2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#dc2626',
            }}
          >
            <AlertTriangle size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: '#b91c1c', fontWeight: 'bold' }}>🚨 위험 요소 발견</div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: '#dc2626' }}>
              {stats.danger} <span style={{ fontSize: '12px', fontWeight: 'bold' }}>개소 ({stats.rate}%)</span>
            </div>
          </div>
        </div>

        {/* ✅ 안전 양호 구역 */}
        <div
          onClick={() => setFilterMode('ok')}
          style={{
            background: filterMode === 'ok' ? '#ecfdf5' : 'var(--card-bg, #ffffff)',
            border: filterMode === 'ok' ? '1.5px solid #10b981' : '1px solid var(--border, #e2e8f0)',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          title="클릭하여 양호 구역만 보기"
        >
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              background: '#d1fae5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#059669',
            }}
          >
            <ShieldCheck size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: '#047857', fontWeight: '500' }}>✅ 안전 점검 양호</div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: '#059669' }}>
              {stats.ok} <span style={{ fontSize: '12px', fontWeight: 'normal' }}>개소</span>
            </div>
          </div>
        </div>

        {/* 관할 사업단 */}
        <div
          style={{
            background: 'var(--card-bg, #ffffff)',
            border: '1px solid var(--border, #e2e8f0)',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              background: '#eff6ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#2563eb',
            }}
          >
            <Activity size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>관할 관리단</div>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>경기설계팀</div>
          </div>
        </div>
      </div>

      {/* 2. 지도 컨트롤 툴바 (검색, 필터, 위성 모드, 바운드 맞춤) */}
      <div
        style={{
          background: 'var(--card-bg, #ffffff)',
          border: '1px solid var(--border, #e2e8f0)',
          padding: '10px 14px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
        }}
      >
        {/* 좌측: 필터 탭 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => setFilterMode('all')}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: filterMode === 'all' ? '700' : '500',
              background: filterMode === 'all' ? '#1e293b' : '#f1f5f9',
              color: filterMode === 'all' ? '#ffffff' : '#475569',
              border: 'none',
              cursor: 'pointer',
              borderRadius: '4px',
            }}
          >
            전체 ({stats.total})
          </button>
          <button
            onClick={() => setFilterMode('danger')}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: filterMode === 'danger' ? '700' : '500',
              background: filterMode === 'danger' ? '#ef4444' : '#fee2e2',
              color: filterMode === 'danger' ? '#ffffff' : '#b91c1c',
              border: 'none',
              cursor: 'pointer',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span>🚨 위험 발견</span>
            <span style={{ fontWeight: '800' }}>({stats.danger})</span>
          </button>
          <button
            onClick={() => setFilterMode('ok')}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: filterMode === 'ok' ? '700' : '500',
              background: filterMode === 'ok' ? '#10b981' : '#d1fae5',
              color: filterMode === 'ok' ? '#ffffff' : '#047857',
              border: 'none',
              cursor: 'pointer',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span>✅ 양호</span>
            <span>({stats.ok})</span>
          </button>
        </div>

        {/* 중앙: 검색 입력창 */}
        <div style={{ position: 'relative', minWidth: '220px', flex: '1 1 200px', maxWidth: '340px' }}>
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#94a3b8',
            }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="공사번호, 점검자, 현장 위치 검색..."
            style={{
              width: '100%',
              padding: '6px 28px 6px 30px',
              fontSize: '12px',
              border: '1px solid #cbd5e1',
              borderRadius: '4px',
              outline: 'none',
              background: '#ffffff',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* 우측: 지도 모드 & 뷰 조작 버튼 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* 위성/일반 토글 */}
          <button
            onClick={() => setTileMode((prev) => (prev === 'streets' ? 'satellite' : 'streets'))}
            title={tileMode === 'streets' ? '위성 영상으로 보기' : '일반 지도로 보기'}
            style={{
              padding: '6px 10px',
              fontSize: '12px',
              fontWeight: '600',
              background: tileMode === 'satellite' ? '#0f172a' : '#f8fafc',
              color: tileMode === 'satellite' ? '#ffffff' : '#334155',
              border: '1px solid #cbd5e1',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Layers size={13} />
            <span>{tileMode === 'streets' ? '🛰️ 위성' : '🗺️ 일반'}</span>
          </button>

          {/* 전체 위치 화면 맞춤 */}
          <button
            onClick={handleFitBounds}
            title="모든 점검 위치를 화면에 맞춤"
            style={{
              padding: '6px 10px',
              fontSize: '12px',
              fontWeight: '500',
              background: '#f8fafc',
              color: '#334155',
              border: '1px solid #cbd5e1',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Maximize2 size={13} />
            <span>전체보기</span>
          </button>

          {/* 내 위치 */}
          <button
            onClick={handleLocateMe}
            title="내 현재 GPS 위치로 이동"
            style={{
              padding: '6px 10px',
              fontSize: '12px',
              fontWeight: '500',
              background: userLocation ? '#dbeafe' : '#f8fafc',
              color: userLocation ? '#2563eb' : '#334155',
              border: `1px solid ${userLocation ? '#93c5fd' : '#cbd5e1'}`,
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Navigation size={13} />
            <span>내 위치</span>
          </button>

          {/* 샘플 데이터 토글 */}
          <button
            onClick={() => setIncludeSamples((v) => !v)}
            title="관할 구역 시연용 점검 포인트 표시 토글"
            style={{
              padding: '6px 8px',
              fontSize: '11px',
              background: includeSamples ? '#eff6ff' : '#f1f5f9',
              color: includeSamples ? '#2563eb' : '#94a3b8',
              border: '1px solid #cbd5e1',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            {includeSamples ? '관할 구역 전체' : '내 등록건만'}
          </button>
        </div>
      </div>

      {/* 3. 지도 및 상세 패널 복합 뷰 */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '520px',
          background: '#e2e8f0',
          border: '1px solid var(--border, #cbd5e1)',
          overflow: 'hidden',
          display: 'flex',
        }}
      >
        {/* 지도 캔버스 컨테이너 */}
        <div
          ref={mapContainerRef}
          style={{
            flex: 1,
            height: '100%',
            width: '100%',
            zIndex: 1,
          }}
        />

        {/* 지도 좌상단 범례 오버레이 */}
        <div
          style={{
            position: 'absolute',
            top: '12px',
            left: '12px',
            zIndex: 10,
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(4px)',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            padding: '8px 12px',
            fontSize: '11px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            pointerEvents: 'auto',
          }}
        >
          <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#0f172a' }}>📍 현장 안전점검 현황</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }} />
              <span style={{ color: '#dc2626', fontWeight: 'bold' }}>위험 요소 검출 구역 ({stats.danger})</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }} />
              <span style={{ color: '#059669', fontWeight: 'bold' }}>전체 안전 양호 구역 ({stats.ok})</span>
            </div>
          </div>
        </div>

        {/* 선택된 점검 포인트 상세 슬라이드 패널 (하단/우측 반응형) */}
        {selectedPoint && (
          <div
            style={{
              position: 'absolute',
              right: '12px',
              top: '12px',
              bottom: '12px',
              width: '360px',
              maxWidth: 'calc(100% - 24px)',
              background: '#ffffff',
              borderRadius: '8px',
              border: `1.5px solid ${selectedPoint.status === 'danger' ? '#ef4444' : '#10b981'}`,
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.25)',
              zIndex: 20,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              animation: 'slideInRight 0.2s ease-out',
            }}
          >
            {/* 패널 헤더 */}
            <div
              style={{
                padding: '14px 16px',
                background: selectedPoint.status === 'danger' ? '#fef2f2' : '#f0fdf4',
                borderBottom: `1px solid ${selectedPoint.status === 'danger' ? '#fecaca' : '#bbf7d0'}`,
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: '800',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: selectedPoint.status === 'danger' ? '#ef4444' : '#10b981',
                      color: '#ffffff',
                    }}
                  >
                    {selectedPoint.status === 'danger' ? '⚠️ 위험요소 발견' : '✅ 적합 완료'}
                  </span>
                  {selectedPoint.isSample && (
                    <span style={{ fontSize: '10px', color: '#64748b', background: '#e2e8f0', padding: '1px 5px', borderRadius: '3px' }}>
                      관할 표본
                    </span>
                  )}
                  {selectedPoint.hasExactGps && (
                    <span style={{ fontSize: '10px', color: '#2563eb', background: '#dbeafe', padding: '1px 5px', borderRadius: '3px', fontWeight: 'bold' }}>
                      🛰️ GPS 정확
                    </span>
                  )}
                </div>
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                  {selectedPoint.projectNumber}
                </h4>
              </div>
              <button
                onClick={() => setSelectedPoint(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '4px',
                }}
                title="닫기"
              >
                <X size={18} />
              </button>
            </div>

            {/* 패널 본문 (스크롤) */}
            <div style={{ padding: '14px 16px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* 기본 메타 정보 */}
              <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '6px', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#334155' }}>
                  <Calendar size={13} style={{ color: '#64748b' }} />
                  <span>점검일시: <strong>{selectedPoint.inspectionDate}</strong></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#334155' }}>
                  <User size={13} style={{ color: '#64748b' }} />
                  <span>점검자: <strong>{selectedPoint.inspector}</strong></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: '#334155' }}>
                  <MapPin size={13} style={{ color: '#64748b', marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <div>{selectedPoint.locationText}</div>
                    <div style={{ fontSize: '10.5px', color: '#94a3b8', marginTop: '2px', fontFamily: 'monospace' }}>
                      GPS: {selectedPoint.latitude.toFixed(6)}, {selectedPoint.longitude.toFixed(6)}
                    </div>
                  </div>
                </div>
              </div>

              {/* 공정 및 작업 내용 */}
              <div style={{ fontSize: '12px' }}>
                <div style={{ fontWeight: 'bold', color: '#0f172a', marginBottom: '2px' }}>작업 공정</div>
                <div style={{ color: '#475569', background: '#f1f5f9', padding: '6px 10px', borderRadius: '4px' }}>
                  {selectedPoint.workType}
                </div>
                {selectedPoint.workDesc && selectedPoint.workDesc !== '미입력' && (
                  <div style={{ marginTop: '6px', color: '#64748b', fontSize: '11.5px', lineHeight: 1.4 }}>
                    {selectedPoint.workDesc}
                  </div>
                )}
              </div>

              {/* 🚨 위험 항목 목록 */}
              {selectedPoint.status === 'danger' && selectedPoint.dangerItems.length > 0 && (
                <div style={{ border: '1px solid #fecaca', background: '#fef2f2', padding: '10px 12px', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#dc2626', fontWeight: 'bold', fontSize: '12.5px', marginBottom: '8px' }}>
                    <AlertTriangle size={15} />
                    <span>발견된 위험 항목 ({selectedPoint.dangerItems.length}건)</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {selectedPoint.dangerItems.map((item, idx) => (
                      <div key={idx} style={{ background: '#ffffff', padding: '8px 10px', borderRadius: '4px', borderLeft: '3px solid #ef4444' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 'bold', fontSize: '12px', color: '#0f172a' }}>{item.name}</span>
                          <span style={{ fontSize: '10.5px', fontWeight: 'bold', color: '#dc2626', background: '#fee2e2', padding: '1px 6px', borderRadius: '3px' }}>불량</span>
                        </div>
                        {item.action && (
                          <div style={{ fontSize: '11px', color: '#b91c1c', marginTop: '4px' }}>
                            <strong>시정 조치:</strong> {item.action}
                          </div>
                        )}
                        {item.note && (
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                            {item.note}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 종합 특이사항 */}
              {selectedPoint.summaryNote && (
                <div style={{ fontSize: '11.5px', background: '#f8fafc', padding: '8px 10px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontWeight: 'bold', color: '#334155', marginBottom: '2px' }}>종합 특이사항</div>
                  <div style={{ color: '#475569', lineHeight: 1.4 }}>{selectedPoint.summaryNote}</div>
                </div>
              )}

              {/* 현장 증빙 사진 썸네일 */}
              {selectedPoint.photoUrls.length > 0 && (
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#0f172a', marginBottom: '6px' }}>
                    📸 현장 사진 ({selectedPoint.photoUrls.length}장)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                    {selectedPoint.photoUrls.map((url, pIdx) => (
                      <div
                        key={pIdx}
                        onClick={() => onPhotoClick && onPhotoClick(selectedPoint.photoUrls, pIdx)}
                        style={{
                          height: '70px',
                          borderRadius: '4px',
                          overflow: 'hidden',
                          border: '1px solid #cbd5e1',
                          background: '#f8fafc',
                          cursor: 'pointer',
                          position: 'relative',
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt="현장 사진"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        <div
                          style={{
                            position: 'absolute',
                            bottom: '2px',
                            right: '2px',
                            background: 'rgba(0,0,0,0.6)',
                            color: 'white',
                            borderRadius: '2px',
                            padding: '1px 3px',
                            fontSize: '9px',
                          }}
                        >
                          <Eye size={10} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 패널 푸터 액션 */}
            <div
              style={{
                padding: '10px 16px',
                background: '#f8fafc',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                gap: '8px',
              }}
            >
              {onSelectReport && selectedPoint.reportId && !selectedPoint.isSample && (
                <button
                  onClick={() => onSelectReport(selectedPoint.reportId)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    background: '#2563eb',
                    color: '#ffffff',
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
                  <span>보고서 전문 열기</span>
                </button>
              )}
              <a
                href={`https://map.kakao.com/link/map/${encodeURIComponent(selectedPoint.projectNumber)},${selectedPoint.latitude},${selectedPoint.longitude}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  padding: '8px 12px',
                  background: '#fee500',
                  color: '#191919',
                  borderRadius: '4px',
                  fontWeight: 'bold',
                  fontSize: '12px',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                title="카카오맵에서 위치 길찾기"
              >
                <ExternalLink size={13} />
                <span>지도 길찾기</span>
              </a>
            </div>
          </div>
        )}
      </div>

      {/* 4. 하단 빠른 위치 목록 테이블 (검색 또는 필터된 결과 요약 카드) */}
      <div
        style={{
          background: 'var(--card-bg, #ffffff)',
          border: '1px solid var(--border, #e2e8f0)',
          padding: '12px 14px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '10px',
          }}
        >
          <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f172a' }}>
            📍 지도 표시 점검 구역 목록 ({filteredPoints.length}건)
          </div>
          <span style={{ fontSize: '11px', color: '#64748b' }}>
            목록에서 항목을 클릭하면 지도가 해당 위치로 자동 포커스됩니다.
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: '8px',
            maxHeight: '190px',
            overflowY: 'auto',
          }}
        >
          {filteredPoints.map((pt) => {
            const isDanger = pt.status === 'danger';
            const isSelected = selectedPoint?.id === pt.id;

            return (
              <div
                key={pt.id}
                onClick={() => {
                  setSelectedPoint(pt);
                  if (mapInstanceRef.current) {
                    mapInstanceRef.current.setView([pt.latitude, pt.longitude], 14, { animate: true });
                  }
                }}
                style={{
                  border: isSelected
                    ? `1.5px solid ${isDanger ? '#ef4444' : '#10b981'}`
                    : '1px solid #e2e8f0',
                  background: isSelected
                    ? (isDanger ? '#fef2f2' : '#f0fdf4')
                    : '#ffffff',
                  padding: '8px 10px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  transition: 'border 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ fontSize: '12px' }}>{isDanger ? '🚨' : '✅'}</span>
                    <strong style={{ fontSize: '12px', color: '#1e293b' }}>{pt.projectNumber}</strong>
                  </div>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: '700',
                      padding: '1px 5px',
                      borderRadius: '3px',
                      background: isDanger ? '#fee2e2' : '#d1fae5',
                      color: isDanger ? '#dc2626' : '#059669',
                    }}
                  >
                    {isDanger ? `위험 (${pt.dangerCheckCount}건)` : '양호'}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {pt.locationText.split('(')[0]}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: '#94a3b8' }}>
                  <span>{pt.inspector}</span>
                  <span>{pt.inspectionDate}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
