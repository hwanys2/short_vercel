import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeShortPathSegment } from '@/lib/pathSegments';
import { isValidLinkUnlockCookie } from '@/lib/linkUnlock';
import { createSignedDownloadUrl } from '@/lib/shortFiles';
import { isR2Key, createR2PresignedGetUrl, isR2Configured, getR2PublicUrl } from '@/lib/r2';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const username = searchParams.get('username');
    const inline = searchParams.get('inline') === '1' || searchParams.get('inline') === 'true';

    if (!code) {
      return NextResponse.json({ error: 'code parameter is required' }, { status: 400 });
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
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }

      const { data } = await supabase
        .from('short_urls')
        .select(
          'id, original_url, type, code, file_name, file_path, file_mime, link_password_hash, link_password_unlock_version, expiration_date'
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
          'id, original_url, type, code, file_name, file_path, file_mime, link_password_hash, link_password_unlock_version, expiration_date'
        )
        .eq('code', normalizedCode)
        .is('user_id', null)
        .single();

      urlData = data;
      unlockUsername = '';
    }

    if (!urlData || urlData.type !== 'file' || !urlData.file_path) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (urlData.expiration_date && new Date(urlData.expiration_date) <= new Date()) {
      return NextResponse.json({ error: 'Download expired' }, { status: 410 });
    }

    const protectedLink =
      urlData.link_password_hash != null && String(urlData.link_password_hash).length > 0;

    if (protectedLink) {
      const unlockVersion = Number(urlData.link_password_unlock_version) || 0;
      if (!isValidLinkUnlockCookie(request, unlockUsername, normalizedCode, unlockVersion)) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
    }

    // Cloudflare R2: 만료·비밀번호 검사 후 프리사인 URL로 302 (공개 URL 직링크 우회 방지)
    if (isR2Key(urlData.file_path)) {
      try {
        if (isR2Configured()) {
          const signed = await createR2PresignedGetUrl({
            key: urlData.file_path,
            fileName: urlData.file_name || 'file',
            inline,
            expiresIn: inline ? 300 : 120,
            contentType: urlData.file_mime || undefined,
          });
          return NextResponse.redirect(signed, 302);
        }
        // 로컬 등 R2 자격 증명 미설정 시 DB에 저장된 공개 URL 폴백
        const targetUrl =
          (urlData.original_url &&
            String(urlData.original_url).startsWith('http') &&
            urlData.original_url) ||
          getR2PublicUrl(urlData.file_path);
        if (!targetUrl || !String(targetUrl).startsWith('http') || String(targetUrl).includes('.undefined.')) {
          return NextResponse.json(
            { error: 'R2 credentials are not configured' },
            { status: 503 }
          );
        }
        return NextResponse.redirect(targetUrl, 302);
      } catch (err) {
        console.error('R2 download error:', err);
        return NextResponse.json({ error: 'Download unavailable' }, { status: 502 });
      }
    }

    // Supabase Storage 파일인 경우 Signed URL 발급 후 리다이렉트
    const signedUrl = await createSignedDownloadUrl(urlData.file_path, 120, urlData.file_name);
    return NextResponse.redirect(signedUrl, 302);
  } catch (error) {
    console.error('File download error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
