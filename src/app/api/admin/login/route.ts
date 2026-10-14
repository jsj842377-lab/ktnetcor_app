// 저장 위치: src/app/api/admin/login/route.ts  (파일 이름은 반드시 route.ts)
import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_COOKIE,
  SESSION_TTL_SEC,
  createSessionToken,
  safeEqual,
} from '@/utils/adminAuth';

export const runtime = 'nodejs';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// 한글 입력 방식에 따른 유니코드 차이(NFC/NFD)와 앞뒤 공백을 맞춰서 비교
const normalize = (s: string) => s.normalize('NFC').trim();

// 로그인
export async function POST(req: NextRequest) {
  try {
    const adminName = normalize(process.env.ADMIN_NAME ?? '') || '관리자';
    const adminPassword = normalize(process.env.ADMIN_PASSWORD ?? '') || '1234';

    const body = await req.json().catch(() => ({}));
    const name = typeof body?.name === 'string' ? normalize(body.name) : '';
    const password = typeof body?.password === 'string' ? normalize(body.password) : '';

    const nameOk = safeEqual(name, adminName);
    const passwordOk = safeEqual(password, adminPassword);

    if (!(nameOk && passwordOk)) {
      // 서버 로그에만 남깁니다 (실제 값은 기록하지 않고, 일치 여부와 글자 수만 기록).
      console.warn(
        `[관리자 로그인 실패] 이름 일치: ${nameOk} (입력 ${name.length}자 / 서버 ${adminName.length}자), ` +
          `비밀번호 일치: ${passwordOk} (입력 ${password.length}자 / 서버 ${adminPassword.length}자)`
      );
      await delay(800); // 무차별 대입 완화
      return NextResponse.json({ error: '관리자 이름 또는 비밀번호가 일치하지 않습니다.' }, { status: 401 });
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set(ADMIN_COOKIE, createSessionToken(), {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: SESSION_TTL_SEC,
    });
    return res;
  } catch (err: any) {
    console.error('관리자 로그인 에러:', err);
    return NextResponse.json({ error: err.message || '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// 로그아웃
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
