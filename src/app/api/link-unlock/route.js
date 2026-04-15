import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeShortPathSegment } from '@/lib/pathSegments';
import { setLinkUnlockCookieOnResponse } from '@/lib/linkUnlock';

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: '요청 형식이 올바르지 않습니다.' }, { status: 400 });
  }

  const usernameRaw = typeof body.username === 'string' ? body.username : '';
  const codeRaw = typeof body.code === 'string' ? body.code : '';
  const password = typeof body.password === 'string' ? body.password : '';

  const username = usernameRaw ? normalizeShortPathSegment(usernameRaw) : '';
  const code = codeRaw ? normalizeShortPathSegment(codeRaw) : '';

  if (!username || !code || !password) {
    return NextResponse.json({ success: false, message: '입력값을 확인해주세요.' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data: user } = await supabase.from('short_users').select('id').eq('username', username).single();

    if (!user) {
      return NextResponse.json({ success: false, message: '비밀번호가 올바르지 않습니다.' }, { status: 401 });
    }

    const { data: urlData } = await supabase
      .from('short_urls')
      .select('id, link_password_hash, link_password_unlock_version')
      .eq('code', code)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!urlData?.link_password_hash) {
      return NextResponse.json({ success: false, message: '비밀번호가 올바르지 않습니다.' }, { status: 401 });
    }

    const ok = await bcrypt.compare(password, urlData.link_password_hash);
    if (!ok) {
      return NextResponse.json({ success: false, message: '비밀번호가 올바르지 않습니다.' }, { status: 401 });
    }

    const version = Number(urlData.link_password_unlock_version) || 0;
    const response = NextResponse.json({ success: true });
    setLinkUnlockCookieOnResponse(response, { username, code, version });
    return response;
  } catch (error) {
    console.error('Link unlock error:', error);
    return NextResponse.json({ success: false, message: '오류가 발생했습니다.' }, { status: 500 });
  }
}
