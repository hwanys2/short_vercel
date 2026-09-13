import { NextResponse } from 'next/server';
import { normalizeEmail } from '@/lib/authBridge';
import { requireAppUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

const envAdmins = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((e) => normalizeEmail(e))
  .filter(Boolean);

/** 앱 관리자 이메일 allowlist (역할 컬럼 없음) */
export const ADMIN_EMAILS = new Set([
  'hwanys2@naver.com',
  'hwanys2na@gmail.com',
  ...envAdmins,
]);

export function isAdminEmail(email) {
  const clean = normalizeEmail(email);
  return Boolean(clean) && ADMIN_EMAILS.has(clean);
}

/**
 * 로그인된 앱 관리자만 허용.
 * @returns {Promise<null | { user: object, admin: import('@supabase/supabase-js').SupabaseClient, response?: never } | { response: NextResponse }>}
 */
export async function requireAdmin(request = null) {
  const user = await requireAppUser(request);
  if (!user) {
    return {
      response: NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      ),
    };
  }

  if (!isAdminEmail(user.email)) {
    return {
      response: NextResponse.json(
        { success: false, error: '관리자만 이용할 수 있습니다.' },
        { status: 403 }
      ),
    };
  }

  return { user, admin: getSupabaseAdmin() };
}
