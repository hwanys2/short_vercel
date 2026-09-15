import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { normalizeEmail } from '@/lib/authBridge';
import { MAX_CODES_DEFAULT } from '@/lib/userCodes';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/slot-requests
 * 관리자용 SNS 홍보 슬롯 추가 신청 목록 조회
 * Query Params:
 * - status: 'all' | 'pending' | 'approved' | 'rejected'
 * - q: 이메일, 닉네임, SNS URL 검색어
 */
export async function GET(request) {
  const gate = await requireAdmin(request);
  if (gate.response) return gate.response;

  const { admin } = gate;
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || 'all';
  const q = (searchParams.get('q') || '').trim();

  try {
    // 1. 상태별 카운트 조회
    const [allRes, pendingRes, approvedRes, rejectedRes] = await Promise.all([
      admin.from('short_slot_requests').select('id', { count: 'exact', head: true }),
      admin.from('short_slot_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      admin.from('short_slot_requests').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
      admin.from('short_slot_requests').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
    ]);

    const counts = {
      all: allRes.count || 0,
      pending: pendingRes.count || 0,
      approved: approvedRes.count || 0,
      rejected: rejectedRes.count || 0,
    };

    // 2. 신청 목록 쿼리 (사용자 정보 조인)
    let query = admin
      .from('short_slot_requests')
      .select(`
        id,
        user_id,
        sns_url,
        memo,
        status,
        rejection_reason,
        granted_slots,
        reviewed_by,
        reviewed_at,
        created_at,
        updated_at,
        short_users!short_slot_requests_user_id_fkey (
          id,
          email,
          username,
          max_codes,
          created_at,
          short_user_codes (id)
        )
      `)
      .order('id', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (q) {
      // URL 또는 short_users 매칭 검색
      const cleanEmail = normalizeEmail(q);
      query = query.or(`sns_url.ilike.%${q}%,memo.ilike.%${q}%`);
    }

    const { data: rows, error } = await query;
    if (error) throw error;

    let filtered = (rows || []).map((row) => {
      const u = row.short_users || {};
      const codes = u.short_user_codes || [];
      return {
        id: row.id,
        user_id: row.user_id,
        user_email: u.email || '알 수 없음',
        user_username: u.username || '-',
        user_created_at: u.created_at,
        max_codes: typeof u.max_codes === 'number' ? u.max_codes : MAX_CODES_DEFAULT,
        code_count: codes.length,
        sns_url: row.sns_url,
        memo: row.memo,
        status: row.status,
        rejection_reason: row.rejection_reason,
        granted_slots: row.granted_slots || 1,
        reviewed_by: row.reviewed_by,
        reviewed_at: row.reviewed_at,
        created_at: row.created_at,
      };
    });

    // 검색어가 있을 때 사용자 이메일/닉네임으로 추가 클라이언트 필터링 (조인 검색 보완)
    if (q) {
      const lowerQ = q.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.user_email.toLowerCase().includes(lowerQ) ||
          r.user_username.toLowerCase().includes(lowerQ) ||
          r.sns_url.toLowerCase().includes(lowerQ) ||
          (r.memo && r.memo.toLowerCase().includes(lowerQ))
      );
    }

    return NextResponse.json({
      success: true,
      counts,
      requests: filtered,
    });
  } catch (error) {
    console.error('Admin slot requests GET error:', error);
    return NextResponse.json(
      { success: false, error: '슬롯 신청 목록을 불러오지 못했습니다: ' + error.message },
      { status: 500 }
    );
  }
}
