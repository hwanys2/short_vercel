import { getSupabaseAdmin } from '@/lib/supabase';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { verifyToken } from '@/lib/auth';
import { normalizeEmail } from '@/lib/authBridge';

const LEGACY_COOKIE = 'short_auth_token';

function shapeUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    tv: row.token_version ?? null,
    auth_user_id: row.auth_user_id ?? null,
    username_changed_at: row.username_changed_at ?? null,
  };
}

/**
 * Supabase Auth 세션 또는 레거시 JWT를 해석해 앱 사용자(BIGINT id)를 반환.
 *
 * @returns {Promise<null | {
 *   id: number,
 *   username: string,
 *   email: string,
 *   tv?: number|null,
 *   auth_user_id?: string|null,
 *   authUserId?: string,
 *   needsOnboarding?: boolean,
 *   source?: 'supabase'|'legacy'
 * }>}
 */
export async function resolveAppUser(request = null) {
  const admin = getSupabaseAdmin();

  // 1) Supabase Auth 세션
  try {
    const supabase = await createSupabaseServerClient();
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    const authUserId =
      claimsData?.claims?.sub ||
      claimsData?.claims?.user_id ||
      null;

    if (!claimsError && authUserId) {
      const { data: row } = await admin
        .from('short_users')
        .select('id, username, email, token_version, auth_user_id, username_changed_at')
        .eq('auth_user_id', authUserId)
        .maybeSingle();

      if (row) {
        return { ...shapeUser(row), authUserId, source: 'supabase' };
      }

      // Auth는 있으나 short_users 없음 → 온보딩 필요 (구글 신규 등)
      let email = claimsData?.claims?.email || null;
      if (!email) {
        const { data: userData } = await supabase.auth.getUser();
        email = userData?.user?.email || null;
      }

      return {
        id: null,
        username: null,
        email: email ? normalizeEmail(email) : null,
        authUserId,
        needsOnboarding: true,
        source: 'supabase',
      };
    }
  } catch (err) {
    console.error('resolveAppUser supabase path:', err);
  }

  // 2) 레거시 JWT 쿠키
  try {
    let token = null;
    if (request?.cookies?.get) {
      token = request.cookies.get(LEGACY_COOKIE)?.value || null;
    } else {
      const { cookies } = await import('next/headers');
      const cookieStore = await cookies();
      token = cookieStore.get(LEGACY_COOKIE)?.value || null;
    }

    if (!token) return null;

    const decoded = verifyToken(token);
    if (!decoded?.id) return null;

    const { data: row } = await admin
      .from('short_users')
      .select('id, username, email, token_version, auth_user_id, username_changed_at')
      .eq('id', decoded.id)
      .maybeSingle();

    if (!row) return null;

    // token_version 검사 (구버전 토큰 tv 없음 → 만료까지 허용)
    if (
      typeof decoded.tv === 'number' &&
      typeof row.token_version === 'number' &&
      decoded.tv !== row.token_version
    ) {
      return null;
    }

    return { ...shapeUser(row), source: 'legacy' };
  } catch (err) {
    console.error('resolveAppUser legacy path:', err);
    return null;
  }
}

/**
 * 로그인된 앱 사용자만 (온보딩 미완료는 null 취급 — API 소유권용).
 */
export async function requireAppUser(request = null) {
  const user = await resolveAppUser(request);
  if (!user || user.needsOnboarding || !user.id) {
    return null;
  }
  return user;
}
