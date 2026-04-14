import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getUserFromRequest } from '@/lib/auth';

export async function DELETE(request, { params }) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { code } = await params;
    const supabase = getSupabaseAdmin();

    const { error, count } = await supabase
      .from('short_urls')
      .delete()
      .eq('code', decodeURIComponent(code))
      .eq('user_id', user.id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'URL이 삭제되었습니다.' });
  } catch (error) {
    console.error('Delete URL error:', error);
    return NextResponse.json({ success: false, message: 'URL 삭제 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
