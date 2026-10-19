import { parseCheckRows, parseSummary, analyzeReport, CheckRow, SafetyStatus } from './reportMarkdown';

export interface InspectionLocationPoint {
  id: string;
  reportId: string;
  projectNumber: string;
  inspectionDate: string;
  inspector: string;
  workType: string;
  workDesc: string;
  locationText: string;
  latitude: number;
  longitude: number;
  status: SafetyStatus;
  dangerItems: CheckRow[];
  totalCheckCount: number;
  dangerCheckCount: number;
  summaryNote: string;
  photoUrls: string[];
  rawReportText: string;
  createdAt: string;
  hasExactGps: boolean;
  isSample?: boolean;
}

// 경기도 및 서울 주요 거점 행정구역 좌표 사전 (KT 경기서부/남부 설계팀 관할 중심)
const KOREAN_DISTRICT_COORDS: Record<string, [number, number]> = {
  // 안산시
  '안산': [37.3219, 126.8309],
  '단원구': [37.3205, 126.8290],
  '상록구': [37.3005, 126.8466],
  '초지동': [37.3060, 126.8124],
  '원곡동': [37.3298, 126.7925],
  '성곡동': [37.2890, 126.7490],
  '고잔동': [37.3168, 126.8318],
  '선부동': [37.3411, 126.8115],
  '반월': [37.2910, 126.8670],

  // 성남시
  '성남': [37.4200, 127.1265],
  '분당': [37.3827, 127.1189],
  '분당구': [37.3827, 127.1189],
  '정자동': [37.3620, 127.1110],
  '불정로': [37.3596, 127.1054], // KT 분당 본사
  '판교': [37.3948, 127.1111],
  '야탑': [37.4116, 127.1287],
  '서현': [37.3848, 127.1235],
  '수정구': [37.4447, 127.1378],
  '중원구': [37.4320, 127.1610],

  // 수원시
  '수원': [37.2636, 127.0286],
  '팔달구': [37.2825, 127.0185],
  '인계동': [37.2635, 127.0325],
  '권선구': [37.2575, 126.9723],
  '영통구': [37.2596, 127.0465],
  '광교': [37.2885, 127.0515],
  '장안구': [37.3039, 127.0097],

  // 안양시
  '안양': [37.3943, 126.9568],
  '동안구': [37.3943, 126.9568],
  '관양동': [37.4056, 126.9654],
  '평촌': [37.3900, 126.9620],
  '범계': [37.3895, 126.9510],
  '만안구': [37.4003, 126.9165],
  '안양동': [37.4010, 126.9230],

  // 기타 경기 주요 지역
  '용인': [37.2410, 127.1775],
  '수지구': [37.3220, 127.0975],
  '기흥구': [37.2804, 127.1147],
  '부천': [37.5034, 126.7660],
  '원미구': [37.5034, 126.7660],
  '화성': [37.1995, 126.8315],
  '동탄': [37.2002, 127.0740],
  '남양': [37.2073, 126.8174],
  '시흥': [37.3802, 126.8028],
  '배곧': [37.3705, 126.7327],
  '군포': [37.3614, 126.9353],
  '의왕': [37.3448, 126.9682],
  '광명': [37.4786, 126.8647],
  '평택': [36.9921, 127.1129],
  '고양': [37.6584, 126.8320],
  '일산': [37.6584, 126.7700],
  '파주': [37.7600, 126.7800],
  '김포': [37.6152, 126.7156],
  '의정부': [37.7381, 127.0337],
  '구리': [37.5943, 127.1296],
  '남양주': [37.6360, 127.2165],
  '하남': [37.5393, 127.2148],

  // 서울 주요 지역
  '서울': [37.5665, 126.9780],
  '서초': [37.4837, 127.0324],
  '서초구': [37.4837, 127.0324],
  '강남': [37.5172, 127.0473],
  '강남구': [37.5172, 127.0473],
  '송파': [37.5145, 127.1065],
  '송파구': [37.5145, 127.1065],
  '영등포': [37.5264, 126.8962],
  '마포': [37.5663, 126.9016],
  '용산': [37.5326, 126.9900],
};

// 기본 기준점 (경기서부설계팀 관할 중심: 안산/안양/성남 권역 중심)
const DEFAULT_CENTER_LAT = 37.3596;
const DEFAULT_CENTER_LNG = 127.0150;

/** 문자열 해시를 기반으로 미세 분산 오프셋 생성 (동일 좌표 중첩 방지: ±100~300m) */
function getDeterministicOffset(key: string, index = 0): [number, number] {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0;
  }
  const angle = (Math.abs(hash + index * 1013) % 360) * (Math.PI / 180);
  const distance = 0.0015 + ((Math.abs(hash) % 25) / 10000); // 약 150m~400m
  return [Math.sin(angle) * distance, Math.cos(angle) * distance];
}

/** 텍스트에서 위도/경도 직접 추출 (예: 37.398022, 126.931778) */
export function extractCoordinates(text: string): { lat: number; lng: number } | null {
  if (!text) return null;

  // 1) 괄호 안팎의 위도, 경도 추출: (37.xxxx, 126/127.xxxx) or GPS: 37.xxx, 127.xxx
  const coordRegex = /(-?\d{2,3}\.\d{3,8})\s*,\s*(-?\d{2,3}\.\d{3,8})/;
  const match = text.match(coordRegex);
  if (match) {
    const p1 = parseFloat(match[1]);
    const p2 = parseFloat(match[2]);
    // 위도는 대략 33~39도 (한국), 경도는 124~132도
    if (p1 >= 33 && p1 <= 39 && p2 >= 124 && p2 <= 132) {
      return { lat: p1, lng: p2 };
    }
    if (p2 >= 33 && p2 <= 39 && p1 >= 124 && p1 <= 132) {
      return { lat: p2, lng: p1 };
    }
  }
  return null;
}

/** 주소 문자열로부터 좌표 매핑 (지역 사전 탐색) */
export function resolveAddressToCoords(address: string, fallbackKey = 'default', index = 0): { lat: number; lng: number; hasExact: boolean } {
  // 1. 직접 위경도가 포함된 경우
  const direct = extractCoordinates(address);
  if (direct) {
    return { lat: direct.lat, lng: direct.lng, hasExact: true };
  }

  // 2. 주소 단어 매칭
  const clean = address.replace(/[^\w\s가-힣]/g, ' ');
  const words = clean.split(/\s+/).filter(Boolean);

  // 긴 단어부터 우선 매칭 (예: "분당구", "정자동", "단원구")
  for (const word of words.reverse()) {
    for (const [key, coords] of Object.entries(KOREAN_DISTRICT_COORDS)) {
      if (word.includes(key) || key.includes(word)) {
        const [offLat, offLng] = getDeterministicOffset(fallbackKey + address, index);
        return { lat: coords[0] + offLat, lng: coords[1] + offLng, hasExact: false };
      }
    }
  }

  // 3. 경기설계팀 기본 거점 근처로 미세 오프셋 배치
  const [offLat, offLng] = getDeterministicOffset(fallbackKey + address, index);
  return { lat: DEFAULT_CENTER_LAT + offLat, lng: DEFAULT_CENTER_LNG + offLng, hasExact: false };
}

/** 마크다운 보고서 본문에서 기본 정보 테이블 필드 추출 */
export function extractReportMetadata(md: string) {
  const clean = md || '';

  const getField = (patterns: RegExp[], fallback = '미입력'): string => {
    for (const p of patterns) {
      const match = clean.match(p);
      if (match && match[1]) {
        const val = match[1].replace(/\*\*/g, '').trim();
        if (val && val !== '내용') return val;
      }
    }
    return fallback;
  };

  const projectNumber = getField([
    /\*\*공사번호\*\*\s*\|\s*([^|\n]+?)(?:\||\n)/,
    /공사번호\s*\|\s*([^|\n]+?)(?:\||\n)/,
    /공사번호[:：]\s*([^\n]+)/,
  ], '미입력');

  const inspectionDate = getField([
    /\*\*점검일자\*\*\s*\|\s*([^|\n]+?)(?:\||\n)/,
    /점검일자\s*\|\s*([^|\n]+?)(?:\||\n)/,
    /점검일자[:：]\s*([^\n]+)/,
  ], '알 수 없음');

  const workType = getField([
    /\*\*작업공정\*\*\s*\|\s*([^|\n]+?)(?:\||\n)/,
    /작업공정\s*\|\s*([^|\n]+?)(?:\||\n)/,
  ], '미입력');

  const inspector = getField([
    /\*\*점검자\*\*\s*\|\s*([^|\n]+?)(?:\||\n)/,
    /점검자\s*\|\s*([^|\n]+?)(?:\||\n)/,
  ], '점검자');

  const workDesc = getField([
    /\*\*작업내용\*\*\s*\|\s*([^|\n]+?)(?:\||\n)/,
    /작업내용\s*\|\s*([^|\n]+?)(?:\||\n)/,
  ], '미입력');

  const locationText = getField([
    /\*\*촬영위치\*\*\s*\|\s*([^|\n]+?)(?:\||\n)/,
    /촬영위치\s*\|\s*([^|\n]+?)(?:\||\n)/,
    /\*\*위치\*\*\s*\|\s*([^|\n]+?)(?:\||\n)/,
    /위치\s*\|\s*([^|\n]+?)(?:\||\n)/,
  ], '위치 정보 없음');

  return {
    projectNumber,
    inspectionDate,
    workType,
    inspector,
    workDesc,
    locationText,
  };
}

/** 단일 보고서 객체를 지도 핀용 InspectionLocationPoint 로 변환 */
export function convertReportToLocationPoint(report: any, index = 0): InspectionLocationPoint {
  const md = report.ai_report_text || '';
  const meta = extractReportMetadata(md);
  const checkRows = parseCheckRows(md);
  const dangerItems = checkRows.filter((r) => r.result === '불량');
  const status: SafetyStatus = dangerItems.length > 0 ? 'danger' : (checkRows.length > 0 && checkRows.every(r => r.result === '양호')) ? 'ok' : analyzeReport(md);
  const summaryNote = parseSummary(md);
  const photoUrls = report.image_url ? report.image_url.split(',').filter(Boolean) : [];

  const directGps = extractCoordinates(meta.locationText);
  const resolved = directGps
    ? { lat: directGps.lat, lng: directGps.lng, hasExact: true }
    : resolveAddressToCoords(meta.locationText, String(report.id || index), index);

  return {
    id: String(report.id || `loc-${index}`),
    reportId: String(report.id || ''),
    projectNumber: meta.projectNumber,
    inspectionDate: meta.inspectionDate,
    inspector: meta.inspector,
    workType: meta.workType,
    workDesc: meta.workDesc,
    locationText: meta.locationText,
    latitude: resolved.lat,
    longitude: resolved.lng,
    status,
    dangerItems,
    totalCheckCount: checkRows.length,
    dangerCheckCount: dangerItems.length,
    summaryNote,
    photoUrls,
    rawReportText: md,
    createdAt: report.created_at || new Date().toISOString(),
    hasExactGps: resolved.hasExact,
  };
}

/** 샘플 현장 보고서 데이터 (초기 등록 데이터가 적거나 시연할 때 풍부한 지도 시각화를 제공) */
export const SAMPLE_HAZARD_LOCATIONS: InspectionLocationPoint[] = [
  {
    id: 'sample-1',
    reportId: 'sample-1',
    projectNumber: '안산-설비-2026-0102',
    inspectionDate: '2026년 10월 14일',
    inspector: '김철수 팀장',
    workType: '초고속 통신선로 가공 케이블 정비',
    workDesc: '단원구 초지동 전주 승주 작업 및 분기함 결선 점검',
    locationText: '경기도 안산시 단원구 초지동 622-1 (37.306012, 126.812450)',
    latitude: 37.306012,
    longitude: 126.812450,
    status: 'danger',
    dangerItems: [
      { name: '보호구 착용 상태', result: '불량', action: '안전모 턱끈 미체결 현장 즉시 시정 조치', note: '고소작업 안전모 턱끈 조임 불량' },
      { name: '안전표지 설치', result: '불량', action: '작업 구간 전방 20m 라바콘 및 신호수 즉각 배치', note: '도로변 안전 통제 삼각대 미설치' },
    ],
    totalCheckCount: 5,
    dangerCheckCount: 2,
    summaryNote: '고소 작업 중 안전모 턱끈 미체결 및 하부 안전구획 미설정으로 즉각 작업 중지 후 안전수칙 재교육 실시.',
    photoUrls: ['https://picsum.photos/seed/safety-hazard-1/800/600', 'https://picsum.photos/seed/safety-hazard-2/800/600'],
    rawReportText: '',
    createdAt: '2026-10-14T09:30:00Z',
    hasExactGps: true,
    isSample: true,
  },
  {
    id: 'sample-2',
    reportId: 'sample-2',
    projectNumber: '성남-분당-2026-0088',
    inspectionDate: '2026년 10월 14일',
    inspector: '이영희 매니저',
    workType: '5G 이동통신 기지국 안테나 유지보수',
    workDesc: '분당구 정자동 옥상 기지국 피뢰침 및 접지선 저항 측정',
    locationText: '경기도 성남시 분당구 정자동 178-1 (37.362140, 127.111080)',
    latitude: 37.362140,
    longitude: 127.111080,
    status: 'ok',
    dangerItems: [],
    totalCheckCount: 5,
    dangerCheckCount: 0,
    summaryNote: '작업자 안전대 및 절연장갑 전원 정상 착용 완료. 작업 구획 차단막 양호.',
    photoUrls: ['https://picsum.photos/seed/safety-ok-1/800/600'],
    rawReportText: '',
    createdAt: '2026-10-14T11:20:00Z',
    hasExactGps: true,
    isSample: true,
  },
  {
    id: 'sample-3',
    reportId: 'sample-3',
    projectNumber: '수원-팔달-2026-0115',
    inspectionDate: '2026년 10월 13일',
    inspector: '박민수 과장',
    workType: '지하 통신구 광케이블 포설 점검',
    workDesc: '인계동 맨홀 진입 전 유해가스 농도 측정 및 환기 작업',
    locationText: '경기도 수원시 팔달구 인계동 1120 (37.263520, 127.032510)',
    latitude: 37.263520,
    longitude: 127.032510,
    status: 'danger',
    dangerItems: [
      { name: '사다리 및 장비 상태', result: '불량', action: '미끄럼 방지 고무 파손 사다리 교체', note: '맨홀 승하강용 사다리 전도 방지 조치 미흡' },
    ],
    totalCheckCount: 5,
    dangerCheckCount: 1,
    summaryNote: '맨홀 내 산소농도(20.9%)는 양호하나 진입 사다리 지지 불량 적발, 시정 조치 완료.',
    photoUrls: ['https://picsum.photos/seed/safety-hazard-3/800/600'],
    rawReportText: '',
    createdAt: '2026-10-13T14:15:00Z',
    hasExactGps: true,
    isSample: true,
  },
  {
    id: 'sample-4',
    reportId: 'sample-4',
    projectNumber: '안양-동안-2026-0094',
    inspectionDate: '2026년 10월 12일',
    inspector: '정동진 주임',
    workType: '전주 신설 및 통신 인입선 가설',
    workDesc: '관양동 벤처밸리 앞 인입선로 지중화 배관 연결',
    locationText: '경기도 안양시 동안구 관양동 1591 (37.405620, 126.965410)',
    latitude: 37.405620,
    longitude: 126.965410,
    status: 'ok',
    dangerItems: [],
    totalCheckCount: 5,
    dangerCheckCount: 0,
    summaryNote: '보행자 안전 통로 확보 및 신호수 배치 상태 우수.',
    photoUrls: ['https://picsum.photos/seed/safety-ok-2/800/600'],
    rawReportText: '',
    createdAt: '2026-10-12T16:00:00Z',
    hasExactGps: true,
    isSample: true,
  },
  {
    id: 'sample-5',
    reportId: 'sample-5',
    projectNumber: '화성-동탄-2026-0131',
    inspectionDate: '2026년 10월 11일',
    inspector: '강태석 대리',
    workType: '동탄 신도시 아파트 구내 통신실 개통 검사',
    workDesc: 'MDF 실 배선반 정리 및 누전 차단기 점검',
    locationText: '경기도 화성시 동탄대로 500 (37.200210, 127.074020)',
    latitude: 37.200210,
    longitude: 127.074020,
    status: 'danger',
    dangerItems: [
      { name: '정리정돈 상태', result: '불량', action: '통신실 바닥 잔여 전선 피복 수거 및 통로 확보', note: '통신실 보행 통로에 공구 및 자재 방치' },
    ],
    totalCheckCount: 5,
    dangerCheckCount: 1,
    summaryNote: 'MDF실 내 화재 위험 요소(잔여 전선 뭉치 및 인화성 쓰레기) 청소 및 폐기 조치 지시.',
    photoUrls: ['https://picsum.photos/seed/safety-hazard-4/800/600'],
    rawReportText: '',
    createdAt: '2026-10-11T10:40:00Z',
    hasExactGps: true,
    isSample: true,
  },
  {
    id: 'sample-6',
    reportId: 'sample-6',
    projectNumber: '안산-단원-2026-0144',
    inspectionDate: '2026년 10월 10일',
    inspector: '최성훈 반장',
    workType: '공단 내부 광선로 접속함 유지보수',
    workDesc: '원곡동 반월공단 진입로 광접속함 밀폐 및 방수 검사',
    locationText: '경기도 안산시 단원구 원곡동 789 (37.329820, 126.792510)',
    latitude: 37.329820,
    longitude: 126.792510,
    status: 'danger',
    dangerItems: [
      { name: '적정 공법 적용 상태', result: '불량', action: '접속함 고정 밴드 규격품으로 재시공', note: '비규격 철사 임의 고정 적발' },
    ],
    totalCheckCount: 5,
    dangerCheckCount: 1,
    summaryNote: '비규격 자재 사용 금지 및 재시공 명령 발령.',
    photoUrls: ['https://picsum.photos/seed/safety-hazard-5/800/600'],
    rawReportText: '',
    createdAt: '2026-10-10T15:10:00Z',
    hasExactGps: true,
    isSample: true,
  },
];
