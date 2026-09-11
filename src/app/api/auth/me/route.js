import { NextResponse } from 'next/server';
import { resolveAppUser } from '@/lib/session';

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

  return NextResponse.json({
    success: true,
    needsOnboarding: false,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
    },
  });
}
