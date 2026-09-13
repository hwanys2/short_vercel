import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { resolveAppUser } from '@/lib/session';
import { checkRateLimit } from '@/lib/rateLimit';
import { usernamesEqual, validateUsername } from '@/lib/authBridge';

function clientIp(request) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

export async function GET(request) {
  try {
    const sessionUser = await resolveAppUser(request);
    if (!sessionUser) {
      return NextResponse.json(
        { success: false, available: false, message: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const rateCheck = checkRateLimit(
      `check-username:${sessionUser.id || sessionUser.authUserId || clientIp(request)}`,
      30,
      60
    );
    if (!rateCheck.success) {
      return NextResponse.json(
        {
          success: false,
          available: false,
          message: `확인이 너무 빠릅니다. ${rateCheck.resetInSeconds}초 후 다시 시도해주세요.`,
        },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(request.url);
    const usernameCheck = validateUsername(searchParams.get('username'));
    if (!usernameCheck.ok) {
      return NextResponse.json(
        { success: true, available: false, message: usernameCheck.message },
        { status: 200 }
      );
    }

    const cleanUsername = usernameCheck.username;
    const excludeCodeId = searchParams.get('code_id');

    // 현재 편집 중인 코드와 동일하면 current
    if (sessionUser.codes?.length) {
      const ownMatch = sessionUser.codes.find((c) => usernamesEqual(c.username, cleanUsername));
      if (ownMatch) {
        if (excludeCodeId && Number(ownMatch.id) === Number(excludeCodeId)) {
          return NextResponse.json({
            success: true,
            available: false,
            current: true,
            message: '현재 사용 중인 본인 코드입니다.',
          });
        }
        if (!excludeCodeId && ownMatch.is_primary) {
          return NextResponse.json({
            success: true,
            available: false,
            current: true,
            message: '현재 사용 중인 본인 코드입니다.',
          });
        }
        return NextResponse.json({
          success: true,
          available: false,
          message: '이미 내가 사용 중인 본인 코드입니다.',
        });
      }
    } else if (sessionUser.username && usernamesEqual(sessionUser.username, cleanUsername)) {
      return NextResponse.json({
        success: true,
        available: false,
        current: true,
        message: '현재 사용 중인 본인 코드입니다.',
      });
    }

    const admin = getSupabaseAdmin();
    const { data: existing, error } = await admin
      .from('short_user_codes')
      .select('id, user_id')
      .eq('username', cleanUsername)
      .maybeSingle();

    if (error) throw error;

    if (existing) {
      return NextResponse.json({
        success: true,
        available: false,
        message: '이미 다른 사람이 사용 중인 본인 코드입니다.',
      });
    }

    return NextResponse.json({
      success: true,
      available: true,
      username: cleanUsername,
    });
  } catch (error) {
    console.error('Check username error:', error);
    return NextResponse.json(
      { success: false, available: false, message: '확인 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
