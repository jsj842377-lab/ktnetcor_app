// 저장 위치 예: src/app/api/geocode/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// 좌표(위도/경도) → 한글 주소. 카카오 REST API 키를 브라우저에 노출하지 않기 위한 서버 프록시입니다.
export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get('lat'));
  const lng = Number(req.nextUrl.searchParams.get('lng'));

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: '좌표가 올바르지 않습니다.' }, { status: 400 });
  }

  // 새 변수명(KAKAO_REST_API_KEY)을 우선 사용하고, 전환 기간에는 기존 변수도 허용
  const key = process.env.KAKAO_REST_API_KEY?.trim() || process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY?.trim();
  if (!key) return NextResponse.json({ address: null });

  try {
    const res = await fetch(`https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${lng}&y=${lat}`, {
      headers: { Authorization: `KakaoAK ${key}` },
    });
    if (!res.ok) return NextResponse.json({ address: null });

    const data = await res.json();
    const doc = data.documents?.[0];
    // 도로명 주소 우선, 없으면 지번 주소
    const address: string | null = doc?.road_address?.address_name || doc?.address?.address_name || null;
    return NextResponse.json({ address });
  } catch (err) {
    console.error('주소 변환 에러:', err);
    return NextResponse.json({ address: null });
  }
}