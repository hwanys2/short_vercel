import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeShortPathSegment } from '@/lib/pathSegments';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const username = searchParams.get('username');

  if (!code) {
    return NextResponse.json({ error: 'code parameter is required' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const normalizedCode = normalizeShortPathSegment(code);

    let urlData = null;

    if (username) {
      const normalizedUsername = normalizeShortPathSegment(username);
      const { data: user } = await supabase
        .from('short_users')
        .select('id')
        .eq('username', normalizedUsername)
        .single();

      if (!user) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }

      const { data } = await supabase
        .from('short_urls')
        .select('text_content, type, code')
        .eq('code', normalizedCode)
        .eq('user_id', user.id)
        .single();

      urlData = data;
    } else {
      const { data } = await supabase
        .from('short_urls')
        .select('text_content, type, code')
        .eq('code', normalizedCode)
        .is('user_id', null)
        .gt('expiration_date', new Date().toISOString())
        .single();

      urlData = data;
    }

    if (!urlData || urlData.type !== 'text') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      text_content: urlData.text_content,
      code: urlData.code,
    });
  } catch (error) {
    console.error('Text content fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
