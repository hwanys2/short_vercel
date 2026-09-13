import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAppUser } from '@/lib/session';
import { createToken, setAuthCookie } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';
import { usernamesEqual, validateUsername } from '@/lib/authBridge';
import {
  USERNAME_CHANGE_CONFIRM_PHRASE,
  serializeUsernameChangeCooldown,
} from '@/lib/usernameChange';
import { pickUserCode } from '@/lib/userCodes';

function clientIp(request) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

function isTruthyAck(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

async function loadCodeChangeContext(admin, user, codeIdParam) {
  const picked = pickUserCode(user, codeIdParam);
  if (!picked.ok) return { error: picked };

  const codeRow = picked.code;
  const { count, error: countError } = await admin
    .from('short_urls')
    .select('id', { count: 'exact', head: true })
    .eq('user_code_id', codeRow.id);

  if (countError) throw countError;

  // DB에서 최신 username_changed_at 재조회
  const { data: fresh, error } = await admin
    .from('short_user_codes')
    .select('id, username, is_primary, username_changed_at, user_id')
    .eq('id', codeRow.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw error;
  if (!fresh) {
    return { error: { ok: false, message: '본인 코드를 찾을 수 없습니다.', status: 404 } };
  }

  return {
    codeRow: {
      id: Number(fresh.id),
      username: fresh.username,
      is_primary: Boolean(fresh.is_primary),
      username_changed_at: fresh.username_changed_at,
    },
    urlCount: typeof count === 'number' ? count : 0,
    cooldown: serializeUsernameChangeCooldown(fresh.username_changed_at),
  };
}

export async function GET(request) {
  try {
    const user = await requireAppUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, message: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const admin = getSupabaseAdmin();
    const context = await loadCodeChangeContext(admin, user, searchParams.get('code_id'));
    if (context.error) {
      return NextResponse.json(
        { success: false, message: context.error.message },
        { status: context.error.status || 400 }
      );
    }

    return NextResponse.json({
      success: true,
      username: context.codeRow.username,
      code_id: context.codeRow.id,
      is_primary: context.codeRow.is_primary,
      url_count: context.urlCount,
      ...context.cooldown,
    });
  } catch (error) {
    console.error('Get username change status error:', error);
    return NextResponse.json(
      { success: false, message: '본인 코드 변경 정보를 불러오지 못했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const user = await requireAppUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, message: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const rateCheck = checkRateLimit(
      `change-username:${user.id || clientIp(request)}`,
      8,
      15 * 60
    );
    if (!rateCheck.success) {
      return NextResponse.json(
        {
          success: false,
          message: `변경 시도가 너무 많습니다. ${rateCheck.resetInSeconds}초 후 다시 시도해주세요.`,
        },
        { status: 429 }
      );
    }

    const body = await request.json();
    const usernameCheck = validateUsername(body.new_username);
    if (!usernameCheck.ok) {
      return NextResponse.json(
        { success: false, message: usernameCheck.message },
        { status: 400 }
      );
    }

    const confirmCheck = validateUsername(body.new_username_confirm);
    if (!confirmCheck.ok || confirmCheck.username !== usernameCheck.username) {
      return NextResponse.json(
        { success: false, message: '새 본인 코드 확인이 일치하지 않습니다.' },
        { status: 400 }
      );
    }

    const cleanUsername = usernameCheck.username;
    const typedCurrent = String(body.current_username || '').trim();
    const confirmPhrase = String(body.confirm_phrase || '').trim();

    if (!isTruthyAck(body.acknowledge_urls_change) || !isTruthyAck(body.acknowledge_old_released)) {
      return NextResponse.json(
        {
          success: false,
          message: '주의사항을 모두 확인해야 본인 코드를 변경할 수 있습니다.',
        },
        { status: 400 }
      );
    }

    if (confirmPhrase !== USERNAME_CHANGE_CONFIRM_PHRASE) {
      return NextResponse.json(
        {
          success: false,
          message: `확인 문구를 정확히 입력해주세요. (${USERNAME_CHANGE_CONFIRM_PHRASE})`,
        },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();
    const context = await loadCodeChangeContext(admin, user, body.code_id);
    if (context.error) {
      return NextResponse.json(
        { success: false, message: context.error.message },
        { status: context.error.status || 400 }
      );
    }

    const { codeRow, cooldown } = context;
    if (!usernamesEqual(typedCurrent, codeRow.username)) {
      return NextResponse.json(
        { success: false, message: '현재 본인 코드를 정확히 입력해주세요.' },
        { status: 400 }
      );
    }

    if (usernamesEqual(cleanUsername, codeRow.username)) {
      return NextResponse.json(
        { success: false, message: '현재와 동일한 본인 코드입니다.' },
        { status: 400 }
      );
    }

    if (!cooldown.can_change) {
      return NextResponse.json(
        {
          success: false,
          message: `본인 코드는 30일에 한 번만 변경할 수 있습니다. 약 ${cooldown.remaining_label} 후에 다시 시도해주세요.`,
          ...cooldown,
        },
        { status: 429 }
      );
    }

    const { data: taken, error: takenError } = await admin
      .from('short_user_codes')
      .select('id')
      .eq('username', cleanUsername)
      .neq('id', codeRow.id)
      .maybeSingle();

    if (takenError) throw takenError;
    if (taken) {
      return NextResponse.json(
        { success: false, message: '이미 다른 사람이 사용 중인 본인 코드입니다.' },
        { status: 409 }
      );
    }

    const changedAt = new Date().toISOString();

    if (codeRow.is_primary) {
      // primary: short_users 업데이트 → 트리거가 short_user_codes 동기화
      const { data: userRow, error: userFetchErr } = await admin
        .from('short_users')
        .select('id, username, email, token_version, auth_user_id')
        .eq('id', user.id)
        .maybeSingle();

      if (userFetchErr) throw userFetchErr;
      if (!userRow) {
        return NextResponse.json(
          { success: false, message: '사용자를 찾을 수 없습니다.' },
          { status: 404 }
        );
      }

      const newTv = (userRow.token_version || 1) + 1;

      const { data: updated, error: updateError } = await admin
        .from('short_users')
        .update({
          username: cleanUsername,
          username_changed_at: changedAt,
          token_version: newTv,
          updated_at: changedAt,
        })
        .eq('id', user.id)
        .select('id, username, email, username_changed_at')
        .single();

      if (updateError) {
        if (updateError.code === '23505') {
          return NextResponse.json(
            { success: false, message: '이미 다른 사람이 사용 중인 본인 코드입니다.' },
            { status: 409 }
          );
        }
        throw updateError;
      }

      if (userRow.auth_user_id) {
        try {
          await admin.auth.admin.updateUserById(userRow.auth_user_id, {
            user_metadata: { username: cleanUsername },
          });
        } catch (metaErr) {
          console.error('Auth username metadata sync error:', metaErr);
        }
      }

      const newToken = createToken({
        id: user.id,
        username: updated.username,
        email: userRow.email || user.email,
        token_version: newTv,
      });
      await setAuthCookie(newToken);

      return NextResponse.json({
        success: true,
        message:
          '본인 코드가 변경되었습니다. 기존 단축 주소는 즉시 무효가 되며, 이전 코드는 다른 사람이 사용할 수 있습니다.',
        user: {
          id: updated.id,
          username: updated.username,
          email: updated.email,
        },
        code: {
          id: codeRow.id,
          username: updated.username,
          is_primary: true,
        },
        previous_username: codeRow.username,
        ...serializeUsernameChangeCooldown(updated.username_changed_at),
      });
    }

    // 추가 코드: short_user_codes만 갱신
    const { data: updatedCode, error: codeUpdateError } = await admin
      .from('short_user_codes')
      .update({
        username: cleanUsername,
        username_changed_at: changedAt,
      })
      .eq('id', codeRow.id)
      .eq('user_id', user.id)
      .eq('is_primary', false)
      .select('id, username, is_primary, username_changed_at')
      .single();

    if (codeUpdateError) {
      if (codeUpdateError.code === '23505') {
        return NextResponse.json(
          { success: false, message: '이미 다른 사람이 사용 중인 본인 코드입니다.' },
          { status: 409 }
        );
      }
      throw codeUpdateError;
    }

    return NextResponse.json({
      success: true,
      message:
        '본인 코드가 변경되었습니다. 기존 단축 주소는 즉시 무효가 되며, 이전 코드는 다른 사람이 사용할 수 있습니다.',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
      code: {
        id: Number(updatedCode.id),
        username: updatedCode.username,
        is_primary: false,
      },
      previous_username: codeRow.username,
      ...serializeUsernameChangeCooldown(updatedCode.username_changed_at),
    });
  } catch (error) {
    console.error('Change username error:', error);
    return NextResponse.json(
      { success: false, message: '본인 코드 변경 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
