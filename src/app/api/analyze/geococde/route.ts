// 저장 위치: src/app/api/analyze/route.ts  (파일 이름은 반드시 route.ts)
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 60;

// ───────────────────────── 설정값 ─────────────────────────
const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_TOTAL_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const MAX_ATTEMPTS = 3; // 모델당 최초 1회 + 재시도 2회
const FALLBACK_MODEL = 'gemini-3.8-flash';
const MODEL_CACHE_TTL = 60 * 60 * 1000; // 1시간
const MAX_MODEL_CANDIDATES = 4; // 404일 때 순서대로 시도할 모델 수

// 이미지 분석에 부적합한 모델 제외
const EXCLUDED_MODEL_PATTERN =
  /(image|tts|embedding|aqa|audio|live|imagen|veo|learnlm|gemma|robotics|computer-use|native-audio)/i;

// ───────────────────────── 유틸 ─────────────────────────
class HttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function sanitizeField(value: FormDataEntryValue | null, fallback: string, maxLength = 100): string {
  const raw = typeof value === 'string' ? value : '';
  return raw.replace(/[\r\n\t]+/g, ' ').replace(/[|`]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength) || fallback;
}

function stripCodeFence(text: string): string {
  return text.trim().replace(/^```(?:markdown|md)?\s*\n/i, '').replace(/\n?```\s*$/, '').trim();
}

// ───────────────────────── 모델 선택 ─────────────────────────
/** 관리자가 지정한 모델: 환경변수(GEMINI_MODEL) → DB(system_settings.gemini_target_model) 순 */
async function getConfiguredModel(): Promise<string | null> {
  const envModel = process.env.GEMINI_MODEL?.trim();
  if (envModel) return envModel;

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'gemini_target_model')
        .maybeSingle();
      const value = data?.setting_value?.trim();
      if (value) return value;
    }
  } catch (dbErr) {
    console.warn('DB에서 모델 이름 조회 실패:', dbErr);
  }
  return null;
}

/** 'gemini-3.8-flash' → [3, 8]. 날짜/preview/lite 등이 붙은 이름은 null */
function parseFlashVersion(name: string): [number, number] | null {
  const m = name.match(/^gemini-(\d+)(?:\.(\d+))?-flash$/);
  return m ? [Number(m[1]), Number(m[2] ?? 0)] : null;
}

let cachedDiscovered: { names: string[]; expiresAt: number } | null = null;

/** 이 API 키로 사용 가능한 모델 중 최신 flash 정식 버전부터 정렬해 반환 (실패 시 빈 배열) */
async function discoverModels(apiKey: string): Promise<string[]> {
  if (cachedDiscovered && cachedDiscovered.expiresAt > Date.now()) return cachedDiscovered.names;

  try {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', {
      headers: { 'x-goog-api-key': apiKey },
    });
    if (!res.ok) return [];

    const data = await res.json();
    const candidates: string[] = (data.models ?? [])
      .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m: any) => String(m.name).replace('models/', ''))
      .filter((name: string) => name.startsWith('gemini') && !EXCLUDED_MODEL_PATTERN.test(name));

    const stableFlash = candidates
      .map((name) => ({ name, version: parseFlashVersion(name) }))
      .filter((x): x is { name: string; version: [number, number] } => x.version !== null)
      .sort((a, b) => b.version[0] - a.version[0] || b.version[1] - a.version[1])
      .map((x) => x.name);

    const otherFlash = candidates
      .filter((n) => n.includes('flash') && !n.includes('lite') && !stableFlash.includes(n))
      .sort()
      .reverse();

    const names = [...stableFlash, ...otherFlash];
    cachedDiscovered = { names, expiresAt: Date.now() + MODEL_CACHE_TTL };
    return names;
  } catch (err) {
    console.warn('모델 목록 조회 실패:', err);
    return [];
  }
}

/**
 * 시도할 모델 순서: 관리자 지정 모델 → 최신 flash 자동 탐색 → 기본 모델.
 * 지정 모델이 단종(404)되어도 다음 후보로 자동 전환되어 서비스가 멈추지 않습니다.
 */
async function resolveModelCandidates(apiKey: string): Promise<{ names: string[]; configured: string | null }> {
  const configured = await getConfiguredModel();
  const discovered = await discoverModels(apiKey);
  const names = Array.from(
    new Set([configured, ...discovered, FALLBACK_MODEL].filter((n): n is string => Boolean(n)))
  ).slice(0, MAX_MODEL_CANDIDATES);
  return { names, configured };
}

// ───────────────────────── 프롬프트 ─────────────────────────
interface ReportInfo {
  projectNumber: string; photoDate: string; workType: string;
  inspector: string; workDesc: string; photoLocation: string;
}

function buildPrompt(info: ReportInfo): string {
  return `당신은 B2B 산업 현장 안전점검 AI입니다. 첨부된 사진들을 꼼꼼히 분석하여, 반드시 아래의 [현장 안전점검 결과보고서] 양식과 100% 동일한 마크다운(Markdown) 형태로 결과를 작성해주세요.

[작성 지침]
1. 어투: 공공기관 및 대기업 제출용으로 적합한 매우 딱딱하고 격식 있는 보고서 어투를 사용하세요.
2. 조치사항 및 비고, 종합 특이사항 란은 사람이 직접 검토하고 수기 작성할 예정이므로 AI는 절대로 임의의 내용을 채우지 말고 빈칸( )으로 두세요.
3. 결과(양호/불량): 지정된 점검항목에 대해 사진을 분석하여 양호 또는 불량 단답으로 작성하세요.
4. 시간적 순서 파악: 제공된 여러 장의 사진은 왼쪽부터 시간 순서입니다. 마지막 사진을 기준으로 최종 판정하세요.
5. 마크다운 코드블록(\`\`\`)으로 감싸지 말고, 보고서 본문만 출력하세요.

### 현장 안전점검 결과보고서

#### ■ 1. 기본 정보
| 항목 | 내용 | 항목 | 내용 |
|---|---|---|---|
| **공사번호** | ${info.projectNumber} | **점검일자** | ${info.photoDate} |
| **작업공정** | ${info.workType} | **점검자** | ${info.inspector} |
| **작업내용** | ${info.workDesc} | **촬영위치** | ${info.photoLocation} |

#### ■ 2. 점검 항목 및 결과
| 점검항목 | 결과(양호/불량) | 조치사항 | 비고 |
|---|---|---|---|
| 보호구 착용 상태 | (AI 판정) | | |
| 안전표지 설치 | (AI 판정) | | |
| 사다리 및 장비 상태 | (AI 판정) | | |
| 적정 공법 적용 상태 | (AI 판정) | | |
| 정리정돈 상태 | (AI 판정) | | |

#### ■ 3. 종합 특이사항
| 내용 |
|---|
| ( ) |
`;
}

// ───────────────────────── 에러 분류 ─────────────────────────
function getErrorStatus(err: any): number | undefined {
  return err?.status ?? err?.response?.status;
}

function toHttpError(err: any): HttpError {
  if (err instanceof HttpError) return err;

  const status = getErrorStatus(err);
  const message = String(err?.message ?? '');

  if (status === 404) {
    return new HttpError('사용 가능한 AI 모델을 찾지 못했습니다. 관리자에게 모델 설정 확인을 요청해주세요.', 500);
  }
  if (status === 429) {
    const isDaily = /per\s*day|daily|PerDay/i.test(message);
    return new HttpError(
      isDaily
        ? '일일 API 할당량이 소진되었습니다. 내일 다시 시도하거나 할당량을 확인해주세요.'
        : '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
      429
    );
  }
  if (status === 503) {
    return new HttpError('AI 서버가 일시적으로 혼잡합니다. 잠시 후 다시 시도해주세요.', 503);
  }
  if (status === 400 && /API key/i.test(message)) {
    return new HttpError('Gemini API 키가 올바르지 않습니다.', 500);
  }
  if (/SAFETY|blocked/i.test(message)) {
    return new HttpError('AI가 해당 사진의 분석을 거부했습니다. 다른 사진으로 시도해주세요.', 422);
  }
  return new HttpError(message || '서버 오류가 발생했습니다.', 500);
}

// ───────────────────────── 핸들러 ─────────────────────────
export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) throw new HttpError('서버에 Gemini API 키가 설정되지 않았습니다.', 500);

    const formData = await req.formData();
    const files = formData.getAll('images').filter((f): f is File => typeof f !== 'string' && f.size > 0);

    if (files.length === 0) throw new HttpError('사진 파일이 전송되지 않았습니다.', 400);
    if (files.length > MAX_FILES) throw new HttpError(`사진은 최대 ${MAX_FILES}장까지 업로드할 수 있습니다.`, 400);

    let totalSize = 0;
    for (const file of files) {
      const mimeType = (file.type || 'image/jpeg').toLowerCase();
      if (!ALLOWED_MIME_TYPES.includes(mimeType)) throw new HttpError('지원하지 않는 이미지 형식입니다.', 400);
      if (file.size > MAX_FILE_SIZE) throw new HttpError('사진 한 장의 용량이 너무 큽니다.', 413);
      totalSize += file.size;
    }
    if (totalSize > MAX_TOTAL_SIZE) throw new HttpError('전체 사진 용량이 너무 큽니다.', 413);

    const info: ReportInfo = {
      photoDate: sanitizeField(formData.get('photoDate'), '알 수 없음'),
      photoLocation: sanitizeField(formData.get('photoLocation'), '위치 정보 없음'),
      projectNumber: sanitizeField(formData.get('projectNumber'), '미상'),
      workType: sanitizeField(formData.get('workType'), '일반작업'),
      workDesc: sanitizeField(formData.get('workDesc'), '현장 점검', 200),
      inspector: sanitizeField(formData.get('inspector'), '미상'),
    };

    const imageParts = await Promise.all(
      files.map(async (file) => {
        const buffer = Buffer.from(await file.arrayBuffer());
        return { inlineData: { data: buffer.toString('base64'), mimeType: file.type || 'image/jpeg' } };
      })
    );

    const prompt = buildPrompt(info);
    const genAI = new GoogleGenerativeAI(apiKey);
    const { names: modelNames, configured } = await resolveModelCandidates(apiKey);
    console.log(`[모델] 지정: ${configured ?? '(없음)'} / 시도 순서: ${modelNames.join(' → ')}`);

    // 모델 후보를 순서대로 시도:
    //  - 404(모델 사용 불가) → 다음 후보 모델로
    //  - 503 / 일시적 429 → 같은 모델로 재시도
    //  - 그 외 오류 → 즉시 중단
    let lastError: unknown;

    modelLoop: for (const modelName of modelNames) {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { temperature: 0.2 },
      });

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          const result = await model.generateContent([prompt, ...imageParts]);
          const text = stripCodeFence(result.response.text());
          if (!text) throw new HttpError('AI 분석 결과가 비어 있습니다. 다시 시도해주세요.', 502);

          if (configured && configured !== modelName) {
            console.warn(`지정 모델(${configured}) 대신 ${modelName} 로 분석했습니다. system_settings 값을 갱신해주세요.`);
          }
          return NextResponse.json({ report: text, model: modelName });
        } catch (err: any) {
          lastError = err;

          if (getErrorStatus(err) === 404) {
            console.warn(`모델 사용 불가(404): ${modelName} → 다음 후보로 전환`);
            cachedDiscovered = null;
            continue modelLoop;
          }

          const httpErr = toHttpError(err);
          const isDailyQuota = httpErr.status === 429 && /일일/.test(httpErr.message);
          const retryable = (httpErr.status === 503 || httpErr.status === 429) && !isDailyQuota;

          if (!retryable || attempt === MAX_ATTEMPTS) break modelLoop;
          await delay(Math.pow(2, attempt) * 1500); // 3초, 6초
        }
      }
    }

    throw lastError ?? new HttpError('AI 분석 결과를 받아오지 못했습니다.', 502);
  } catch (error: any) {
    const httpErr = toHttpError(error);
    console.error('API 내부 에러:', error);
    return NextResponse.json({ error: httpErr.message }, { status: httpErr.status });
  }
}