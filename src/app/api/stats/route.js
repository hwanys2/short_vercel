import { NextResponse } from 'next/server';
import { getSeoulStartOfTodayISO } from '@/lib/kstDate';
import { getSupabaseAdmin } from '@/lib/supabase';

async function countActiveByType(supabase, nowIso, type) {
  const { count } = await supabase
    .from('short_urls')
    .select('*', { count: 'exact', head: true })
    .gt('expiration_date', nowIso)
    .eq('type', type);
  return count || 0;
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const nowIso = new Date().toISOString();

    const [urlCount, textCount, fileCount, todayCountResult, userCountResult] = await Promise.all([
      countActiveByType(supabase, nowIso, 'url'),
      countActiveByType(supabase, nowIso, 'text'),
      countActiveByType(supabase, nowIso, 'file'),
      supabase
        .from('short_urls')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', getSeoulStartOfTodayISO()),
      supabase.from('short_users').select('*', { count: 'exact', head: true }),
    ]);

    return NextResponse.json({
      status: 'success',
      data: {
        total: urlCount + textCount + fileCount,
        today: todayCountResult.count || 0,
        users: userCountResult.count || 0,
        byType: {
          url: urlCount,
          text: textCount,
          file: fileCount,
        },
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
