import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAppUser } from '@/lib/session';
import { checkRateLimit } from '@/lib/rateLimit';
import { validateUsername } from '@/lib/authBridge';
import { loadUserCodes, MAX_CODES_DEFAULT } from '@/lib/userCodes';
import { serializeUsernameChangeCooldown } from '@/lib/usernameChange';

function clientIp(request) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

export async function GET(request) {
  try {
    const user = await requireAppUser(request);
    if (!user) {
      return NextResponse.json({ success: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const codes = await loadUserCodes(admin, user.id);
    const maxCodes = user.max_codes ?? MAX_CODES_DEFAULT;

    const withCounts = [];
    for (const code of codes) {
      const { count, error } = await admin
        .from('short_urls')
        .select('id', { count: 'exact', head: true })
        .eq('user_code_id', code.id);
      if (error) throw error;
      const cooldown = serializeUsernameChangeCooldown(code.username_changed_at);
      withCounts.push({
        id: code.id,
        username: code.username,
        is_primary: code.is_primary,
        created_at: code.created_at,
        url_count: typeof count === 'number' ? count : 0,
        ...cooldown,
      });
    }

    return NextResponse.json({
      success: true,
      codes: withCounts,
      max_codes: maxCodes,
      can_add_code: withCounts.length < maxCodes,
    });
  } catch (error) {
    console.error('List user codes error:', error);
    return NextResponse.json(
      { success: false, message: '본인 코드 목록을 불러오지 못했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const user = await requireAppUser(request);
    if (!user) {
      return NextResponse.json({ success: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    const rateCheck = checkRateLimit(`add-user-code:${user.id || clientIp(request)}`, 8, 15 * 60);
    if (!rateCheck.success) {
      return NextResponse.json(
        {
          success: false,
          message: `추가 시도가 너무 많습니다. ${rateCheck.resetInSeconds}초 후 다시 시도해주세요.`,
        },
        { status: 429 }
      );
    }

    const body = await request.json();
    const usernameCheck = validateUsername(body.username);
    if (!usernameCheck.ok) {
      return NextResponse.json({ success: false, message: usernameCheck.message }, { status: 400 });
    }

    const confirmCheck = validateUsername(body.username_confirm);
    if (!confirmCheck.ok || confirmCheck.username !== usernameCheck.username) {
      return NextResponse.json(
        { success: false, message: '본인 코드 확인이 일치하지 않습니다.' },
        { status: 400 }
      );
    }

    const cleanUsername = usernameCheck.username;
    const admin = getSupabaseAdmin();

    const { data: taken } = await admin
      .from('short_user_codes')
      .select('id')
      .eq('username', cleanUsername)
      .maybeSingle();

    if (taken) {
      return NextResponse.json(
        { success: false, message: '이미 다른 사람이 사용 중인 본인 코드입니다.' },
        { status: 409 }
      );
    }

    // short_users.username 과의 충돌도 차단 (레거시/백필 불일치 대비)
    const { data: takenUser } = await admin
      .from('short_users')
      .select('id')
      .eq('username', cleanUsername)
      .neq('id', user.id)
      .maybeSingle();

    if (takenUser) {
      return NextResponse.json(
        { success: false, message: '이미 다른 사람이 사용 중인 본인 코드입니다.' },
        { status: 409 }
      );
    }

    const { data: row, error } = await admin.rpc('add_user_code', {
      p_user_id: user.id,
      p_username: cleanUsername,
    });

    if (error) {
      console.error('add_user_code rpc error:', error);
      if (error.code === '23505' || error.message?.includes('duplicate')) {
        return NextResponse.json(
          { success: false, message: '이미 다른 사람이 사용 중인 본인 코드입니다.' },
          { status: 409 }
        );
      }
      if (error.message?.includes('code limit reached') || error.code === 'P0001') {
        return NextResponse.json(
          {
            success: false,
            message: `본인 코드는 최대 ${user.max_codes ?? MAX_CODES_DEFAULT}개까지 가질 수 있습니다.`,
          },
          { status: 403 }
        );
      }
      return NextResponse.json(
        { success: false, message: '본인 코드 추가 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    const created = Array.isArray(row) ? row[0] : row;

    return NextResponse.json({
      success: true,
      message: '본인 코드가 추가되었습니다.',
      code: {
        id: Number(created.id),
        username: created.username,
        is_primary: Boolean(created.is_primary),
        created_at: created.created_at,
        url_count: 0,
      },
    });
  } catch (error) {
    console.error('Add user code error:', error);
    return NextResponse.json(
      { success: false, message: '본인 코드 추가 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
