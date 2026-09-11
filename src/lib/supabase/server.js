import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Server Components / Route Handlers / Server Actions용 쿠키 기반 클라이언트.
 * 세션 쿠키 읽기·쓰기(Route Handler에서 signIn 등).
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Supabase 환경변수가 설정되지 않았습니다.');
  }

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Component에서는 쿠키 쓰기가 불가 — middleware가 갱신 담당
        }
      },
    },
  });
}
