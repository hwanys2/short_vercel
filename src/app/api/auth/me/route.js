import { NextResponse } from 'next/server';
import { isAdminEmail } from '@/lib/admin';
import { resolveAppUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';
import { serializeUsernameChangeCooldown } from '@/lib/usernameChange';
import { MAX_CODES_DEFAULT } from '@/lib/userCodes';

export async function GET() {
  const user = await resolveAppUser();

  if (!user) {
    return NextResponse.json({ success: false, user: null }, { status: 401 });
  }

  if (user.needsOnboarding) {
    return NextResponse.json({
      success: true,
      needsOnboarding: true,
      user: {
        id: null,
        username: null,
        email: user.email,
        is_admin: false,
        codes: [],
        max_codes: MAX_CODES_DEFAULT,
        can_add_code: false,
      },
    });
  }

  const cooldown = serializeUsernameChangeCooldown(user.username_changed_at);
  const codes = (user.codes || []).map((c) => ({
    id: c.id,
    username: c.username,
    is_primary: c.is_primary,
    username_changed_at: c.username_changed_at || null,
    created_at: c.created_at || null,
  }));
  const maxCodes = user.max_codes ?? MAX_CODES_DEFAULT;

  let acceptsOptionalMail = true;
  let hasPassword = false;
  try {
    const admin = getSupabaseAdmin();
    const { data: row } = await admin
      .from('short_users')
      .select('accepts_optional_mail, password')
      .eq('id', user.id)
      .maybeSingle();
    if (row) {
      acceptsOptionalMail = row.accepts_optional_mail !== false;
      hasPassword = Boolean(row.password);
    }
  } catch (err) {
    console.error('auth/me profile fields:', err);
  }

  return NextResponse.json({
    success: true,
    needsOnboarding: false,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      is_admin: isAdminEmail(user.email),
      accepts_optional_mail: acceptsOptionalMail,
      has_password: hasPassword,
      username_changed_at: user.username_changed_at || null,
      can_change_username: cooldown.can_change,
      username_change_remaining_label: cooldown.remaining_label,
      username_change_next_at: cooldown.next_change_at,
      codes,
      max_codes: maxCodes,
      can_add_code: codes.length < maxCodes,
      primary_code_id: user.primaryCode?.id || null,
    },
  });
}
