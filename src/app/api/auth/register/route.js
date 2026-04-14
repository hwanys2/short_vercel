import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hashPassword, createToken, setAuthCookie } from '@/lib/auth';

export async function POST(request) {
  try {
    const body = await request.json();
    const { username, email, password, password_confirm } = body;

    // 유효성 검사
    if (!username || !email || !password || !password_confirm) {
      return NextResponse.json(
        { success: false, message: '모든 필드를 입력해주세요.' },
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

    if (!/^[가-힣a-zA-Z0-9_-]+$/.test(username)) {
      return NextResponse.json(
        { success: false, message: '닉네임은 한글, 영문, 숫자, 밑줄(_), 하이픈(-)만 사용할 수 있습니다.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // 중복 확인
    const { data: existingUser } = await supabase
      .from('short_users')
      .select('id, username, email')
      .or(`username.eq.${username},email.eq.${email}`)
      .limit(1)
      .maybeSingle();

    if (existingUser) {
      if (existingUser.username === username) {
        return NextResponse.json(
          { success: false, message: '이미 사용 중인 닉네임입니다.' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { success: false, message: '이미 사용 중인 이메일입니다.' },
        { status: 409 }
      );
    }

    // 비밀번호 해시 생성
    const hashedPassword = await hashPassword(password);

    // 사용자 생성
    const { data: newUser, error } = await supabase
      .from('short_users')
      .insert({
        username,
        email,
        password: hashedPassword,
      })
      .select('id, username, email')
      .single();

    if (error) {
      console.error('Register error:', error);
      return NextResponse.json(
        { success: false, message: '회원가입 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    // 자동 로그인
    const token = createToken(newUser);
    await setAuthCookie(token);

    return NextResponse.json({
      success: true,
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
