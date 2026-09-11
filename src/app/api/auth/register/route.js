import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { hashPassword } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';
import { verifyTurnstileToken } from '@/lib/turnstile';
import { normalizeEmail, validateUsername } from '@/lib/authBridge';
import { getSiteOrigin } from '@/lib/siteUrl';

export async function POST(request) {
  try {
    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    const rateCheck = checkRateLimit(`register:ip:${clientIp}`, 3, 60);
    if (!rateCheck.success) {
      return NextResponse.json(
        {
          success: false,
          message: `회원가입 요청이 너무 많습니다. ${rateCheck.resetInSeconds}초 후 다시 시도해주세요.`,
        },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { username, email, password, password_confirm, turnstileToken } = body;

    if (!username || !email || !password || !password_confirm) {
      return NextResponse.json(
        { success: false, message: '모든 필드를 입력해주세요.' },
        { status: 400 }
      );
    }

    const usernameCheck = validateUsername(username);
    if (!usernameCheck.ok) {
      return NextResponse.json(
        { success: false, message: usernameCheck.message },
        { status: 400 }
      );
    }
    const cleanUsername = usernameCheck.username;
    const cleanEmail = normalizeEmail(email);

    const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail);
    if (!isEmailValid) {
      return NextResponse.json(
        { success: false, message: '올바른 이메일 형식을 입력해주세요.' },
        { status: 400 }
      );
    }

    if (password !== password_confirm) {
      return NextResponse.json(
        { success: false, message: '비밀번호가 일치하지 않습니다.' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { success: false, message: '비밀번호는 최소 8자 이상이어야 합니다.' },
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

    const admin = getSupabaseAdmin();

    const [{ data: byUsername }, { data: byEmail }] = await Promise.all([
      admin.from('short_users').select('id, username').eq('username', cleanUsername).maybeSingle(),
      admin.from('short_users').select('id, email').eq('email', cleanEmail).maybeSingle(),
    ]);

    if (byUsername) {
      return NextResponse.json(
        { success: false, message: '이미 사용 중인 닉네임입니다.' },
        { status: 409 }
      );
    }
    if (byEmail) {
      return NextResponse.json(
        { success: false, message: '이미 사용 중인 이메일입니다.' },
        { status: 409 }
      );
    }

    const origin = getSiteOrigin();
    const supabase = await createSupabaseServerClient();

    // Supabase Auth 가입 (이메일 인증 필요 시 세션 없음)
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
        data: { username: cleanUsername },
      },
    });

    if (signUpError) {
      console.error('Register signUp error:', signUpError);
      const msg = signUpError.message || '';
      if (/already|registered|exists/i.test(msg)) {
        return NextResponse.json(
          { success: false, message: '이미 사용 중인 이메일입니다.' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { success: false, message: '회원가입 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    const authUserId = signUpData?.user?.id;
    if (!authUserId) {
      return NextResponse.json(
        { success: false, message: '회원가입 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    // username 선점: 인증 전에도 short_users 행 생성 (로그인은 Auth 세션만 허용)
    const hashedPassword = await hashPassword(password);
    const { data: newUser, error: insertError } = await admin
      .from('short_users')
      .insert({
        username: cleanUsername,
        email: cleanEmail,
        password: hashedPassword,
        token_version: 1,
        auth_user_id: authUserId,
      })
      .select('id, username, email, token_version')
      .single();

    if (insertError) {
      console.error('Register insert error:', insertError);
      // Auth 유저는 남기고 short_users 실패 — 정리 시도
      try {
        await admin.auth.admin.deleteUser(authUserId);
      } catch (_) {
        /* ignore */
      }
      if (insertError.code === '23505') {
        return NextResponse.json(
          { success: false, message: '이미 사용 중인 닉네임 또는 이메일입니다.' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { success: false, message: '회원가입 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    // 이메일 확인이 켜져 있으면 세션이 없을 수 있음 → 확인 안내
    const needsEmailConfirmation = !signUpData.session;

    if (signUpData.session) {
      // Confirm email 이 꺼진 환경: 즉시 로그인된 상태
      return NextResponse.json({
        success: true,
        needsEmailConfirmation: false,
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
        },
      });
    }

    return NextResponse.json({
      success: true,
      needsEmailConfirmation: true,
      message:
        '가입이 접수되었습니다. 이메일로 보낸 인증 링크를 클릭한 뒤 로그인해주세요.',
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json(
      { success: false, message: '회원가입 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
