import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeShortPathSegment } from '@/lib/pathSegments';
import { isValidLinkUnlockCookie } from '@/lib/linkUnlock';

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
    let unlockUsername = '';

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
        .select('text_content, type, code, link_password_hash, link_password_unlock_version')
        .eq('code', normalizedCode)
        .eq('user_id', user.id)
        .single();

      urlData = data;
      unlockUsername = normalizedUsername;
    } else {
      const { data } = await supabase
        .from('short_urls')
        .select('text_content, type, code, link_password_hash, link_password_unlock_version')
        .eq('code', normalizedCode)
        .is('user_id', null)
        .gt('expiration_date', new Date().toISOString())
        .single();

      urlData = data;
      unlockUsername = '';
    }

    if (!urlData || urlData.type !== 'text') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const protectedLink =
      urlData.link_password_hash != null && String(urlData.link_password_hash).length > 0;

    if (protectedLink) {
      const unlockVersion = Number(urlData.link_password_unlock_version) || 0;
      if (!isValidLinkUnlockCookie(request, unlockUsername, normalizedCode, unlockVersion)) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
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
