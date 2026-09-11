import { NextResponse } from 'next/server';
import { ADMIN_EMAILS, requireAdmin } from '@/lib/admin';
import { AUDIENCE_LABELS } from '@/lib/mailing/campaign';
import { countAudienceMembers } from '@/lib/mailing/recipients';

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  const { admin } = auth;

  try {
    const [systemCount, optionalCount, adminCount] = await Promise.all([
      countAudienceMembers(admin, 'system'),
      countAudienceMembers(admin, 'optional'),
      countAudienceMembers(admin, 'admin'),
    ]);

    const adminEmailList = Array.from(ADMIN_EMAILS).join(', ');

    return NextResponse.json({
      success: true,
      audiences: [
        {
          id: 'admin',
          name: AUDIENCE_LABELS.admin,
          memberCount: adminCount,
          description: `${adminEmailList} 에게만 테스트 발송합니다.`,
        },
        {
          id: 'system',
          name: AUDIENCE_LABELS.system,
          memberCount: systemCount,
          description: '서비스 운영·보안·약관 등 필수 안내 (해제 불가)',
        },
        {
          id: 'optional',
          name: AUDIENCE_LABELS.optional,
          memberCount: optionalCount,
          description: '선택 메일 수신에 동의한 회원',
        },
      ],
    });
  } catch (err) {
    console.error('[mailing/audiences] error:', err);
    return NextResponse.json(
      { success: false, error: err.message || '수신 대상 조회 실패' },
      { status: 500 }
    );
  }
}
