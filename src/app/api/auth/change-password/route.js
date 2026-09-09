import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  getUserFromRequest,
  verifyPassword,
  hashPassword,
} from '@/lib/auth';

export async function POST(request) {
  try {
    const user = getUserFromRequest(request);
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

    const supabase = getSupabaseAdmin();
    const { data: row, error } = await supabase
      .from('short_users')
      .select('id, password')
      .eq('id', user.id)
      .maybeSingle();

    if (error) throw error;
    if (!row) {
      return NextResponse.json(
        { success: false, message: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const isValid = await verifyPassword(currentPassword, row.password);
    if (!isValid) {
      return NextResponse.json(
        { success: false, message: '현재 비밀번호가 일치하지 않습니다.' },
        { status: 401 }
      );
    }

    const hashed = await hashPassword(newPassword);
    const { error: updateError } = await supabase
      .from('short_users')
      .update({ password: hashed, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      message: '비밀번호가 변경되었습니다.',
    });
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json(
      { success: false, message: '비밀번호 변경 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
