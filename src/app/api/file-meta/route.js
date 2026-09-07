import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeShortPathSegment } from '@/lib/pathSegments';
import { isValidLinkUnlockCookie } from '@/lib/linkUnlock';
import { formatFileSize } from '@/lib/shortFiles';

async function loadFileRow(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const username = searchParams.get('username');

  if (!code) {
    return { error: NextResponse.json({ error: 'code parameter is required' }, { status: 400 }) };
  }

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
      return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
    }

    const { data } = await supabase
      .from('short_urls')
      .select(
        'id, type, code, file_name, file_size, file_mime, file_path, link_password_hash, link_password_unlock_version, expiration_date, created_at'
      )
      .eq('code', normalizedCode)
      .eq('user_id', user.id)
      .single();

    urlData = data;
    unlockUsername = normalizedUsername;
  } else {
    const { data } = await supabase
      .from('short_urls')
      .select(
        'id, type, code, file_name, file_size, file_mime, file_path, link_password_hash, link_password_unlock_version, expiration_date, created_at'
      )
      .eq('code', normalizedCode)
      .is('user_id', null)
      .single();

    urlData = data;
    unlockUsername = '';
  }

  if (!urlData || urlData.type !== 'file' || !urlData.file_path) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }

  const isExpired =
    urlData.expiration_date && new Date(urlData.expiration_date) <= new Date();

  if (isExpired) {
    return {
      error: NextResponse.json(
        {
          error: 'File expired',
          expired: true,
          file_name: urlData.file_name,
          expiration_date: urlData.expiration_date,
        },
        { status: 410 }
      ),
    };
  }

  const protectedLink =
    urlData.link_password_hash != null && String(urlData.link_password_hash).length > 0;

  if (protectedLink) {
    const unlockVersion = Number(urlData.link_password_unlock_version) || 0;
    if (!isValidLinkUnlockCookie(request, unlockUsername, normalizedCode, unlockVersion)) {
      return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
    }
  }

  return { urlData, unlockUsername, normalizedCode, supabase };
}

export async function GET(request) {
  try {
    const loaded = await loadFileRow(request);
    if (loaded.error) return loaded.error;

    const { urlData } = loaded;
    return NextResponse.json({
      success: true,
      code: urlData.code,
      file_name: urlData.file_name,
      file_size: urlData.file_size,
      file_size_label: formatFileSize(urlData.file_size),
      file_mime: urlData.file_mime,
      expiration_date: urlData.expiration_date,
      created_at: urlData.created_at,
      server_time: new Date().toISOString(),
    });
  } catch (error) {
    console.error('File meta fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
