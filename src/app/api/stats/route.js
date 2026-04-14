import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    // 전체 URL 수
    const { count: total } = await supabase
      .from('short_urls')
      .select('*', { count: 'exact', head: true });

    // 오늘 생성된 URL 수
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count: todayCount } = await supabase
      .from('short_urls')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString());

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
