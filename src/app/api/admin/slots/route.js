import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { normalizeEmail } from '@/lib/authBridge';
import { MAX_CODES_DEFAULT } from '@/lib/userCodes';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/slots
 * - q: 이메일 또는 닉네임 검색어
 * - mode: 'boosted' 일 경우 기본(2개) 초과 사용자 목록 조회
 */
export async function GET(request) {
  const gate = await requireAdmin(request);
  if (gate.response) return gate.response;

  const { admin } = gate;
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  const mode = searchParams.get('mode') || '';

  try {
    let query = admin
      .from('short_users')
      .select(`
        id,
        username,
        email,
        max_codes,
        created_at,
        last_login,
        short_user_codes(id, username, is_primary, created_at)
      `)
      .order('id', { ascending: false });

    if (q) {
      const cleanEmail = normalizeEmail(q);
      // 이메일 또는 닉네임으로 검색
      query = query.or(`email.ilike.%${cleanEmail}%,username.ilike.%${q}%`);
    } else if (mode === 'boosted') {
      // 슬롯이 2개 초과로 상향된 사용자 목록
      query = query.gt('max_codes', MAX_CODES_DEFAULT).limit(50);
    } else {
      // 기본: 최근 가입 사용자 20명
      query = query.limit(20);
    }

    const { data: rows, error } = await query;
    if (error) throw error;

    const users = (rows || []).map((row) => {
      const codes = (row.short_user_codes || []).sort((a, b) => {
        if (a.is_primary && !b.is_primary) return -1;
        if (!a.is_primary && b.is_primary) return 1;
        return a.id - b.id;
      });

      return {
        id: row.id,
        email: row.email,
        username: row.username,
        max_codes: typeof row.max_codes === 'number' ? row.max_codes : MAX_CODES_DEFAULT,
        created_at: row.created_at,
        last_login: row.last_login,
        codes,
        code_count: codes.length,
      };
    });

    return NextResponse.json({
      success: true,
      users,
    });
  } catch (error) {
    console.error('Admin slots GET error:', error);
    return NextResponse.json(
      { success: false, error: '사용자 목록을 불러오지 못했습니다: ' + error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/slots
 * Body: { userId: number, maxCodes: number }
 */
export async function PATCH(request) {
  const gate = await requireAdmin(request);
  if (gate.response) return gate.response;

  const { admin } = gate;

  try {
    const body = await request.json();
    const userId = Number(body?.userId);
    const maxCodes = parseInt(body?.maxCodes, 10);

    if (!userId || !Number.isInteger(userId)) {
      return NextResponse.json(
        { success: false, error: '유효한 사용자 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    if (isNaN(maxCodes) || maxCodes < 1 || maxCodes > 100) {
      return NextResponse.json(
        { success: false, error: '코드 슬롯 개수는 1개 이상 100개 이하의 정수여야 합니다.' },
        { status: 400 }
      );
    }

    // 1. 대상 사용자 및 현재 보유 코드 수 확인
    const { data: user, error: userError } = await admin
      .from('short_users')
      .select(`
        id,
        email,
        username,
        max_codes,
        short_user_codes(id)
      `)
      .eq('id', userId)
      .maybeSingle();

    if (userError) throw userError;
    if (!user) {
      return NextResponse.json(
        { success: false, error: '해당 사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const currentCodeCount = user.short_user_codes?.length || 0;
    if (maxCodes < currentCodeCount) {
      return NextResponse.json(
        {
          success: false,
          error: `현재 사용 중인 본인 코드 수(${currentCodeCount}개)보다 적게 슬롯을 설정할 수 없습니다. (최소 ${currentCodeCount}개 필요)`,
        },
        { status: 400 }
      );
    }

    // 2. max_codes 업데이트
    const { data: updated, error: updateError } = await admin
      .from('short_users')
      .update({
        max_codes: maxCodes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select('id, email, username, max_codes')
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      message: `${user.email} 계정의 슬롯이 ${maxCodes}개로 변경되었습니다.`,
      user: updated,
    });
  } catch (error) {
    console.error('Admin slots PATCH error:', error);
    return NextResponse.json(
      { success: false, error: '슬롯 개수 변경 중 오류가 발생했습니다: ' + error.message },
      { status: 500 }
    );
  }
}
