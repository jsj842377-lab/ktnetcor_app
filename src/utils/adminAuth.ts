// 저장 위치 예: src/utils/adminAuth.ts  (import 경로: '@/utils/adminAuth')
import crypto from 'crypto';
import { NextRequest } from 'next/server';

export const ADMIN_COOKIE = 'admin_session';
export const SESSION_TTL_SEC = 60 * 60 * 8; // 8시간

function getSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('서버에 ADMIN_SESSION_SECRET(16자 이상)이 설정되지 않았습니다.');
  }
  return secret;
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', getSecret()).update(payload).digest('hex');
}

/** 타이밍 공격을 피하기 위한 문자열 비교 */
export function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function createSessionToken(): string {
  const exp = String(Math.floor(Date.now() / 1000) + SESSION_TTL_SEC);
  return `${exp}.${sign(exp)}`;
}

export function verifySessionToken(token?: string | null): boolean {
  if (!token) return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig) return false;

  const expected = sign(exp);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;

  return Number(exp) > Date.now() / 1000;
}

export function isAdminRequest(req: NextRequest): boolean {
  return verifySessionToken(req.cookies.get(ADMIN_COOKIE)?.value);
}