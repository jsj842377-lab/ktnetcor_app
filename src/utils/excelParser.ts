import * as XLSX from 'xlsx';

export interface MaterialItem {
  id: string;
  seq: number; // 순번 (이미지 순번과 1:1 매칭: #1, #2, #3...)
  materialCode: string; // 자재코드 (예: MAT-0101)
  classSubcategory: string; // 클래스 소분류 (예: 광분배함류, 접속슬리브류, 5G안테나류)
  name: string; // 품명
  spec: string; // 규격
  docQty: number; // 전산 수량 (장부)
  actualQty?: number | null; // 실사 수량 (미계측 시 null)
  unit: string;
  category?: string;
  discrepancyReason?: string; // 불일치 사유
  remarks?: string;
  sheetName?: string;
  photoUrl?: string;
}

export interface ParsedExcelData {
  fileName: string;
  fileSizeMb: number;
  sheetNames: string[];
  activeSheetName: string;
  totalRows: number;
  projectNumber: string;
  docTitle: string;
  docDate: string;
  location: string;
  recipient: string;
  materials: MaterialItem[];
  sheetMaterials: Record<string, MaterialItem[]>;
  rawSummary: string;
}

// 공통 불필요 문자열 정제
function cleanText(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

// 숫자 수량 정제
function parseQty(val: any): number {
  if (typeof val === 'number') return Math.max(1, Math.round(val));
  if (!val) return 1;
  const numStr = String(val).replace(/,/g, '').replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(numStr);
  return isNaN(parsed) || parsed <= 0 ? 1 : Math.round(parsed);
}

// 실사 수량 정제 (0 이상 정수 또는 null)
function parseNullableQty(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  const numStr = String(val).replace(/,/g, '').replace(/[^0-9.-]/g, '');
  if (numStr === '') return null;
  const parsed = parseFloat(numStr);
  return isNaN(parsed) || parsed < 0 ? null : Math.round(parsed);
}

// 헤더 행 탐색 및 컬럼 인덱스 매핑
interface ColumnMapping {
  seqIdx: number;
  codeIdx: number;
  classSubcategoryIdx: number;
  nameIdx: number;
  specIdx: number;
  qtyIdx: number;
  actualQtyIdx: number;
  unitIdx: number;
  catIdx: number;
  remIdx: number;
  reasonIdx: number;
  headerRowIdx: number;
}

function detectColumnMapping(rows: any[][]): ColumnMapping {
  let bestMapping: ColumnMapping = {
    seqIdx: -1,
    codeIdx: -1,
    classSubcategoryIdx: -1,
    nameIdx: -1,
    specIdx: -1,
    qtyIdx: -1,
    actualQtyIdx: -1,
    unitIdx: -1,
    catIdx: -1,
    remIdx: -1,
    reasonIdx: -1,
    headerRowIdx: -1,
  };

  // 상위 25개 행 중에서 가장 적합한 헤더 행 찾기
  const maxSearchRows = Math.min(rows.length, 25);
  for (let r = 0; r < maxSearchRows; r++) {
    const row = rows[r];
    if (!row || !Array.isArray(row)) continue;

    let foundSeq = -1;
    let foundCode = -1;
    let foundClassSub = -1;
    let foundName = -1;
    let foundSpec = -1;
    let foundQty = -1;
    let foundActualQty = -1;
    let foundUnit = -1;
    let foundCat = -1;
    let foundRem = -1;
    let foundReason = -1;

    for (let c = 0; c < row.length; c++) {
      const cell = cleanText(row[c]).toLowerCase().replace(/\s+/g, '');

      // 순번 매칭
      if (
        foundSeq === -1 &&
        (cell === '순번' || cell === 'no' || cell === 'no.' || cell === '번호' || cell === '순서' || cell === 'seq')
      ) {
        foundSeq = c;
      }
      // 자재코드 매칭
      else if (
        foundCode === -1 &&
        (cell.includes('자재코드') ||
          cell.includes('품목코드') ||
          cell.includes('물품코드') ||
          cell.includes('관리번호') ||
          cell.includes('자재번호') ||
          cell === '코드' ||
          cell === 'code')
      ) {
        foundCode = c;
      }
      // 클래스 소분류 매칭
      else if (
        foundClassSub === -1 &&
        (cell.includes('소분류') ||
          cell.includes('클래스') ||
          cell.includes('세부분류') ||
          cell.includes('품목분류') ||
          cell === 'class' ||
          cell === 'subclass')
      ) {
        foundClassSub = c;
      }
      // 실사 수량 매칭
      else if (
        foundActualQty === -1 &&
        (cell.includes('실사수량') ||
          cell.includes('실측수량') ||
          cell.includes('현장수량') ||
          cell.includes('계측수량') ||
          cell.includes('확인수량') ||
          cell === '실사' ||
          cell === '실측')
      ) {
        foundActualQty = c;
      }
      // 불일치 사유 매칭
      else if (
        foundReason === -1 &&
        (cell.includes('불일치사유') || cell.includes('불일치원인') || cell.includes('사유') || cell.includes('원인'))
      ) {
        foundReason = c;
      }
      // 품명 매칭
      else if (
        foundName === -1 &&
        (cell.includes('품명') ||
          cell.includes('품목') ||
          cell.includes('자재명') ||
          cell.includes('명칭') ||
          cell === '자재' ||
          cell === 'item' ||
          cell === 'material' ||
          cell === 'description')
      ) {
        foundName = c;
      }
      // 규격 매칭
      else if (
        foundSpec === -1 &&
        (cell.includes('규격') ||
          cell.includes('사양') ||
          cell.includes('spec') ||
          cell.includes('치수') ||
          cell.includes('모델'))
      ) {
        foundSpec = c;
      }
      // 수량 (전산/장부) 매칭
      else if (
        foundQty === -1 &&
        (cell.includes('전산수량') ||
          cell.includes('장부수량') ||
          cell.includes('수량') ||
          cell.includes('불출수량') ||
          cell.includes('입고수량') ||
          cell.includes('출고수량') ||
          cell.includes('청구수량') ||
          cell.includes('납품수량') ||
          cell === 'qty' ||
          cell === 'quantity' ||
          cell === '계측대상수량')
      ) {
        foundQty = c;
      }
      // 단위 매칭
      else if (
        foundUnit === -1 &&
        (cell.includes('단위') || cell === 'unit' || cell === '단위명')
      ) {
        foundUnit = c;
      }
      // 대분류/구분 매칭
      else if (
        foundCat === -1 &&
        (cell.includes('구분') || cell.includes('대분류') || cell.includes('공종') || cell === 'category')
      ) {
        foundCat = c;
      }
      // 비고 매칭
      else if (
        foundRem === -1 &&
        (cell.includes('비고') || cell === 'remark' || cell === 'remarks' || cell.includes('메모'))
      ) {
        foundRem = c;
      }
    }

    // 이름이나 수량이 검출되면 유효 헤더 행으로 판단
    if (foundName !== -1 && foundQty !== -1) {
      bestMapping = {
        seqIdx: foundSeq,
        codeIdx: foundCode,
        classSubcategoryIdx: foundClassSub,
        nameIdx: foundName,
        specIdx: foundSpec,
        qtyIdx: foundQty,
        actualQtyIdx: foundActualQty,
        unitIdx: foundUnit,
        catIdx: foundCat,
        remIdx: foundRem,
        reasonIdx: foundReason,
        headerRowIdx: r,
      };
      break;
    } else if (foundName !== -1 && bestMapping.nameIdx === -1) {
      bestMapping = {
        seqIdx: foundSeq,
        codeIdx: foundCode,
        classSubcategoryIdx: foundClassSub,
        nameIdx: foundName,
        specIdx: foundSpec,
        qtyIdx: foundQty,
        actualQtyIdx: foundActualQty,
        unitIdx: foundUnit,
        catIdx: foundCat,
        remIdx: foundRem,
        reasonIdx: foundReason,
        headerRowIdx: r,
      };
    }
  }

  return bestMapping;
}

// 클래스 소분류 자동 유추 헬퍼
function inferClassSubcategory(name: string, category: string, spec: string): string {
  const t = (name + ' ' + category + ' ' + spec).toLowerCase();
  if (t.includes('fdf') || t.includes('광분배') || t.includes('단자함') || t.includes('배선반')) return '광분배함류';
  if (t.includes('슬리브') || t.includes('접속자재') || t.includes('ofjc') || t.includes('함체')) return '접속함체류';
  if (t.includes('라바콘') || t.includes('안전') || t.includes('사다리') || t.includes('소화기') || t.includes('헬멧')) return '도로안전자재류';
  if (t.includes('안테나') || t.includes('mimo') || t.includes('rrf') || t.includes('중계기') || t.includes('5g')) return '5G안테나류';
  if (t.includes('동축') || t.includes('점퍼') || t.includes('급전선') || t.includes('피더')) return '급전선류';
  if (t.includes('맨홀') || t.includes('관로') || t.includes('행거') || t.includes('토목') || t.includes('주철')) return '통신구토목자재류';
  if (t.includes('접지') || t.includes('피뢰') || t.includes('동봉')) return '접지/피뢰설비류';
  if (t.includes('케이블') || t.includes('광섬유') || t.includes('선로')) return '광선로케이블류';
  return category || '통신선로자재류';
}

// 시트에서 자재 목록 추출
export function parseSheetToMaterials(
  sheet: XLSX.WorkSheet,
  sheetName: string
): { materials: MaterialItem[]; headerRowIdx: number; rowCount: number } {
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    blankrows: false,
  });

  if (!rows || rows.length === 0) {
    return { materials: [], headerRowIdx: -1, rowCount: 0 };
  }

  const mapping = detectColumnMapping(rows);
  const materials: MaterialItem[] = [];

  const startRow = mapping.headerRowIdx !== -1 ? mapping.headerRowIdx + 1 : 0;
  let counter = 1;

  for (let r = startRow; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !Array.isArray(row)) continue;

    // 품명 추출
    let name = '';
    if (mapping.nameIdx !== -1 && row[mapping.nameIdx]) {
      name = cleanText(row[mapping.nameIdx]);
    } else {
      // 매핑이 없으면 텍스트가 있는 첫번째 컬럼 탐색
      for (let c = 0; c < Math.min(row.length, 6); c++) {
        if (c === mapping.seqIdx || c === mapping.codeIdx) continue;
        const val = cleanText(row[c]);
        if (val && isNaN(Number(val)) && val.length >= 2 && !val.includes('합계') && !val.includes('총계')) {
          name = val;
          break;
        }
      }
    }

    if (!name || name === '합계' || name === '총계' || name === '소계' || name.startsWith('※') || name.startsWith('주)')) {
      continue;
    }

    // 순번 추출 (이미지 순번과 1:1 매칭)
    let seq = counter;
    if (mapping.seqIdx !== -1 && row[mapping.seqIdx] !== undefined) {
      const parsedSeq = parseInt(cleanText(row[mapping.seqIdx]).replace(/[^0-9]/g, ''), 10);
      if (!isNaN(parsedSeq) && parsedSeq > 0) {
        seq = parsedSeq;
      }
    }

    // 자재코드 추출
    let materialCode = '';
    if (mapping.codeIdx !== -1 && row[mapping.codeIdx]) {
      materialCode = cleanText(row[mapping.codeIdx]);
    }
    if (!materialCode) {
      const prefix = sheetName ? sheetName.replace(/[^a-zA-Z0-9가-힣]/g, '').slice(0, 3).toUpperCase() : 'KT';
      materialCode = `MAT-${prefix}-${String(seq).padStart(4, '0')}`;
    }

    // 규격 추출
    let spec = '표준 규격';
    if (mapping.specIdx !== -1 && row[mapping.specIdx]) {
      spec = cleanText(row[mapping.specIdx]) || '표준 규격';
    }

    // 전산/장부 수량 추출
    let qty = 1;
    if (mapping.qtyIdx !== -1 && row[mapping.qtyIdx] !== undefined) {
      qty = parseQty(row[mapping.qtyIdx]);
    } else {
      // 숫자로 된 셀 탐색
      for (let c = 0; c < row.length; c++) {
        if (c !== mapping.nameIdx && c !== mapping.specIdx && c !== mapping.seqIdx && c !== mapping.codeIdx) {
          const num = parseQty(row[c]);
          if (num > 0) {
            qty = num;
            break;
          }
        }
      }
    }

    // 실사 수량 추출 (미입력 또는 빈칸일 시 null)
    let actualQty: number | null = null;
    if (mapping.actualQtyIdx !== -1 && row[mapping.actualQtyIdx] !== undefined && row[mapping.actualQtyIdx] !== '') {
      actualQty = parseNullableQty(row[mapping.actualQtyIdx]);
    }

    // 단위 추출
    let unit = '개';
    if (mapping.unitIdx !== -1 && row[mapping.unitIdx]) {
      unit = cleanText(row[mapping.unitIdx]) || '개';
    } else {
      // 이름이나 규격에서 단위 유추
      if (name.includes('케이블') || name.includes('선로') || name.includes('배선')) unit = 'm';
      else if (name.includes('박스') || name.includes('슬리브')) unit = '팩';
      else if (name.includes('안테나') || name.includes('장비') || name.includes('계측기')) unit = '대';
      else if (name.includes('함체') || name.includes('맨홀') || name.includes('세트')) unit = '조';
    }

    // 대분류 / 카테고리
    const category = mapping.catIdx !== -1 ? cleanText(row[mapping.catIdx]) : sheetName;

    // 클래스 소분류 추출
    let classSubcategory = '';
    if (mapping.classSubcategoryIdx !== -1 && row[mapping.classSubcategoryIdx]) {
      classSubcategory = cleanText(row[mapping.classSubcategoryIdx]);
    }
    if (!classSubcategory) {
      classSubcategory = inferClassSubcategory(name, category, spec);
    }

    // 불일치 사유 및 비고
    let discrepancyReason = '';
    if (mapping.reasonIdx !== -1 && row[mapping.reasonIdx]) {
      discrepancyReason = cleanText(row[mapping.reasonIdx]);
    }
    const remarks = mapping.remIdx !== -1 ? cleanText(row[mapping.remIdx]) : '';

    materials.push({
      id: `xl-${sheetName.replace(/\s+/g, '')}-${seq}`,
      seq,
      materialCode,
      classSubcategory,
      name,
      spec,
      docQty: qty,
      actualQty,
      unit,
      category,
      discrepancyReason,
      remarks,
      sheetName,
    });

    counter++;
  }

  return { materials, headerRowIdx: mapping.headerRowIdx, rowCount: rows.length };
}

// 상단 헤더 영역에서 공사 메타데이터(공사번호, 일자, 현장위치 등) 추출
function extractProjectMetadata(rows: any[][]): {
  projectNumber: string;
  docTitle: string;
  docDate: string;
  location: string;
  recipient: string;
} {
  let projectNumber = '';
  let docTitle = '자재실사 및 불출대장';
  let docDate = new Date().toISOString().slice(0, 10);
  let location = '현장 자재창고';
  const recipient = '경기설계팀 실사관';

  const maxSearchRows = Math.min(rows.length, 12);
  for (let r = 0; r < maxSearchRows; r++) {
    const row = rows[r];
    if (!row) continue;
    const rowText = row.map(cleanText).join(' ');

    if (!docTitle || docTitle === '자재실사 및 불출대장') {
      if (rowText.includes('불출') || rowText.includes('거래명세') || rowText.includes('납품') || rowText.includes('인수')) {
        docTitle = rowText.slice(0, 40).trim();
      }
    }

    // 공사번호 패턴 탐색 (예: 2026-..., KT-..., 경기-...)
    const pMatch = rowText.match(/([가-힣a-zA-Z0-9]{2,10}[-_][0-9]{2,6}[-_]?[0-9]{0,6})/);
    if (pMatch && !projectNumber) {
      projectNumber = pMatch[1];
    }

    // 날짜 패턴 (YYYY-MM-DD 또는 YYYY.MM.DD)
    const dMatch = rowText.match(/(202[0-9][-./][0-1]?[0-9][-./][0-3]?[0-9])/);
    if (dMatch) {
      docDate = dMatch[1].replace(/[./]/g, '-');
    }

    // 현장 / 위치
    if (rowText.includes('현장') || rowText.includes('위치') || rowText.includes('납품처')) {
      const parts = rowText.split(/[:：]/);
      if (parts.length > 1) {
        location = parts[1].slice(0, 30).trim();
      }
    }
  }

  if (!projectNumber) {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    projectNumber = `경기-광선로-2026-${randomSuffix}`;
  }

  return { projectNumber, docTitle, docDate, location, recipient };
}

// 엑셀 파일(File 또는 ArrayBuffer) 파싱 메인 진입점
export async function parseExcelFile(file: File): Promise<ParsedExcelData> {
  const buffer = await file.arrayBuffer();
  const fileSizeMb = parseFloat((file.size / (1024 * 1024)).toFixed(2));

  // SheetJS로 워크북 로드
  const workbook = XLSX.read(buffer, {
    type: 'array',
    cellDates: true,
    dense: true,
  });

  const sheetNames = workbook.SheetNames || [];
  if (sheetNames.length === 0) {
    throw new Error('엑셀 파일에 유효한 워크시트가 존재하지 않습니다.');
  }

  const sheetMaterials: Record<string, MaterialItem[]> = {};
  let totalMaterials: MaterialItem[] = [];
  let totalRows = 0;
  let primaryProjectInfo = {
    projectNumber: '',
    docTitle: file.name.replace(/\.[^/.]+$/, ''),
    docDate: new Date().toISOString().slice(0, 10),
    location: '현장 자재창고',
    recipient: '경기설계팀 실사관',
  };

  // 모든 시트 순회
  for (let i = 0; i < sheetNames.length; i++) {
    const sName = sheetNames[i];
    const sheet = workbook.Sheets[sName];
    if (!sheet) continue;

    const { materials, rowCount } = parseSheetToMaterials(sheet, sName);
    totalRows += rowCount;
    sheetMaterials[sName] = materials;
    totalMaterials = totalMaterials.concat(materials);

    // 첫 번째 유효 시트에서 메타데이터 추출
    if (i === 0) {
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      const meta = extractProjectMetadata(rows);
      primaryProjectInfo = meta;
      if (!primaryProjectInfo.docTitle || primaryProjectInfo.docTitle === '자재실사 및 불출대장') {
        primaryProjectInfo.docTitle = file.name.replace(/\.[^/.]+$/, '');
      }
    }
  }

  // 자재가 가장 많은 시트를 기본 활성 시트로 지정하거나, 전체를 합산
  let activeSheetName = sheetNames[0];
  let maxCount = 0;
  for (const sName of sheetNames) {
    if (sheetMaterials[sName].length > maxCount) {
      maxCount = sheetMaterials[sName].length;
      activeSheetName = sName;
    }
  }

  // 기본 활성 자재 목록
  const activeMaterials = sheetMaterials[activeSheetName]?.length > 0
    ? sheetMaterials[activeSheetName]
    : totalMaterials;

  const rawSummary = `[엑셀 파싱 요약] 파일명: ${file.name} (${fileSizeMb}MB) | 총 ${sheetNames.length}개 시트 (${sheetNames.join(', ')}) | 감지된 총 자재 품목: ${totalMaterials.length}건`;

  return {
    fileName: file.name,
    fileSizeMb,
    sheetNames,
    activeSheetName,
    totalRows,
    projectNumber: primaryProjectInfo.projectNumber,
    docTitle: primaryProjectInfo.docTitle,
    docDate: primaryProjectInfo.docDate,
    location: primaryProjectInfo.location,
    recipient: primaryProjectInfo.recipient,
    materials: activeMaterials.length > 0 ? activeMaterials : totalMaterials,
    sheetMaterials,
    rawSummary,
  };
}

// 테스트 및 데모용 대용량 표준 자재실사 엑셀 파일 생성기 (7MB급 구조)
// 이미지 순번과 동일한 순번(1, 2, 3...) 및 3대 점검 컬럼(자재코드, 클래스 소분류, 실사수량) 완벽 탑재
export function createSampleExcelFile(): File {
  const wb = XLSX.utils.book_new();

  // 1. 광선로 공사 자재 시트 (이미지 순번과 1:1 매칭되는 순번 컬럼 탑재)
  const sheet1Data = [
    ['KT 경기설계팀 광통신선로공사 자재불출 및 실사관리대장', '', '', '', '', '', '', '', ''],
    ['공사번호: 경기-광선로-2026-0210', '', '실사일자: 2026-10-15', '', '현장위치: 경기도 안산시 단원구 초지동 자재창고', '', '', '', ''],
    ['순번', '자재코드', '클래스 소분류', '품명(자재명)', '규격 및 사양', '전산수량', '실사수량', '단위', '불일치 사유 및 비고'],
    [1, 'MAT-0101', '광분배함류', '옥외용 광분배함 (FDF)', '24Core 벽부형 알루미늄 방수', 4, 4, '개', '수량 일치 (정상)'],
    [2, 'MAT-0102', '접속함체류', '광접속 보호 슬리브', '40mm 단심용 (100개입)', 5, '', '팩', ''], // 실사 수량 없음 -> '실사 수량 계측을 실시하시겠습니까?' 질문 트리거
    [3, 'MAT-0103', '도로안전자재류', '공사용 반사 라바콘', '70cm 고휘도 반사시트 부착', 8, 6, '개', ''], // 전산 8 vs 실사 6 -> '불일치 사유' 질문 트리거
    [4, 'MAT-0104', '접지/피뢰설비류', '접지동봉', '14Φ × 1000mm KS규격 전식방지', 6, 6, '개', '수량 일치 (정상)'],
    [5, 'MAT-0105', '접속함체류', '광케이블 접속함체 (OFJC)', '직선/분기 겸용 48Core 방수', 2, '', '조', ''], // 실사 수량 없음
    [6, 'MAT-0106', '부자재류', '리본 광섬유 심선 식별 튜브', '12심 6색 세트', 10, 10, '세트', '정상보관'],
    [7, 'MAT-0107', '광선로케이블류', '광점퍼코드 (SC-SC)', '단일모드 3m 싱글', 25, 20, '가닥', ''], // 5개 불일치
  ];

  // 2. 5G 기지국 안테나 설비 시트
  const sheet2Data = [
    ['5G 무선기지국 및 중계장비 안테나 설비 납품명세서', '', '', '', '', '', '', '', ''],
    ['공사번호: 성남-분당-2026-0315', '', '실사일자: 2026-10-14', '', '현장위치: 성남시 분당구 정자동 옥상', '', '', '', ''],
    ['순번', '자재코드', '클래스 소분류', '장비/자재명', '상세사양', '전산수량', '실사수량', '단위', '불일치 사유 및 비고'],
    [1, 'ANT-0201', '5G안테나류', '5G Massive MIMO 안테나', '3.5GHz 64T64R 고출력', 3, 3, '대', '제조사 밀봉 일치'],
    [2, 'ANT-0202', '급전선류', '동축 점퍼 케이블', '1/2인치 5m 딘-딘(7/16 DIN)', 12, '', '가닥', ''], // 실사 수량 없음
    [3, 'ANT-0203', '접지/피뢰설비류', '피뢰침 설비 세트', '돌침 1.5m + 취부금구 일체', 2, 1, '세트', ''], // 불일치 (2 vs 1)
    [4, 'ANT-0204', '부자재류', '자기융착 방수테이프', '3M 뷰틸 2228 고절연', 10, 10, '롤', '옥외내후성'],
    [5, 'ANT-0205', '부자재류', '케이블 타이 (옥외내후성)', '300mm 블랙 UV차단 (100개입)', 6, 6, '팩', '선정리용'],
  ];

  // 3. 지하 통신구 관로 자재 시트
  const sheet3Data = [
    ['지하 통신구 및 맨홀 관로 토목자재 입고실사대장', '', '', '', '', '', '', '', ''],
    ['공사번호: 수원-팔달-2026-0188', '', '실사일자: 2026-10-13', '', '현장위치: 수원시 팔달구 인계동 통신구', '', '', '', ''],
    ['순번', '자재코드', '클래스 소분류', '품목명', '규격', '전산수량', '실사수량', '단위', '불일치 사유 및 비고'],
    [1, 'CIV-0301', '통신구토목자재류', '주철 맨홀 뚜껑 및 틀', '원형 648mm 차도용 20톤', 2, 2, '조', 'KT 잠금형 정상'],
    [2, 'CIV-0302', '통신구토목자재류', '케이블 받침대 (행거)', '3련 아연도금 600mm', 15, '', '개', ''], // 실사 수량 없음
    [3, 'CIV-0303', '밀폐자재류', '가스 밀폐 플러그', '100A 방화/방수 차수재', 8, 5, '개', ''], // 불일치 (8 vs 5)
    [4, 'CIV-0304', '도로안전자재류', '맨홀 안전 승하강 사다리', 'FRP 절연 3단 2.5m', 1, 1, '대', '미끄럼방지 적합'],
  ];

  const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);
  const ws2 = XLSX.utils.aoa_to_sheet(sheet2Data);
  const ws3 = XLSX.utils.aoa_to_sheet(sheet3Data);

  XLSX.utils.book_append_sheet(wb, ws1, '광선로공사_자재');
  XLSX.utils.book_append_sheet(wb, ws2, '5G기지국_설비');
  XLSX.utils.book_append_sheet(wb, ws3, '통신구토목_자재');

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  return new File([blob], 'KT경기_광통신자재실사대장_7MB_표준.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    lastModified: Date.now(),
  });
}

