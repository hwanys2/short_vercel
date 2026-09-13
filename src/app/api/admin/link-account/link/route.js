import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { normalizeEmail } from '@/lib/authBridge';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/link-account/link
 * Body:
 * {
 *   authUserId: string,        // 대상 구글 계정 Auth UUID
 *   googleEmail: string,       // 대상 구글 이메일
 *   legacyUserId: number,      // 연동할 기존 계정 ID
 *   actionType?: 'auto' | 'direct_link' | 'merge_codes' | 'replace_profile'
 * }
 */
export async function POST(request) {
  const gate = await requireAdmin(request);
  if (gate.response) return gate.response;

  const { admin } = gate;

  try {
    const body = await request.json();
    const { authUserId, googleEmail: rawGoogleEmail, legacyUserId: rawLegacyUserId, actionType = 'auto' } = body || {};

    if (!authUserId || typeof authUserId !== 'string') {
      return NextResponse.json(
        { success: false, error: '구글 계정 식별자(Auth ID)가 필요합니다.' },
        { status: 400 }
      );
    }

    const legacyUserId = Number(rawLegacyUserId);
    if (!legacyUserId || !Number.isInteger(legacyUserId)) {
      return NextResponse.json(
        { success: false, error: '연동할 기존 계정 ID가 유효하지 않습니다.' },
        { status: 400 }
      );
    }

    // 1. 대상 Auth 계정 실존 여부 및 이메일 확인
    const { data: authData, error: authUserErr } = await admin.auth.admin.getUserById(authUserId);
    if (authUserErr || !authData?.user) {
      return NextResponse.json(
        { success: false, error: '구글 Auth 사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const googleEmail = normalizeEmail(authData.user.email || rawGoogleEmail);
    if (!googleEmail) {
      return NextResponse.json(
        { success: false, error: '구글 계정 이메일을 확인할 수 없습니다.' },
        { status: 400 }
      );
    }

    // 2. 연동할 기존 계정 정보 조회
    const { data: legacyUser, error: legacyUserErr } = await admin
      .from('short_users')
      .select(`
        id,
        username,
        email,
        auth_user_id,
        max_codes,
        token_version,
        short_user_codes(id, username, is_primary)
      `)
      .eq('id', legacyUserId)
      .maybeSingle();

    if (legacyUserErr) throw legacyUserErr;
    if (!legacyUser) {
      return NextResponse.json(
        { success: false, error: '연동할 기존 사용자 계정을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 3. 대상 구글 계정(authUserId)에 이미 연결된 short_users 조회
    const { data: existingGoogleUser, error: googleUserErr } = await admin
      .from('short_users')
      .select(`
        id,
        username,
        email,
        auth_user_id,
        max_codes,
        token_version,
        short_user_codes(id, username, is_primary)
      `)
      .eq('auth_user_id', authUserId)
      .maybeSingle();

    if (googleUserErr) throw googleUserErr;

    // 이미 완전히 동일한 계정인 경우
    if (existingGoogleUser && existingGoogleUser.id === legacyUserId) {
      return NextResponse.json({
        success: true,
        message: `이미 구글 계정(${googleEmail})에 연동되어 있는 계정입니다.`,
        alreadyLinked: true,
      });
    }

    // =========================================================================
    // 시나리오 1: 구글 계정에 아직 short_users 프로필이 없는 경우 (온보딩 전)
    // =========================================================================
    if (!existingGoogleUser) {
      // 기존 계정의 email을 googleEmail로 변경 가능한지 확인 (이메일 중복 체크)
      const { data: emailConflict } = await admin
        .from('short_users')
        .select('id')
        .eq('email', googleEmail)
        .neq('id', legacyUserId)
        .maybeSingle();

      if (emailConflict) {
        return NextResponse.json(
          {
            success: false,
            error: `이메일 '${googleEmail}'을 이미 다른 회원(ID: ${emailConflict.id})이 사용 중입니다. 이메일 중복을 먼저 해소해주세요.`,
          },
          { status: 409 }
        );
      }

      // 기존 계정의 auth_user_id와 email 업데이트
      const { error: updateErr } = await admin
        .from('short_users')
        .update({
          auth_user_id: authUserId,
          email: googleEmail,
          updated_at: new Date().toISOString(),
          last_login: new Date().toISOString(),
        })
        .eq('id', legacyUserId);

      if (updateErr) throw updateErr;

      // Supabase Auth 메타데이터에도 닉네임 동기화
      try {
        await admin.auth.admin.updateUserById(authUserId, {
          user_metadata: { username: legacyUser.username },
        });
      } catch (_) {
        /* ignore */
      }

      return NextResponse.json({
        success: true,
        action: 'direct_link',
        message: `구글 계정(${googleEmail})에 기존 계정 '${legacyUser.username}'이 성공적으로 연동되었습니다! 이제 구글로 로그인하면 기존 코드와 단축 링크를 그대로 이용할 수 있습니다.`,
      });
    }

    // =========================================================================
    // 시나리오 2: 구글 계정에 이미 short_users 프로필이 생성되어 있는 경우
    // =========================================================================
    const googleUser = existingGoogleUser;

    // actionType에 따른 분기 (auto일 경우, 구글 계정 링크 수가 0이면 병합 우선 추천)
    const effectiveAction = actionType === 'auto' ? 'merge_codes' : actionType;

    if (effectiveAction === 'replace_profile') {
      // 구글 계정의 기존 프로필을 해제하고 기존 계정으로 대체
      // 1) googleUser의 auth_user_id 해제 및 email 임시 변경
      const tempEmail = `archived_${googleUser.id}_${Date.now()}@temp.short.kr`;
      await admin
        .from('short_users')
        .update({
          auth_user_id: null,
          email: tempEmail,
          updated_at: new Date().toISOString(),
        })
        .eq('id', googleUser.id);

      // 2) legacyUser를 googleEmail 및 authUserId로 업데이트
      const { error: repErr } = await admin
        .from('short_users')
        .update({
          auth_user_id: authUserId,
          email: googleEmail,
          updated_at: new Date().toISOString(),
          last_login: new Date().toISOString(),
        })
        .eq('id', legacyUserId);

      if (repErr) throw repErr;

      return NextResponse.json({
        success: true,
        action: 'replace_profile',
        message: `구글 계정의 기존 임시 프로필을 정리하고, 기존 계정 '${legacyUser.username}'과 구글 계정(${googleEmail})을 직접 연결했습니다.`,
      });
    }

    // 기본 모드: merge_codes (코드 및 링크 병합)
    const legacyCodes = legacyUser.short_user_codes || [];
    const googleCodes = googleUser.short_user_codes || [];

    // 1. 필요한 슬롯 수 계산 및 상향
    const totalCodesNeeded = googleCodes.length + legacyCodes.length;
    const currentGoogleMax = googleUser.max_codes || 2;
    if (totalCodesNeeded > currentGoogleMax) {
      await admin
        .from('short_users')
        .update({
          max_codes: totalCodesNeeded,
          updated_at: new Date().toISOString(),
        })
        .eq('id', googleUser.id);
    }

    // 2. legacyUser의 short_user_codes 소유권을 googleUser.id로 이전
    if (legacyCodes.length > 0) {
      // 이미 googleUser에게 primary 코드가 있으므로, 이전되는 코드는 is_primary = FALSE로 설정
      const { error: codeMoveErr } = await admin
        .from('short_user_codes')
        .update({
          user_id: googleUser.id,
          is_primary: false,
        })
        .eq('user_id', legacyUserId);

      if (codeMoveErr) throw codeMoveErr;
    }

    // 3. legacyUser가 생성한 모든 short_urls 소유권 이전
    const { error: urlMoveErr } = await admin
      .from('short_urls')
      .update({
        user_id: googleUser.id,
      })
      .eq('user_id', legacyUserId);

    if (urlMoveErr) throw urlMoveErr;

    const { error: createdByMoveErr } = await admin
      .from('short_urls')
      .update({
        created_by_user_id: googleUser.id,
      })
      .eq('created_by_user_id', legacyUserId);

    if (createdByMoveErr) throw createdByMoveErr;

    // 4. 비워진 legacyUser 정리 (이메일 및 보관 처리)
    const archivedEmail = `archived_${legacyUserId}_${legacyUser.email}`;
    await admin
      .from('short_users')
      .update({
        auth_user_id: null,
        email: archivedEmail,
        updated_at: new Date().toISOString(),
      })
      .eq('id', legacyUserId);

    return NextResponse.json({
      success: true,
      action: 'merge_codes',
      message: `기존 계정 '${legacyUser.username}'의 본인 코드 ${legacyCodes.length}개와 모든 단축 링크가 구글 계정(${googleEmail})으로 성공적으로 병합되었습니다! (슬롯 자동 상향: ${Math.max(totalCodesNeeded, currentGoogleMax)}개)`,
    });
  } catch (error) {
    console.error('Admin link-account link error:', error);
    return NextResponse.json(
      { success: false, error: '계정 연동 처리 중 오류가 발생했습니다: ' + error.message },
      { status: 500 }
    );
  }
}
