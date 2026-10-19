/**
 * 한국 통신/전기/안전 점검 및 자재실사 전문 용어 사전 및 오타 교정 유틸리티
 * (Technical Telecom/Electric/Safety Glossary & Typo Correction Engine)
 */

export interface TechnicalTerm {
  term: string;
  english?: string;
  category: 'telecom' | 'electric' | 'safety' | 'material';
  categoryLabel: string;
  description: string;
  commonMistakes: string[];
  suggestedActions: string[];
  suggestedNotes: string[];
  chosung?: string;
}

export interface TypoSuggestion {
  wrongWord: string;
  suggestedTerm: string;
  categoryLabel: string;
  explanation: string;
  fullMatchTerm: TechnicalTerm;
}

export interface AutocompleteResult {
  term: string;
  english?: string;
  category: 'telecom' | 'electric' | 'safety' | 'material';
  categoryLabel: string;
  description: string;
  matchType: 'exact' | 'prefix' | 'chosung' | 'fuzzy';
  suggestedPhrases: string[];
}

// 한글 초성 유니코드 목록
const CHOSUNG = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
];

const JUNGSUNG = [
  'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ',
  'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ',
];

const JONGSUNG = [
  '', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ',
  'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
];

/**
 * 한글 문자열에서 초성만 추출 (예: "광분배함" -> "ㄱㅂㅎ", "5G 안테나" -> "5G ㅇㅌㄴ")
 */
export function extractChosung(str: string): string {
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    // 한글 음절 범위 (가 ~ 힣: 0xAC00 ~ 0xD7A3)
    if (code >= 0xac00 && code <= 0xd7a3) {
      const chosungIndex = Math.floor((code - 0xac00) / (21 * 28));
      result += CHOSUNG[chosungIndex];
    } else {
      result += str.charAt(i);
    }
  }
  return result;
}

/**
 * 한글 음절을 자모(초성/중성/종성)로 완전 분해 (거리 계산용)
 */
export function decomposeHangul(str: string): string {
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code >= 0xac00 && code <= 0xd7a3) {
      const offset = code - 0xac00;
      const cho = Math.floor(offset / (21 * 28));
      const jung = Math.floor((offset % (21 * 28)) / 28);
      const jong = offset % 28;
      result += CHOSUNG[cho] + JUNGSUNG[jung] + JONGSUNG[jong];
    } else {
      result += str.charAt(i).toLowerCase();
    }
  }
  return result;
}

/**
 * 두 문자열 사이의 레벤슈타인 편집 거리 계산
 */
export function getLevenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const d: number[][] = [];
  for (let i = 0; i <= m; i++) d[i] = [i];
  for (let j = 0; j <= n; j++) d[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1, // 삭제
        d[i][j - 1] + 1, // 삽입
        d[i - 1][j - 1] + cost // 대체
      );
    }
  }
  return d[m][n];
}

/**
 * 전문 용어 공식 데이터베이스
 */
export const RAW_TECHNICAL_TERMS: Omit<TechnicalTerm, 'chosung'>[] = [
  // --- [통신 / 광통신 분야] ---
  {
    term: '광분배함',
    english: 'OFD / FDF',
    category: 'telecom',
    categoryLabel: '통신/광선로',
    description: '광케이블 심선을 인입하여 점퍼코드와 접속/분배하는 메인 광분배함체',
    commonMistakes: [
      '광분베함', '광분해함', '광분배한', '광분베한', '광분배', '광분배기',
      '광분폐함', '공분배함', '관분배함', '광분패함', 'OFD함',
    ],
    suggestedActions: [
      '광분배함 내부 광점퍼코드 곡률반경 유지 및 라벨링 재정비',
      '광분배함 미사용 포트 먼지 보호캡(Dust Cap) 체결 조치',
      '광분배함 인입 광케이블 텐션 및 외피 피복 상태 점검 완료',
      '광분배함 랙 마운트 볼트 규정 토크로 견고히 고정 체결',
    ],
    suggestedNotes: [
      '광분배함 48Core 전 포트 청결 상태 양호 및 손상 없음',
      '광분배함 접속 규격 SC/APC 타입 일치 확인',
      '광분배함 내부 수분 침투 방지 실링 상태 정상',
    ],
  },
  {
    term: '5G 안테나',
    english: '5G Antenna',
    category: 'telecom',
    categoryLabel: '통신/무선설비',
    description: '5G 이동통신 고주파 대역 빔포밍 및 무선 송수신을 담당하는 기지국 안테나',
    commonMistakes: [
      '5G 안태나', '5G안태나', '5지 안테나', '5지안태나', '오지안테나',
      '5G 안테냐', '안태나', '5G 안태나설치', '5G 안태나브래킷',
    ],
    suggestedActions: [
      '5G 안테나 브래킷 고정 볼트 토크 렌치로 재조임(규정값 준수)',
      '5G 안테나 지지대 틸팅 각도(Down-tilt) 및 방위각 설계도면과 재정렬',
      '5G 안테나 RF 커넥터 방수 테이핑 및 수축튜브 열풍 시공 완료',
      '5G 안테나 지지 파이프 수직도 교정 및 체결 상태 보강',
    ],
    suggestedNotes: [
      '5G 안테나 3.5GHz 대역 다중입출력(Massive MIMO) 규격 일치',
      '5G 안테나 외관 크랙 및 래돔(Radome) 파손 없음',
      '풍속 60m/s 내풍 설계 규격 충족 확인',
    ],
  },
  {
    term: '5G AAU',
    english: 'Active Antenna Unit',
    category: 'telecom',
    categoryLabel: '통신/무선설비',
    description: '안테나와 무선 신호 처리부(RU)가 일체화된 능동형 5G 기지국 장비',
    commonMistakes: ['5G AAU장비', '5G AUU', '5G AAUU', '에이에이유', '5G AA유'],
    suggestedActions: [
      '5G AAU 광케이블(CPRI/eCPRI) 접속 링크 상태 및 손실값 측정 확인',
      '5G AAU 접지선(#6 AWG 이상) 압착 단자 결속 및 접지저항 측정 완료',
      '5G AAU 방열판 이물질 제거 및 팬 모듈 냉각 상태 점검',
    ],
    suggestedNotes: [
      '5G AAU 32T32R 규격 일치 및 통신 링크 정상 동작',
      '정격 DC -48V 전원 인입 전압 정상 범위 확인',
    ],
  },
  {
    term: '광케이블 접속함체',
    english: 'OFJC (Fiber Joint Closure)',
    category: 'telecom',
    categoryLabel: '통신/광선로',
    description: '옥외 통신주 또는 맨홀 내에서 광섬유 접속 부위를 방수 보호하는 밀폐 함체',
    commonMistakes: [
      '광접속함체', '접속함채', '광접속함채', '옵티컬접속함', '접속함체',
      '광케이블접속함채', 'OFJC함체', '광접속통',
    ],
    suggestedActions: [
      '광케이블 접속함체 방수 가스켓 및 실링 젤 테이핑 재시공',
      '접속함체 트레이 내부 슬리브(Heat Shrink Sleeve) 수용 상태 정돈',
      '접속함체 통신주 밴드 체결 강도 보강 및 추락 방지 와이어 체결',
    ],
    suggestedNotes: [
      'IP68 완전 방수 등급 및 기밀 시험(Air Valve) 0.5kg/cm² 이상 합격',
      '광접속 손실 기준치 0.05dB/코어 이하 전수 통과',
    ],
  },
  {
    term: '광점퍼코드',
    english: 'Optical Patch Cord',
    category: 'telecom',
    categoryLabel: '통신/광선로',
    description: '광분배함과 광전송장치 또는 RU 사이를 연결하는 단거리 광코드',
    commonMistakes: [
      '점퍼코드', '광점퍼선', '점퍼선', '광점퍼코트', '광점퍼코어', '광잠퍼코드',
    ],
    suggestedActions: [
      '광점퍼코드 꺾임(Bend) 구간 완화 및 광케이블 타이 과조임 해제',
      '광점퍼코드 커넥터 단면 알코올 세척 및 페룰 흠집 여부 검사',
      '양단 포트 번호 대조 후 식별 라벨(Tag) 재부착 완료',
    ],
    suggestedNotes: [
      'LC/UPC to SC/APC 싱글모드(SM 9/125㎛) 3m 규격 일치',
      '삽입 손실(IL) 0.2dB 이하, 반사 손실(RL) 50dB 이상 확인',
    ],
  },
  {
    term: '패치패널',
    english: 'Patch Panel',
    category: 'telecom',
    categoryLabel: '통신/네트워크',
    description: 'UTP 케이블 또는 광선을 집선하여 모듈러 잭으로 정리하는 패널',
    commonMistakes: ['파치패널', '패치판넬', '파치판넬', '패치팬널', '배치패널'],
    suggestedActions: [
      '패치패널 UTP 케이블 결선 순서(T568B 규격) 재확인 및 압착',
      '패치패널 후면 케이블 매니저로 선 정리 및 케이블 하중 분산',
    ],
    suggestedNotes: [
      'Cat.6 24포트 비차폐(UTP) 규격 일치 확인',
    ],
  },
  {
    term: '광파워미터',
    english: 'Optical Power Meter',
    category: 'telecom',
    categoryLabel: '통신/계측장비',
    description: '광신호의 출력 레벨(dBm)을 정밀 측정하는 전문 광학 계측기',
    commonMistakes: ['광파워메타', '광파워메터', '파워미터', '광파워메타기'],
    suggestedActions: [
      '광파워미터 파장대(1310/1550nm) 보정 및 기준 광출력 레벨 재측정',
      '수신 감도 기준치(-15dBm ~ -22dBm) 미달 구간 광 접속부 재세척',
    ],
    suggestedNotes: [
      '계측기 검교정 유효 기간(1년 이내) 및 교정 성적서 확인 완료',
    ],
  },
  {
    term: 'OTDR',
    english: 'Optical Time Domain Reflectometer',
    category: 'telecom',
    categoryLabel: '통신/계측장비',
    description: '광섬유 선로의 거리별 손실, 단선 지점 및 반사 이벤트를 측정하는 시간영역반사측정기',
    commonMistakes: ['오티디알', 'OTDL', '광OTDR'],
    suggestedActions: [
      'OTDR 측정 파형 분석을 통해 굴곡 손실(Macro-bend) 발생 위치 특정 및 조치',
      '전체 선로 구간 누적 손실 그래프 저장 및 준공 보고서 첨부',
    ],
    suggestedNotes: [
      '거리 1.8km 구간 단선 이벤트 없음 및 전 구간 균일 감쇠율(0.35dB/km) 확인',
    ],
  },

  // --- [전기 / 전원 / 접지 분야] ---
  {
    term: '접지선',
    english: 'Grounding Wire',
    category: 'electric',
    categoryLabel: '전기/접지설비',
    description: '낙뢰, 누전 및 서지로부터 통신 장비와 작업자를 보호하는 접지 도선',
    commonMistakes: [
      '접지센', '접지단자', '접지도선', '어스선', '어쓰선', '접지케이블',
    ],
    suggestedActions: [
      '접지선 압착 단자 결속 볼트 토크 재조임 및 산화 피막 제거',
      '접지선 굵기(F-GV 16sq 이상) 적합 여부 확인 및 보호관 씌움 조치',
      '접지 단자함 내 접지저항계로 1종 접지저항(10Ω 이하) 측정 기록',
    ],
    suggestedNotes: [
      '공용 접지극 연결 상태 양호 및 본딩 도체 부식 없음',
      '녹색/황색 절연 피복 손상 없음 확인',
    ],
  },
  {
    term: '서지보호기(SPD)',
    english: 'Surge Protective Device',
    category: 'electric',
    categoryLabel: '전기/전원설비',
    description: '낙뢰나 전력선 스위칭으로 유입되는 과도 과전압을 대지로 바이패스시키는 보호기',
    commonMistakes: [
      '서지보호기', '써지보호기', '서지프로텍터', '써지보호제', 'SPD장치',
    ],
    suggestedActions: [
      '서지보호기(SPD) 인디케이터 적색(소손) 점등 확인 시 즉시 신품 교체',
      '서지보호기 리드선 길이를 50cm 이하로 최단거리 직선 배선 조치',
      'SPD 전단 전용 차단기(MCCB) 트립 여부 점검 및 복구',
    ],
    suggestedNotes: [
      '정격 방전 전류(In) 20kA, 최대 방전 전류(Imax) 40kA 사양 일치',
      '동작 표시기 녹색(정상) 확인',
    ],
  },
  {
    term: '배전반',
    english: 'Switchboard',
    category: 'electric',
    categoryLabel: '전기/전원설비',
    description: '외부 인입 고압/저압 전력을 주 차단기 및 계측기로 수용하여 분배하는 함체',
    commonMistakes: ['배전판', '배전한', '수배전반', '배전반함'],
    suggestedActions: [
      '배전반 내 볼트 체결 부위 열화상 카메라 점검 및 과열 단자 재조임',
      '배전반 도어 접지 본딩선 연결 및 먼지/이물질 진공 흡입 청소',
      '배전반 전면 위험 경고 표지 및 단선결선도(Single Line Diagram) 부착',
    ],
    suggestedNotes: [
      '도어 시건장치 정상 작동 및 잠금 관리 확인',
      '충전부 아크릴 절연 방호 커버 체결 상태 양호',
    ],
  },
  {
    term: '분전반',
    english: 'Distribution Board',
    category: 'electric',
    categoryLabel: '전기/전원설비',
    description: '배전반에서 전력을 받아 각 층이나 구역별 말단 부하로 분기 공급하는 반',
    commonMistakes: ['분전판', '분전한', '분전함', '분전판넬'],
    suggestedActions: [
      '분전반 누전차단기(ELB) 테스트 버튼을 눌러 정격 트립 동작 확인',
      '각 분기 회로별 부하 명판(라벨) 현행화 및 재부착',
      '전선 인입구 부싱(Bushing) 체결로 케이블 피복 마모 방지 조치',
    ],
    suggestedNotes: [
      '정격 감도전류 30mA, 동작시간 0.03초 이내 규격 확인',
    ],
  },
  {
    term: '정류기',
    english: 'Rectifier',
    category: 'electric',
    categoryLabel: '전기/통신전원',
    description: '상용 AC 전원을 DC -48V 통신용 전원으로 변환 공급하고 축전지를 충전하는 장치',
    commonMistakes: ['정유기', '정류기모듈', '정류반'],
    suggestedActions: [
      '정류기 모듈 부하 분담 균등도(Load Sharing) 점검 및 전압(DC -53.5V) 보정',
      '정류기 냉각 팬 필터 세척 및 알람 접점(경보 라인) 동작 시험 완료',
    ],
    suggestedNotes: [
      '모듈 N+1 병렬 운전 상태 정상 및 부동 충전(Float Charge) 전압 정상',
    ],
  },
  {
    term: '축전지',
    english: 'Battery Bank',
    category: 'electric',
    categoryLabel: '전기/통신전원',
    description: '정전 시 통신 장비에 비상 전원을 공급하는 예비 전원 배터리 뱅크',
    commonMistakes: ['축전자', '축전지함', '배터리뱅크', '축전지뱅크'],
    suggestedActions: [
      '축전지 단자대 토크 렌치 점검 및 방청제(바셀린) 도포 조치',
      '축전지 내부 저항 및 셀별 단자 전압(2.25V/Cell) 측정 기록 완료',
      '축전지 랙 내진 고정 앵커 볼트 체결 상태 보강',
    ],
    suggestedNotes: [
      '무누액 밀폐형 연축전지(VRLA) 2V 400Ah 규격 24Cell 직렬 정상',
      '외관 부풀림(Swelling) 및 전해액 누액 흔적 없음',
    ],
  },
  {
    term: '케이블 트레이',
    english: 'Cable Tray',
    category: 'electric',
    categoryLabel: '전기/선로설비',
    description: '통신선로 및 전력선을 지지하고 경로를 따라 안전하게 포설하는 구조체',
    commonMistakes: [
      '케이블트래이', '케이블트레이', '케이블트레인', '트레이선로', '전선트레이',
    ],
    suggestedActions: [
      '케이블 트레이 내 전력선과 통신선 사이 금속 격벽 설치 및 이격(30cm 이상)',
      '트레이 본딩 접지 점퍼선 미결속 개소 추가 압착 결속 조치',
      '트레이 지지 행거(Hanger) 간격(1.5m 이내) 보강 및 진동 방지 너트 체결',
    ],
    suggestedNotes: [
      '아연도금 강판 펀칭 타입 300W 규격 일치',
      '케이블 적재율 50% 이하 유지로 방열 성능 확보',
    ],
  },

  // --- [안전 점검 / 개인보호구 / 현장설비] ---
  {
    term: '보호구(안전모/안전대)',
    english: 'Personal Protective Equipment',
    category: 'safety',
    categoryLabel: '안전/개인보호구',
    description: '고소작업 및 전기작업 시 추락 및 충격 재해를 예방하는 법정 필수 개인 보호구',
    commonMistakes: [
      '안전모 턱근', '안전모턱근', '안전모턱끈', '안전벨트', '안전밸트',
      '추락방지밸트', '보호장구',
    ],
    suggestedActions: [
      '작업자 전원 안전모 턱끈 2점식/4점식 밀착 조임 상태 현장 즉시 지도',
      '고소작업자 안전대 이중 죔줄(Double Lanyard) 수직 구명줄 체결 확인',
      '충격 흡수 장비(Shock Absorber) 훼손 및 제조일자 3년 초과품 신품 교체',
    ],
    suggestedNotes: [
      'KCS 한국산업안전보건공단 안전인증 마크 부착 및 이상 없음',
      '작업 전 TBM(안전점검회의) 시 착용 실태 전원 점검 완료',
    ],
  },
  {
    term: '고소작업대',
    english: 'Aerial Work Platform',
    category: 'safety',
    categoryLabel: '안전/가설장비',
    description: '높은 장소에서 통신 안테나 및 케이블 작업을 수행하기 위한 차량 탑재형 또는 시저스형 작업대',
    commonMistakes: [
      '고소작업차', '고소작업차량', '스카이차', '시저스리프트', '고소차',
    ],
    suggestedActions: [
      '고소작업대 아웃트리거(Outrigger) 최대 전개 및 지반 침하 방지 깔판 설치',
      '작업대 탑승자 안전대 걸이대 체결 및 과상승 방지봉 정상 작동 시험',
      '작업 반경 하부 접근 통제 구역 설정 및 신호수(유도자) 전담 배치',
    ],
    suggestedNotes: [
      '차량 안전검사 유효기간 확인 및 붐대 유압 라인 누유 없음',
      '풍속 10m/s 이상 고소 작업 즉시 중지 수칙 공지 완료',
    ],
  },
  {
    term: '개구부 덮개',
    english: 'Opening Cover',
    category: 'safety',
    categoryLabel: '안전/가설시설',
    description: '바닥 맨홀, 피트, 슬래브 개구부 등의 추락 위험을 원천 차단하는 견고한 방호 덮개',
    commonMistakes: [
      '개구부덮게', '개구부덮게설치', '개구부뚜껑', '맨홀덮개', '바닥개구부',
    ],
    suggestedActions: [
      '개구부 덮개 임의 이동 방지 볼트 고정 및 고정 앵글 추가 보강',
      '덮개 상부 황색 형광 안전도료 도색 및 "추락위험! 개구부" 경고 표지 부착',
      '덮개 처짐 없는 내하중 400kg/m² 이상 강재 덮개로 교체 완료',
    ],
    suggestedNotes: [
      '상시 덮개 닫힘 상태 유지 및 발걸림 턱 2cm 이하 시공 확인',
    ],
  },
  {
    term: '절연장갑 / 검전기',
    english: 'Insulated Gloves & Detector',
    category: 'safety',
    categoryLabel: '안전/전기안전',
    description: '활선 근접 및 전기 점검 시 감전 사고를 방지하는 절연 보호구 및 전압 검출기',
    commonMistakes: [
      '절현장갑', '절연고무장갑', '검전봉', '비접촉검전기', '검전기측정',
    ],
    suggestedActions: [
      '작업 전 검전기로 특고압/저압 활선 여부 3상(R, S, T) 전선 무전압 확인',
      '절연장갑 공기 주입 팽창 시험(Air Leak Test)으로 핀홀 누설 여부 점검',
      '내전압 절연 안전모 및 안전화 동시 착용 후 배전반 접근 조치',
    ],
    suggestedNotes: [
      '한국가스/전기안전공사 정기 절연 내력 시험 합격품(6개월 이내) 확인',
    ],
  },
  {
    term: '방수 실링',
    english: 'Waterproof Sealing',
    category: 'material',
    categoryLabel: '자재/부자재',
    description: '옥외 장비 및 케이블 인입부의 빗물/습기 침투를 방지하는 방수 테이프 및 실리콘 젤',
    commonMistakes: [
      '방수씰링', '방수실링', '방수실란트', '방수테이핑', '실링젤', '수밀처리',
    ],
    suggestedActions: [
      '케이블 인입구 3중 방수(부틸 고무 테이프 + 비닐 테이프 + UV 케이블타이) 재시공',
      '옥외 안테나 커넥터 접속부 방수 캡 및 실리콘 실란트 코킹 보강',
    ],
    suggestedNotes: [
      '외부 기온 -20℃ ~ +70℃ 내한/내열 방수 성능 규격 확인',
    ],
  },
];

// 초성 인덱스 캐싱된 전체 목록
export const TECHNICAL_TERMS: TechnicalTerm[] = RAW_TECHNICAL_TERMS.map((item) => ({
  ...item,
  chosung: extractChosung(item.term),
}));

/**
 * 텍스트 내에서 전문 용어 오타를 감지하여 교정 제안 반환
 */
export function detectTypoSuggestions(inputText: string): TypoSuggestion[] {
  if (!inputText || inputText.trim().length === 0) return [];

  const suggestions: TypoSuggestion[] = [];
  const text = inputText.toLowerCase();

  // 1. 등록된 오타 사전과 대조
  for (const item of TECHNICAL_TERMS) {
    for (const mistake of item.commonMistakes) {
      const mistLower = mistake.toLowerCase();
      if (text.includes(mistLower)) {
        // 이미 올바른 용어가 그대로 쓰인 경우는 제외 (단, mistake가 term의 부분문자열이 아닐 때)
        if (mistLower !== item.term.toLowerCase()) {
          suggestions.push({
            wrongWord: mistake,
            suggestedTerm: item.term,
            categoryLabel: item.categoryLabel,
            explanation: `'${mistake}'은(는) 현장 표준 전문 용어인 '${item.term}'(${item.english || item.categoryLabel})의 오타로 감지되었습니다.`,
            fullMatchTerm: item,
          });
        }
      }
    }
  }

  // 2. 단어 단위(공백 구분)로 2글자 이상 단어에 대해 자모 분해 편집 거리 계산 (Fuzzy typo detection)
  const tokens = inputText.split(/[\s,;:.|()[\]{}]+/);
  for (const token of tokens) {
    const cleanToken = token.trim();
    if (cleanToken.length < 2) continue;

    // 이미 정확한 용어면 건너뜀
    const isExact = TECHNICAL_TERMS.some((t) => t.term === cleanToken || t.term.includes(cleanToken));
    if (isExact) continue;

    const tokenDecomp = decomposeHangul(cleanToken);

    for (const item of TECHNICAL_TERMS) {
      const termDecomp = decomposeHangul(item.term);

      // 자모 레벤슈타인 거리 계산
      const dist = getLevenshteinDistance(tokenDecomp, termDecomp);
      // 길이가 3음절 이상일 때 자모 거리 1~2는 오타일 가능성이 매우 높음 (예: "안태나" vs "안테나" -> distance 1)
      const maxAllowedDist = cleanToken.length >= 4 ? 2 : 1;

      if (dist <= maxAllowedDist && dist > 0) {
        // 중복 방지
        const alreadyAdded = suggestions.some(
          (s) => s.wrongWord === cleanToken && s.suggestedTerm === item.term
        );
        if (!alreadyAdded) {
          suggestions.push({
            wrongWord: cleanToken,
            suggestedTerm: item.term,
            categoryLabel: item.categoryLabel,
            explanation: `'${cleanToken}'이(가) 표준 용어 '${item.term}'과(와) 철자가 유사합니다. 교정하시겠습니까?`,
            fullMatchTerm: item,
          });
        }
      }
    }
  }

  return suggestions;
}

/**
 * 쿼리 문자열에 따른 전문 용어 및 추천 조치사항/비고 자동완성 목록 반환
 */
export function getTermSuggestions(
  query: string,
  targetType: 'action' | 'note' | 'general' = 'general'
): AutocompleteResult[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    // 쿼리가 비어있을 때는 대표 전문 용어 상위 8개 표시
    return TECHNICAL_TERMS.slice(0, 8).map((item) => ({
      term: item.term,
      english: item.english,
      category: item.category,
      categoryLabel: item.categoryLabel,
      description: item.description,
      matchType: 'exact',
      suggestedPhrases:
        targetType === 'action'
          ? item.suggestedActions
          : targetType === 'note'
          ? item.suggestedNotes
          : [...item.suggestedActions.slice(0, 2), ...item.suggestedNotes.slice(0, 2)],
    }));
  }

  const queryChosung = extractChosung(trimmed);
  const results: AutocompleteResult[] = [];

  for (const item of TECHNICAL_TERMS) {
    const termLower = item.term.toLowerCase();
    const engLower = (item.english || '').toLowerCase();
    const itemChosung = item.chosung || extractChosung(item.term);

    let matchType: 'exact' | 'prefix' | 'chosung' | 'fuzzy' | null = null;

    if (termLower === trimmed || engLower === trimmed) {
      matchType = 'exact';
    } else if (termLower.startsWith(trimmed) || engLower.startsWith(trimmed)) {
      matchType = 'prefix';
    } else if (termLower.includes(trimmed) || engLower.includes(trimmed)) {
      matchType = 'prefix';
    } else if (itemChosung.includes(queryChosung) || itemChosung.startsWith(queryChosung)) {
      matchType = 'chosung';
    } else {
      // 자모 분해 후 유사도 검사
      const dist = getLevenshteinDistance(decomposeHangul(trimmed), decomposeHangul(item.term));
      if (dist <= 2) {
        matchType = 'fuzzy';
      }
    }

    if (matchType) {
      results.push({
        term: item.term,
        english: item.english,
        category: item.category,
        categoryLabel: item.categoryLabel,
        description: item.description,
        matchType,
        suggestedPhrases:
          targetType === 'action'
            ? item.suggestedActions
            : targetType === 'note'
            ? item.suggestedNotes
            : [...item.suggestedActions.slice(0, 2), ...item.suggestedNotes.slice(0, 2)],
      });
    }
  }

  // 매칭 우선순위 정렬 (exact > prefix > chosung > fuzzy)
  const scoreMap = { exact: 4, prefix: 3, chosung: 2, fuzzy: 1 };
  results.sort((a, b) => scoreMap[b.matchType] - scoreMap[a.matchType]);

  return results.slice(0, 8);
}
