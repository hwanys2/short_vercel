import { NextResponse } from 'next/server';

/**
 * 이메일/비밀번호 신규 가입은 중단. 신규는 Google + /onboarding 만 허용.
 */
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      message: '신규 가입은 Google로만 가능합니다. 회원가입 페이지에서 Google로 가입해주세요.',
    },
    { status: 410 }
  );
}
