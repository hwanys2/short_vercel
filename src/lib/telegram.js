const DEFAULT_TELEGRAM_URL =
  process.env.TELEGRAM_EDGE_FUNCTION_URL ||
  'https://jmgoqpqyrnoamfjngcmy.supabase.co/functions/v1/send-telegram';

const DEFAULT_TELEGRAM_JWT =
  process.env.TELEGRAM_EDGE_INVOKER_JWT ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptZ29xcHF5cm5vYW1mam5nY215Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODc4NjU1MSwiZXhwIjoyMDg0MzYyNTUxfQ.WjRVvVmclLlLlJ8H3DKLRfdF4blD87VKCIM--2TuM4w';

/**
 * 텔레그램 메시지 발송 헬퍼 (Foreducator send-telegram Edge Function 연동)
 * @param {string} text - 전송할 메시지 본문
 * @returns {Promise<boolean>}
 */
export async function sendTelegramNotification(text) {
  if (!text || !DEFAULT_TELEGRAM_URL || !DEFAULT_TELEGRAM_JWT) {
    return false;
  }

  try {
    const res = await fetch(DEFAULT_TELEGRAM_URL, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + DEFAULT_TELEGRAM_JWT,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mode: 'developer',
        text: text.slice(0, 4000),
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Failed to send telegram notification:', res.status, errText);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Telegram notification error:', err);
    return false;
  }
}

/**
 * 슬롯 추가 신청 접수 시 관리자 텔레그램 알림 발송
 */
export async function notifyAdminSlotRequest({ userEmail, username, currentSlots, snsUrl, memo }) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://숏.한국';
  const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const adminSlotUrl = `${cleanBaseUrl}/admin/slot-requests`;

  const lines = [
    '🎁 [숏.한국] 새로운 슬롯 추가 신청 접수',
    '',
    `• 신청자: ${userEmail || '-'} (${username || '닉네임 없음'})`,
    `• 현재 슬롯: ${currentSlots ?? 2}개`,
    `• SNS 홍보 링크:`,
    `${snsUrl}`,
  ];

  if (memo) {
    lines.push(`• 메모: ${memo}`);
  }

  lines.push('', `👉 관리자 승인하기:`, adminSlotUrl);

  const message = lines.join('\n');
  return await sendTelegramNotification(message);
}
