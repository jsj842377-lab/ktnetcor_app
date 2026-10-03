import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 환경 변수가 없으면 에러를 띄워서 무엇이 문제인지 바로 알려주는 안전장치
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('환경 변수(.env.local)에 Supabase 주소나 키가 없습니다.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);