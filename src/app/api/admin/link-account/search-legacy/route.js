import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { normalizeEmail } from '@/lib/authBridge';
import { MAX_CODES_DEFAULT } from '@/lib/userCodes';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/link-account/search-legacy
 * - q: 본인코드(닉네임) 또는 기존 이메일/사용자 검색어
 */
export async function GET(request) {
  const gate = await requireAdmin(request);
  if (gate.response) return gate.response;

  const { admin } = gate;
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();

  if (!q) {
    return NextResponse.json({
      success: true,
      accounts: [],
    });
  }

  try {
    const cleanEmail = normalizeEmail(q);
    const userIdsSet = new Set();

    // 1. short_user_codes 에서 username 검색
    const { data: codeMatches, error: codeErr } = await admin
      .from('short_user_codes')
      .select('user_id')
      .ilike('username', `%${q}%`)
      .limit(30);

    if (!codeErr && codeMatches) {
      codeMatches.forEach((c) => {
        if (c.user_id) userIdsSet.add(Number(c.user_id));
      });
    }

    // 2. short_users 에서 username 또는 email 검색
    const { data: userMatches, error: userErr } = await admin
      .from('short_users')
      .select('id')
      .or(`username.ilike.%${q}%,email.ilike.%${cleanEmail || q}%`)
      .limit(30);

    if (!userErr && userMatches) {
      userMatches.forEach((u) => {
        if (u.id) userIdsSet.add(Number(u.id));
      });
    }

    const targetUserIds = Array.from(userIdsSet);
    if (targetUserIds.length === 0) {
      return NextResponse.json({
        success: true,
        accounts: [],
      });
    }

    // 3. 사용자 상세 정보 조회
    const { data: userRows, error: fetchErr } = await admin
      .from('short_users')
      .select(`
        id,
        username,
        email,
        auth_user_id,
        max_codes,
        created_at,
        last_login,
        short_user_codes(id, username, is_primary, created_at)
      `)
      .in('id', targetUserIds);

    if (fetchErr) throw fetchErr;

    // 4. 각 사용자별 short_urls 링크 개수 집계
    const accounts = await Promise.all(
      (userRows || []).map(async (row) => {
        const { count: urlCount } = await admin
          .from('short_urls')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', row.id);

        const codes = (row.short_user_codes || []).sort((a, b) => {
          if (a.is_primary && !b.is_primary) return -1;
          if (!a.is_primary && b.is_primary) return 1;
          return a.id - b.id;
        });

        let linkedEmail = null;
        if (row.auth_user_id) {
          try {
            const { data: authUser } = await admin.auth.admin.getUserById(row.auth_user_id);
            linkedEmail = authUser?.user?.email || null;
          } catch (_) {
            /* ignore */
          }
        }

        return {
          id: row.id,
          username: row.username,
          email: row.email,
          authUserId: row.auth_user_id || null,
          isLinked: Boolean(row.auth_user_id),
          linkedEmail,
          maxCodes: typeof row.max_codes === 'number' ? row.max_codes : MAX_CODES_DEFAULT,
          codes,
          codeCount: codes.length,
          urlCount: urlCount || 0,
          createdAt: row.created_at,
          lastLogin: row.last_login,
        };
      })
    );

    // 검색어와 일치도가 높은 순 정렬
    accounts.sort((a, b) => {
      const aExact = a.username.toLowerCase() === q.toLowerCase() || a.codes.some((c) => c.username.toLowerCase() === q.toLowerCase());
      const bExact = b.username.toLowerCase() === q.toLowerCase() || b.codes.some((c) => c.username.toLowerCase() === q.toLowerCase());
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      return b.id - a.id;
    });

    return NextResponse.json({
      success: true,
      accounts,
    });
  } catch (error) {
    console.error('Admin link-account search-legacy error:', error);
    return NextResponse.json(
      { success: false, error: '기존 계정 검색 중 오류가 발생했습니다: ' + error.message },
      { status: 500 }
    );
  }
}
