import { createBrowserClient } from '@supabase/ssr';

/**
 * Client Components용 브라우저 Supabase 클라이언트 (OAuth 등).
 */
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Supabase 환경변수가 설정되지 않았습니다.');
  }

  return createBrowserClient(url, key);
}
