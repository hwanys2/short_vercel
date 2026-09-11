import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { verifyPassword, createToken, setAuthCookie } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';
import { verifyTurnstileToken } from '@/lib/turnstile';
import {
  normalizeEmail,
  findAuthUserByEmail,
  linkShortUserToAuth,
} from '@/lib/authBridge';

/**
 * bcrypt 검증 후 Auth 계정 생성/동기화 → signInWithPassword로 SSR 쿠키 발급.
 */
async function ensureAuthUserAndSignIn(admin, supabase, shortUser, plainPassword) {
  let authUserId = shortUser.auth_user_id || null;

  if (!authUserId) {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: shortUser.email,
      password: plainPassword,
      email_confirm: true,
      user_metadata: { username: shortUser.username },
    });

    if (createError) {
      // 이미 Auth에 존재 (구글 선행 가입 등) → 비밀번호 동기화 후 링크
      const existing = await findAuthUserByEmail(admin, shortUser.email);
      if (!existing?.id) {
        throw createError;
      }
      authUserId = existing.id;
      const { error: pwError } = await admin.auth.admin.updateUserById(authUserId, {
        password: plainPassword,
        email_confirm: true,
      });
      if (pwError) throw pwError;
    } else {
      authUserId = created.user.id;
    }

    const linked = await linkShortUserToAuth(admin, shortUser.id, authUserId);
    if (!linked) {
      // 동시성: 다른 요청이 이미 링크했을 수 있음
      const { data: refreshed } = await admin
        .from('short_users')
        .select('auth_user_id')
        .eq('id', shortUser.id)
        .maybeSingle();
      if (refreshed?.auth_user_id && refreshed.auth_user_id !== authUserId) {
        // 다른 UUID에 이미 연결됨 — 기존 매핑을 존중하고 그 계정 비밀번호만 맞춤
        authUserId = refreshed.auth_user_id;
        await admin.auth.admin.updateUserById(authUserId, {
          password: plainPassword,
          email_confirm: true,
        });
      }
    }
  } else {
    // 이미 매핑됨 — 입력한 비밀번호로 Auth 쪽도 맞춤 (레거시 변경 반영)
    await admin.auth.admin.updateUserById(authUserId, {
      password: plainPassword,
      email_confirm: true,
    });
  }

  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: shortUser.email,
    password: plainPassword,
  });

  if (signInError) {
    throw signInError;
  }

  return { authUserId, session: signInData.session };
}

export async function POST(request) {
  try {
    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    const rateCheck = checkRateLimit(`login:ip:${clientIp}`, 7, 60);
    if (!rateCheck.success) {
      return NextResponse.json(
        {
          success: false,
          message: `로그인 시도가 너무 많습니다. ${rateCheck.resetInSeconds}초 후 다시 시도해주세요.`,
        },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { usernameOrEmail, password, turnstileToken } = body;

    if (!usernameOrEmail || !password) {
      return NextResponse.json(
        { success: false, message: '모든 필드를 입력해주세요.' },
        { status: 400 }
      );
    }

    const turnstileCheck = await verifyTurnstileToken(turnstileToken, clientIp);
    if (!turnstileCheck.success) {
      return NextResponse.json(
        { success: false, message: turnstileCheck.error },
        { status: 400 }
      );
    }

    const trimmedInput = String(usernameOrEmail).trim();
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedInput);

    const admin = getSupabaseAdmin();

    let userQuery = admin
      .from('short_users')
      .select('id, username, email, password, token_version, auth_user_id');

    if (isEmail) {
      userQuery = userQuery.eq('email', normalizeEmail(trimmedInput));
    } else {
      userQuery = userQuery.eq('username', trimmedInput);
    }

    const { data: user, error: userError } = await userQuery.maybeSingle();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, message: '사용자를 찾을 수 없습니다.' },
        { status: 401 }
      );
    }

    // 비밀번호가 없는 계정(구글 전용)은 비밀번호 로그인 불가
    if (!user.password) {
      return NextResponse.json(
        {
          success: false,
          message: '이 계정은 구글 로그인으로만 이용할 수 있습니다.',
        },
        { status: 401 }
      );
    }

    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return NextResponse.json(
        { success: false, message: '비밀번호가 일치하지 않습니다.' },
        { status: 401 }
      );
    }

    // Shadow Migration + Supabase 세션 발급
    const supabase = await createSupabaseServerClient();
    try {
      await ensureAuthUserAndSignIn(admin, supabase, user, password);
    } catch (migrateError) {
      console.error('Shadow migration / sign-in error:', migrateError);
      // Auth 이전 실패해도 레거시 JWT로 로그인 유지 (무중단)
    }

    await admin
      .from('short_users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    // 전환 기간: 레거시 JWT도 함께 발급
    const token = createToken(user);
    await setAuthCookie(token);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, message: '로그인 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
