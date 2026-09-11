import { NextResponse } from 'next/server';
import { resolveAppUser } from '@/lib/session';
import { serializeUsernameChangeCooldown } from '@/lib/usernameChange';

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
      },
    });
  }

  const cooldown = serializeUsernameChangeCooldown(user.username_changed_at);

  return NextResponse.json({
    success: true,
    needsOnboarding: false,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      username_changed_at: user.username_changed_at || null,
      can_change_username: cooldown.can_change,
      username_change_remaining_label: cooldown.remaining_label,
      username_change_next_at: cooldown.next_change_at,
    },
  });
}
