import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  requireAppUser,
} from '@/lib/session';
import {
  verifyPassword,
  hashPassword,
  createToken,
  setAuthCookie,
} from '@/lib/auth';

export async function POST(request) {
  try {
    const user = await requireAppUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, message: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const currentPassword =
      typeof body.current_password === 'string' ? body.current_password : '';
    const newPassword =
      typeof body.new_password === 'string' ? body.new_password : '';
    const newPasswordConfirm =
      typeof body.new_password_confirm === 'string' ? body.new_password_confirm : '';

    if (!currentPassword || !newPassword || !newPasswordConfirm) {
      return NextResponse.json(
        { success: false, message: '모든 필드를 입력해주세요.' },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { success: false, message: '새 비밀번호는 최소 8자 이상이어야 합니다.' },
        { status: 400 }
      );
    }

    if (newPassword !== newPasswordConfirm) {
      return NextResponse.json(
        { success: false, message: '새 비밀번호 확인이 일치하지 않습니다.' },
        { status: 400 }
      );
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        { success: false, message: '새 비밀번호는 현재 비밀번호와 달라야 합니다.' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();
    const { data: row, error } = await admin
      .from('short_users')
      .select('id, username, email, password, token_version, auth_user_id')
      .eq('id', user.id)
      .maybeSingle();

    if (error) throw error;
    if (!row) {
      return NextResponse.json(
        { success: false, message: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 구글 전용(비밀번호 없음)이면 Auth 세션에서 updateUser 로만 설정 가능하도록
    if (row.password) {
      const isValid = await verifyPassword(currentPassword, row.password);
      if (!isValid) {
        // Auth에만 비밀번호가 있는 경우도 허용: signIn 검증
        const supabase = await createSupabaseServerClient();
        const { error: signErr } = await supabase.auth.signInWithPassword({
          email: row.email,
          password: currentPassword,
        });
        if (signErr) {
          return NextResponse.json(
            { success: false, message: '현재 비밀번호가 일치하지 않습니다.' },
            { status: 401 }
          );
        }
      }
    } else {
      const supabase = await createSupabaseServerClient();
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: row.email,
        password: currentPassword,
      });
      if (signErr) {
        return NextResponse.json(
          {
            success: false,
            message:
              '현재 비밀번호가 없거나 일치하지 않습니다. 구글 로그인 계정은 비밀번호를 먼저 설정해주세요.',
          },
          { status: 401 }
        );
      }
    }

    const hashed = await hashPassword(newPassword);
    const newTv = (row.token_version || 1) + 1;

    const { error: updateError } = await admin
      .from('short_users')
      .update({
        password: hashed,
        token_version: newTv,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateError) throw updateError;

    // Auth 비밀번호 동기화
    if (row.auth_user_id) {
      const { error: authPwError } = await admin.auth.admin.updateUserById(
        row.auth_user_id,
        { password: newPassword }
      );
      if (authPwError) {
        console.error('Auth password sync error:', authPwError);
      }
    }

    // 현재 기기: Auth 재로그인 + 레거시 JWT 재발급
    try {
      const supabase = await createSupabaseServerClient();
      await supabase.auth.signInWithPassword({
        email: row.email,
        password: newPassword,
      });
    } catch (reSignErr) {
      console.error('Re-sign after password change:', reSignErr);
    }

    const newToken = createToken({
      id: user.id,
      username: row.username || user.username,
      email: row.email || user.email,
      token_version: newTv,
    });
    await setAuthCookie(newToken);

    return NextResponse.json({
      success: true,
      message: '비밀번호가 변경되었습니다. (다른 모든 기기에서 자동 로그아웃되었습니다)',
    });
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json(
      { success: false, message: '비밀번호 변경 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
