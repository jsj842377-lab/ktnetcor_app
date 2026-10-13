import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 에러 원인을 즉각 파악하기 위한 방어용 안전장치
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('환경 변수(.env.local)에서 Supabase 주소나 키를 찾을 수 없습니다. 서버를 재시작했는지 확인하세요.');
}

// Supabase 클라이언트 생성 (웹사이트 전역에서 사용)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);