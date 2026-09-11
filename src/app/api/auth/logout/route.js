import { NextResponse } from 'next/server';
import { clearAuthCookie } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSiteOrigin } from '@/lib/siteUrl';

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  } catch (err) {
    console.error('Supabase signOut error:', err);
  }

  await clearAuthCookie();
  return NextResponse.json({ success: true });
}

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  } catch (err) {
    console.error('Supabase signOut error:', err);
  }

  await clearAuthCookie();
  return NextResponse.redirect(new URL('/', getSiteOrigin()));
}
