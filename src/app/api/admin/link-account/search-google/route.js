import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { normalizeEmail, findAuthUserByEmail } from '@/lib/authBridge';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/link-account/search-google
 * - q: 구글 이메일 검색어 (예: abcd@gmail.com 또는 abcd)
 */
export async function GET(request) {
  const gate = await requireAdmin(request);
  if (gate.response) return gate.response;

  const { admin } = gate;
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  const cleanQ = normalizeEmail(q);

  try {
    // 1. Supabase Auth 사용자 목록 조회
    const { data: authData, error: authError } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 50,
    });

    if (authError) {
      console.error('List auth users error:', authError);
      throw authError;
    }

    const rawAuthUsers = authData?.users || [];

    // 2. 검색어에 따라 Auth 사용자 필터링
    let filteredAuthUsers = rawAuthUsers;
    if (cleanQ) {
      filteredAuthUsers = rawAuthUsers.filter((u) => {
        const uEmail = normalizeEmail(u.email);
        return uEmail.includes(cleanQ);
      });

      // 만약 이메일 검색인데 listUsers(50건)에 없다면 단건 직접 조회 시도
      if (cleanQ.includes('@') && !filteredAuthUsers.some((u) => normalizeEmail(u.email) === cleanQ)) {
        try {
          const directAuthUser = await findAuthUserByEmail(admin, cleanQ);
          if (directAuthUser) {
            filteredAuthUsers.unshift(directAuthUser);
          }
        } catch (_) {
          /* ignore */
        }
      }
    } else {
      // 검색어가 없으면 최근 가입순 상위 20명
      filteredAuthUsers = filteredAuthUsers.slice(0, 20);
    }

    // 3. short_users에서 auth_user_id가 매칭되는 프로필 조회
    const authUserIds = filteredAuthUsers.map((u) => u.id).filter(Boolean);

    let shortUserMap = new Map();
    if (authUserIds.length > 0) {
      const { data: shortRows, error: shortError } = await admin
        .from('short_users')
        .select(`
          id,
          username,
          email,
          auth_user_id,
          max_codes,
          created_at,
          short_user_codes(id, username, is_primary)
        `)
        .in('auth_user_id', authUserIds);

      if (!shortError && shortRows) {
        shortRows.forEach((r) => {
          shortUserMap.set(r.auth_user_id, r);
        });
      }
    }

    // 4. 만약 검색어가 있는데 short_users 테이블에 auth_user_id가 채워진 사용자가 Auth list에서 빠졌을 경우 대비 추가 검색
    if (cleanQ) {
      const { data: directShortUsers } = await admin
        .from('short_users')
        .select(`
          id,
          username,
          email,
          auth_user_id,
          max_codes,
          created_at,
          short_user_codes(id, username, is_primary)
        `)
        .not('auth_user_id', 'is', null)
        .ilike('email', `%${cleanQ}%`)
        .limit(10);

      if (directShortUsers) {
        directShortUsers.forEach((r) => {
          if (!shortUserMap.has(r.auth_user_id)) {
            shortUserMap.set(r.auth_user_id, r);
            if (!filteredAuthUsers.some((u) => u.id === r.auth_user_id)) {
              filteredAuthUsers.push({
                id: r.auth_user_id,
                email: r.email,
                created_at: r.created_at,
                last_sign_in_at: null,
                identities: [{ provider: 'google' }],
              });
            }
          }
        });
      }
    }

    // 5. 응답 포맷 구성
    const users = filteredAuthUsers.map((authUser) => {
      const linkedShortUser = shortUserMap.get(authUser.id) || null;
      const isGoogleProvider =
        authUser.app_metadata?.provider === 'google' ||
        authUser.identities?.some((i) => i.provider === 'google') ||
        authUser.email?.endsWith('@gmail.com');

      const codes = (linkedShortUser?.short_user_codes || []).sort((a, b) => {
        if (a.is_primary && !b.is_primary) return -1;
        if (!a.is_primary && b.is_primary) return 1;
        return a.id - b.id;
      });

      return {
        authUserId: authUser.id,
        email: authUser.email,
        isGoogle: Boolean(isGoogleProvider),
        createdAt: authUser.created_at,
        lastSignInAt: authUser.last_sign_in_at,
        status: linkedShortUser ? 'registered' : 'onboarding_pending',
        shortUser: linkedShortUser
          ? {
              id: linkedShortUser.id,
              username: linkedShortUser.username,
              email: linkedShortUser.email,
              maxCodes: linkedShortUser.max_codes,
              codes,
            }
          : null,
      };
    });

    return NextResponse.json({
      success: true,
      users,
    });
  } catch (error) {
    console.error('Admin link-account search-google error:', error);
    return NextResponse.json(
      { success: false, error: '구글 계정 검색 중 오류가 발생했습니다: ' + error.message },
      { status: 500 }
    );
  }
}
