import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeEmail, linkShortUserToAuth } from '@/lib/authBridge';
import { getSiteOrigin } from '@/lib/siteUrl';

/**
 * OAuth / 이메일 확인 콜백.
 * - intent=login (기본): 기존 short_users.email 매칭 시 연동 → 대시보드
 * - intent=signup: 기존 이메일이 있으면 연동하지 않고 로그인 안내 / 없으면 온보딩
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const intent = searchParams.get('intent') === 'signup' ? 'signup' : 'login';
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

  if (!email) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=no_email`);
  }

  const googleIdentity = authUser.identities?.find((i) => i.provider === 'google');
  if (googleIdentity) {
    const gVerified =
      googleIdentity.identity_data?.email_verified === true ||
      googleIdentity.identity_data?.email_verified === 'true';
    if (!gVerified && !authUser.email_confirmed_at) {
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/login?error=email_unverified`);
    }
  } else if (!authUser.email_confirmed_at) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=email_unverified`);
  }

  const admin = getSupabaseAdmin();

  // 이미 auth_user_id로 연결됨
  const { data: byAuth } = await admin
    .from('short_users')
    .select('id, username, email, auth_user_id')
    .eq('auth_user_id', authUser.id)
    .maybeSingle();

  if (byAuth) {
    if (intent === 'signup') {
      // 신규 가입 의도인데 이미 연동된 계정 → 대시보드로 (이미 회원)
      await admin
        .from('short_users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', byAuth.id);
      return NextResponse.redirect(new URL(next, origin));
    }
    await admin
      .from('short_users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', byAuth.id);
    return NextResponse.redirect(new URL(next, origin));
  }

  const { data: byEmail } = await admin
    .from('short_users')
    .select('id, username, email, auth_user_id')
    .eq('email', email)
    .maybeSingle();

  if (byEmail) {
    // 회원가입(구글)으로 왔는데 이미 같은 이메일의 레거시/기존 계정 → 자동 편입하지 않음
    if (intent === 'signup') {
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/login?error=already_registered`);
    }

    if (byEmail.auth_user_id && byEmail.auth_user_id !== authUser.id) {
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

  // 매칭되는 short_users 없음 → 본인코드(온보딩) 설정
  return NextResponse.redirect(new URL('/onboarding', origin));
}
