import { NextResponse } from 'next/server';
import { getSeoulStartOfTodayISO } from '@/lib/kstDate';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    // 만료되지 않은 단축 URL 수 (비회원 만료분 제외, 회원·유효 비회원 포함)
    const { count: total } = await supabase
      .from('short_urls')
      .select('*', { count: 'exact', head: true })
      .gt('expiration_date', new Date().toISOString());

    // 오늘 생성된 URL 수 (한국 날짜 기준 00:00 KST ~)
    const { count: todayCount } = await supabase
      .from('short_urls')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', getSeoulStartOfTodayISO());

    // 전체 사용자 수
    const { count: userCount } = await supabase
      .from('short_users')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({
      status: 'success',
      data: {
        total: total || 0,
        today: todayCount || 0,
        users: userCount || 0,
      },
    });
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json(
      { status: 'error', message: '통계를 불러올 수 없습니다.' },
      { status: 500 }
    );
  }
}
