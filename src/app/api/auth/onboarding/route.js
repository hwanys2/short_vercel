import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { resolveAppUser } from '@/lib/session';
import { validateUsername, normalizeEmail } from '@/lib/authBridge';

export async function POST(request) {
  try {
    const sessionUser = await resolveAppUser(request);

    if (!sessionUser || !sessionUser.authUserId) {
      return NextResponse.json(
        { success: false, message: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    if (!sessionUser.needsOnboarding && sessionUser.id) {
      return NextResponse.json({
        success: true,
        alreadyComplete: true,
        user: {
          id: sessionUser.id,
          username: sessionUser.username,
          email: sessionUser.email,
        },
      });
    }

    const body = await request.json();
    const usernameCheck = validateUsername(body.username);
    if (!usernameCheck.ok) {
      return NextResponse.json(
        { success: false, message: usernameCheck.message },
        { status: 400 }
      );
    }

    const cleanUsername = usernameCheck.username;
    const email = normalizeEmail(sessionUser.email);
    if (!email) {
      return NextResponse.json(
        { success: false, message: '이메일 정보를 확인할 수 없습니다.' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    const { data: existingUsername } = await admin
      .from('short_users')
      .select('id')
      .eq('username', cleanUsername)
      .maybeSingle();

    if (existingUsername) {
      return NextResponse.json(
        { success: false, message: '이미 사용 중인 닉네임입니다.' },
        { status: 409 }
      );
    }

    const { data: existingEmail } = await admin
      .from('short_users')
      .select('id, auth_user_id')
      .eq('email', email)
      .maybeSingle();

    if (existingEmail) {
      return NextResponse.json(
        {
          success: false,
          message:
            '이미 등록된 이메일입니다. 기존 계정으로 로그인한 뒤 구글을 연동해주세요.',
        },
        { status: 409 }
      );
    }

    const { data: newUser, error } = await admin
      .from('short_users')
      .insert({
        username: cleanUsername,
        email,
        password: null,
        token_version: 1,
        auth_user_id: sessionUser.authUserId,
        last_login: new Date().toISOString(),
      })
      .select('id, username, email')
      .single();

    if (error) {
      console.error('Onboarding insert error:', error);
      if (error.code === '23505') {
        return NextResponse.json(
          { success: false, message: '이미 사용 중인 닉네임 또는 이메일입니다.' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { success: false, message: '닉네임 설정 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    // Auth user_metadata에 username 저장 (선택)
    try {
      await admin.auth.admin.updateUserById(sessionUser.authUserId, {
        user_metadata: { username: cleanUsername },
      });
    } catch (_) {
      /* ignore */
    }

    return NextResponse.json({
      success: true,
      user: newUser,
    });
  } catch (error) {
    console.error('Onboarding error:', error);
    return NextResponse.json(
      { success: false, message: '닉네임 설정 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
