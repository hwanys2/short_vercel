import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeEmail, linkShortUserToAuth } from '@/lib/authBridge';
import { getSiteOrigin } from '@/lib/siteUrl';

/**
 * OAuth / 이메일 확인 콜백.
 * - PKCE code → session
 * - short_users.email 매칭 시 auth_user_id 링크
 * - 없으면 온보딩으로
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') || '/dashboard';
  const origin = getSiteOrigin();
  const errorRedirect = `${origin}/login?error=auth_callback`;

  if (!code) {
    return NextResponse.redirect(errorRedirect);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data?.user) {
    console.error('Auth callback exchange error:', error);
    return NextResponse.redirect(`${origin}/login?error=auth_exchange`);
  }

  const authUser = data.user;
  const email = normalizeEmail(authUser.email);

  // 이메일 미검증 방지 (구글 identity)
  const emailVerified =
    authUser.email_confirmed_at ||
    authUser.identities?.some(
      (id) =>
        id.provider === 'email' ||
        (id.identity_data &&
          (id.identity_data.email_verified === true ||
            id.identity_data.email_verified === 'true'))
    );

  if (!email) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=no_email`);
  }

  // Google 등에서 email_verified가 false면 연동하지 않음
  const googleIdentity = authUser.identities?.find((i) => i.provider === 'google');
  if (googleIdentity) {
    const gVerified =
      googleIdentity.identity_data?.email_verified === true ||
      googleIdentity.identity_data?.email_verified === 'true';
    if (!gVerified && !authUser.email_confirmed_at) {
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/login?error=email_unverified`);
    }
  } else if (!emailVerified && !authUser.email_confirmed_at) {
    // 이메일 가입 확인 전이면 여기까지 오면 안 되지만 방어
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=email_unverified`);
  }

  const admin = getSupabaseAdmin();

  // 이미 auth_user_id로 연결됨?
  const { data: byAuth } = await admin
    .from('short_users')
    .select('id, username, email, auth_user_id')
    .eq('auth_user_id', authUser.id)
    .maybeSingle();

  if (byAuth) {
    await admin
      .from('short_users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', byAuth.id);
    return NextResponse.redirect(new URL(next, origin));
  }

  // 이메일로 기존 회원 매칭
  const { data: byEmail } = await admin
    .from('short_users')
    .select('id, username, email, auth_user_id')
    .eq('email', email)
    .maybeSingle();

  if (byEmail) {
    if (byEmail.auth_user_id && byEmail.auth_user_id !== authUser.id) {
      // 스플릿 브레인: 이미 다른 Auth UUID에 연결됨
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/login?error=account_conflict`);
    }

    if (!byEmail.auth_user_id) {
      try {
        await linkShortUserToAuth(admin, byEmail.id, authUser.id);
      } catch (linkErr) {
        console.error('Link short_user error:', linkErr);
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/login?error=link_failed`);
      }
    }

    await admin
      .from('short_users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', byEmail.id);

    return NextResponse.redirect(new URL(next, origin));
  }

  // 신규 (구글 등) → 온보딩
  // user_metadata.username 이 있고 유효하면 온보딩 생략 가능하지만 이메일 가입은 이미 short_users 있음
  return NextResponse.redirect(new URL('/onboarding', origin));
}
