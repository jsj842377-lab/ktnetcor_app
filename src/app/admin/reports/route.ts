// 저장 위치 예: src/app/api/admin/reports/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdminRequest } from '@/utils/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 1000; // Supabase 기본 조회 제한(1000건)을 넘는 데이터도 모두 가져오기 위한 페이지 크기

export async function GET(req: NextRequest) {
  try {
    if (!isAdminRequest(req)) {
      return NextResponse.json({ error: '관리자 로그인이 필요합니다.' }, { status: 401 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      return NextResponse.json({ error: '서버에 Supabase 설정이 없습니다.' }, { status: 500 });
    }

    const yearParam = Number(req.nextUrl.searchParams.get('year'));
    const year = Number.isInteger(yearParam) && yearParam >= 2000 && yearParam <= 2100
      ? yearParam
      : new Date().getFullYear();

    // 한국 시간(KST) 기준 연도 범위
    const from = `${year}-01-01T00:00:00+09:00`;
    const to = `${year + 1}-01-01T00:00:00+09:00`;

    const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

    const reports: any[] = [];
    for (let start = 0; ; start += PAGE_SIZE) {
      const { data, error } = await supabase
        .from('inspections')
        .select('id, created_at, ai_report_text, workers ( worker_name )')
        .gte('created_at', from)
        .lt('created_at', to)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(start, start + PAGE_SIZE - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      reports.push(...data);
      if (data.length < PAGE_SIZE) break;
    }

    return NextResponse.json({ reports });
  } catch (err: any) {
    console.error('보고서 조회 에러:', err);
    return NextResponse.json({ error: err.message || '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}