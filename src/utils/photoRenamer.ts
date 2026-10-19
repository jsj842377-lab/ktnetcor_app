/**
 * 업로드된 현장 사진 파일 자동 명명(Renaming) 유틸리티
 * 
 * 공사번호(projectNumber)와 촬영/실사일자(date), 순번(index)을 기반으로
 * 클라우드 스토리지(Supabase Storage 등)에 저장할 표준화된 파일명을 자동 생성하고 File 객체를 변환합니다.
 * 
 * 명명 규칙(Pattern):
 *  - [공사번호]_[YYYYMMDD]_[순번(01, 02..)]_[고유해시].[확장자]
 *  예: 안산-설비-2026-0096_20261015_01_8a3f.jpg
 */

export interface PhotoRenameOptions {
  projectNumber?: string | null;
  date?: Date | string | null;
  index?: number;
  total?: number;
  originalName?: string;
  ext?: string;
  folder?: string;
  includeEntropy?: boolean;
}

/**
 * 날짜 객체 또는 문자열을 YYYYMMDD 포맷으로 변환
 */
export function formatDateToYYYYMMDD(d?: Date | string | null): string {
  let dateObj: Date;
  if (!d) {
    dateObj = new Date();
  } else if (typeof d === 'string') {
    const parsed = new Date(d);
    dateObj = isNaN(parsed.getTime()) ? new Date() : parsed;
  } else if (d instanceof Date && !isNaN(d.getTime())) {
    dateObj = d;
  } else {
    dateObj = new Date();
  }

  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

/**
 * 스토리지 및 파일시스템에서 안전한 공사번호 문자열로 정제
 * (공백 및 특수문자를 하이픈으로 치환)
 */
export function sanitizeProjectNumber(projectNumber?: string | null): string {
  if (!projectNumber || !projectNumber.trim() || projectNumber.trim() === '미입력') {
    return 'PRJ-COMMON';
  }
  // 파일명에 유효하지 않은 특수문자(/ \ ? % * : | " < > 공백 등)를 하이픈(-)으로 치환
  return projectNumber
    .trim()
    .replace(/[/\\?%*:|"<> \t\r\n]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * 파일 확장자 추출 (기본값: jpg)
 */
export function extractExtension(filename?: string, defaultExt = 'jpg'): string {
  if (!filename || !filename.includes('.')) return defaultExt;
  const parts = filename.split('.');
  const ext = parts.pop()?.toLowerCase() || defaultExt;
  // 유효한 이미지/문서 확장자인지 점검
  if (/^[a-z0-9]{2,5}$/.test(ext)) {
    return ext === 'jpeg' ? 'jpg' : ext;
  }
  return defaultExt;
}

/**
 * 1. 단일 사진 파일명 생성 헬퍼
 * 
 * 패턴: ${projectNumber}_${YYYYMMDD}_${index}${entropy}.${ext}
 */
export function generatePhotoFileName(options: PhotoRenameOptions): string {
  const {
    projectNumber,
    date,
    index = 0,
    total = 1,
    originalName = '',
    ext,
    includeEntropy = true,
  } = options;

  const sanitizedPrj = sanitizeProjectNumber(projectNumber);
  const dateStr = formatDateToYYYYMMDD(date);
  
  // 두 자리 이상 순번 (01, 02... 또는 100장 이상일 경우 3자리)
  const padLength = Math.max(2, String(total).length);
  const seqStr = String(index + 1).padStart(padLength, '0');

  // 확장자 확인
  const resolvedExt = ext || extractExtension(originalName, 'jpg');

  // 스토리지 파일명 중복 충돌을 방지하기 위한 짧은 고유 해시 (4자리 영숫자)
  const entropy = includeEntropy ? `_${Math.random().toString(36).substring(2, 6)}` : '';

  return `${sanitizedPrj}_${dateStr}_${seqStr}${entropy}.${resolvedExt}`;
}

/**
 * 2. 스토리지 업로드용 경로 생성 헬퍼
 * 폴더 지정 시 folder/filename 반환
 */
export function generateStoragePath(options: PhotoRenameOptions): string {
  const fileName = generatePhotoFileName(options);
  if (options.folder && options.folder.trim()) {
    const cleanFolder = options.folder.trim().replace(/^\/+|\/+$/g, '');
    return `${cleanFolder}/${fileName}`;
  }
  return fileName;
}

/**
 * 3. File 객체의 이름을 공사번호 및 날짜 기반 패턴으로 변경한 새 File 객체 생성
 */
export function renamePhotoFile(file: File, options: Omit<PhotoRenameOptions, 'originalName'>): File {
  const newFileName = generatePhotoFileName({
    ...options,
    originalName: file.name,
    ext: extractExtension(file.name),
  });

  // 원본 File의 바이너리 blob을 유지하며 새 파일명으로 새 File 인스턴스 생성
  return new File([file], newFileName, {
    type: file.type || 'image/jpeg',
    lastModified: file.lastModified || Date.now(),
  });
}

/**
 * 4. 복수 개의 업로드 사진 파일 일괄 명명 헬퍼
 * 
 * @param files 원본 File 배열
 * @param options 공사번호, 일자 등 옵션
 * @returns 공사번호_일자_순번 패턴으로 파일명이 자동 변경된 File[] 배열
 */
export function renameUploadedPhotos(
  files: File[],
  options?: {
    projectNumber?: string | null;
    date?: Date | string | null;
    includeEntropy?: boolean;
  }
): File[] {
  if (!files || files.length === 0) return [];

  const total = files.length;
  return files.map((file, idx) =>
    renamePhotoFile(file, {
      projectNumber: options?.projectNumber,
      date: options?.date,
      index: idx,
      total,
      includeEntropy: options?.includeEntropy ?? true,
    })
  );
}
