import { NextResponse } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeShortPathSegment, readMiddlewareShortHeader } from '@/lib/pathSegments';
import { isValidLinkUnlockCookie } from '@/lib/linkUnlock';
import { resolveOwnerCode } from '@/lib/userCodes';
import { getR2Client, getR2BucketName, isR2Configured, getR2PublicUrl } from '@/lib/r2';

function decodeMacTextEditHtml(htmlString) {
  if (
    !htmlString ||
    (!htmlString.includes('Cocoa HTML Writer') &&
      !htmlString.includes('&lt;!DOCTYPE') &&
      !htmlString.includes('&lt;html'))
  ) {
    return htmlString;
  }
  const bodyMatch = htmlString.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let content = bodyMatch ? bodyMatch[1] : htmlString;
  content = content
    .replace(/<p[^>]*>/gi, '')
    .replace(/<\/p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<span class="Apple-converted-space">[\s\S]*?<\/span>/gi, ' ')
    .replace(/<[^>]+>/gi, '');
  content = content
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
  return content.trim();
}

export async function GET(request) {
  const { searchParams } = request.nextUrl;
  const code =
    readMiddlewareShortHeader(request, 'short-code') ??
    (searchParams.get('code') != null ? normalizeShortPathSegment(searchParams.get('code')) : null);
  const username =
    readMiddlewareShortHeader(request, 'short-username') ??
    (searchParams.get('username') != null
      ? normalizeShortPathSegment(searchParams.get('username'))
      : null);

  if (!code) {
    return NextResponse.json({ error: 'Code is required' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    let originalUrl = null;
    let urlType = 'url';
    let urlFilePath = null;

    if (username) {
      // 회원 URL 패턴: /username/code
      const owner = await resolveOwnerCode(supabase, username);

      if (!owner) {
        return NextResponse.redirect(new URL('/missing.link', request.url), 302);
      }

      const { data: urlData } = await supabase
        .from('short_urls')
        .select('original_url, id, link_password_hash, link_password_unlock_version, type, text_content, file_path')
        .eq('code', code)
        .eq('user_code_id', owner.codeId)
        .single();

      if (urlData) {
        const protectedLink =
          urlData.link_password_hash != null && String(urlData.link_password_hash).length > 0;
        const unlockVersion = Number(urlData.link_password_unlock_version) || 0;

        if (protectedLink) {
          if (isValidLinkUnlockCookie(request, username, code, unlockVersion)) {
            originalUrl = urlData.original_url;
            urlType = urlData.type || 'url';
            urlFilePath = urlData.file_path;
            supabase.rpc('increment_short_url_visits', { p_url_id: urlData.id }).then(() => {});
          } else {
            const gate = new URL('/link-gate', request.url);
            gate.searchParams.set('username', username);
            gate.searchParams.set('code', code);
            return NextResponse.redirect(gate, 302);
          }
        } else {
          originalUrl = urlData.original_url;
          urlType = urlData.type || 'url';
          urlFilePath = urlData.file_path;
          supabase.rpc('increment_short_url_visits', { p_url_id: urlData.id }).then(() => {});
        }
      }
    } else {
      // 비회원 URL 패턴: /code (만료되지 않은 것만)
      const { data: urlData } = await supabase
        .from('short_urls')
        .select('original_url, id, expiration_date, type, text_content, link_password_hash, link_password_unlock_version, file_path')
        .eq('code', code)
        .is('user_id', null)
        .gt('expiration_date', new Date().toISOString())
        .maybeSingle();

      if (urlData) {
        const protectedLink =
          urlData.link_password_hash != null && String(urlData.link_password_hash).length > 0;
        const unlockVersion = Number(urlData.link_password_unlock_version) || 0;

        if (protectedLink) {
          if (isValidLinkUnlockCookie(request, '', code, unlockVersion)) {
            originalUrl = urlData.original_url;
            urlType = urlData.type || 'url';
            urlFilePath = urlData.file_path;
            supabase.rpc('increment_short_url_visits', { p_url_id: urlData.id }).then(() => {});
          } else {
            const gate = new URL('/link-gate', request.url);
            gate.searchParams.set('code', code);
            return NextResponse.redirect(gate, 302);
          }
        } else {
          originalUrl = urlData.original_url;
          urlType = urlData.type || 'url';
          urlFilePath = urlData.file_path;
          supabase.rpc('increment_short_url_visits', { p_url_id: urlData.id }).then(() => {});
        }
      }
    }

    if (originalUrl) {
      // HTML 타입이면 R2에서 직접 읽어와 브라우저에 웹페이지로 렌더링
      if (urlType === 'html') {
        if (!urlFilePath) {
          return NextResponse.redirect(new URL('/missing.link', request.url), 302);
        }

        try {
          if (isR2Configured()) {
            const s3 = getR2Client();
            const bucket = getR2BucketName();
            const command = new GetObjectCommand({
              Bucket: bucket,
              Key: urlFilePath,
            });
            const s3Response = await s3.send(command);
            const rawHtml = await s3Response.Body.transformToString('utf-8');
            const finalHtml = decodeMacTextEditHtml(rawHtml);
            return new Response(finalHtml, {
              status: 200,
              headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'X-Content-Type-Options': 'nosniff',
              },
            });
          }

          // R2 자격증명 미설정 시 공개 URL 폴백
          const fallbackUrl = getR2PublicUrl(urlFilePath);
          if (fallbackUrl && fallbackUrl.startsWith('http')) {
            const res = await fetch(fallbackUrl);
            if (res.ok) {
              const rawHtml = await res.text();
              const finalHtml = decodeMacTextEditHtml(rawHtml);
              return new Response(finalHtml, {
                status: 200,
                headers: {
                  'Content-Type': 'text/html; charset=utf-8',
                  'Cache-Control': 'no-cache, no-store, must-revalidate',
                  'X-Content-Type-Options': 'nosniff',
                },
              });
            }
          }

          return NextResponse.redirect(new URL('/missing.link', request.url), 302);
        } catch (err) {
          console.error('HTML serving error:', err);
          return NextResponse.redirect(new URL('/missing.link', request.url), 302);
        }
      }

      // 텍스트 타입이면 텍스트 뷰어 페이지로 리다이렉트
      if (urlType === 'text') {
        const textViewUrl = new URL('/text-view', request.url);
        textViewUrl.searchParams.set('code', code);
        if (username) {
          textViewUrl.searchParams.set('username', username);
        }
        return NextResponse.redirect(textViewUrl, 302);
      }

      // 파일 타입이면 다운로드 페이지로 리다이렉트
      if (urlType === 'file') {
        const fileViewUrl = new URL('/file-view', request.url);
        fileViewUrl.searchParams.set('code', code);
        if (username) {
          fileViewUrl.searchParams.set('username', username);
        }
        return NextResponse.redirect(fileViewUrl, 302);
      }

      return NextResponse.redirect(originalUrl, 302);
    }

    // URL을 찾지 못한 경우
    return NextResponse.redirect(new URL('/missing.link', request.url), 302);
  } catch (error) {
    console.error('Redirect error:', error);
    return NextResponse.redirect(new URL('/missing.link', request.url), 302);
  }
}
