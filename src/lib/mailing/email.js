import nodemailer from 'nodemailer';
import { getSiteOrigin } from '@/lib/siteUrl';

const SMTP_USER = process.env.AWS_SES_SMTP_USER;
const SMTP_PASS = process.env.AWS_SES_SMTP_PASS;
const SMTP_HOST = process.env.AWS_SES_SMTP_HOST || 'email-smtp.ap-southeast-2.amazonaws.com';
const SMTP_PORT = 587;

/** SES는 IDN을 punycode로 처리. UI/본문에는 noreply@숏.한국 표기. */
/** 숏.한국 IDN → punycode (SES SMTP용). 사용자에게는 noreply@숏.한국 으로 보임. */
export const MAIL_FROM_ADDRESS = 'noreply@xn--0p4b.xn--3e0b707e';
export const MAIL_FROM_DISPLAY = '숏.한국';
export const MAIL_FROM_VISIBLE = 'noreply@숏.한국';
export const FROM_HEADER = `"${MAIL_FROM_DISPLAY}" <${MAIL_FROM_ADDRESS}>`;
export const SEND_DELAY_MS = 150;

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 본문이 HTML 태그 없이 오면 줄바꿈을 <br>로 변환.
 * 이미 HTML이면 그대로 사용.
 */
export function normalizeMailBody(message) {
  const raw = String(message || '');
  if (/<[a-z][\s\S]*>/i.test(raw)) {
    return raw;
  }
  return escapeHtml(raw).replace(/\r\n|\r|\n/g, '<br>');
}

export function buildEmailHtml(mainContent, { unsubscribeLink = '#', subject = '숏.한국 소식' } = {}) {
  const siteOrigin = getSiteOrigin();
  const body = normalizeMailBody(mainContent);

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;line-height:1.6;color:#333333;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f4f6f9;">
<tr><td style="padding:20px 0;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin:0 auto;background-color:#ffffff;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.08);overflow:hidden;">
    <tr><td style="background:linear-gradient(135deg,#5e69eb 0%,#7c5cbf 100%);padding:28px 24px;text-align:center;">
      <a href="${escapeHtml(siteOrigin)}/" target="_blank" style="text-decoration:none;color:#ffffff;font-size:28px;font-weight:800;letter-spacing:-0.02em;">숏.한국</a>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">한국어 URL 단축 서비스</p>
    </td></tr>
    <tr><td style="padding:28px 24px;">
      ${body}
    </td></tr>
    <tr><td style="background-color:#1f2937;padding:32px 24px;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        <tr><td style="text-align:center;padding-bottom:20px;">
          <p style="margin:0 0 8px;color:#93c5fd;font-size:16px;font-weight:600;">숏.한국</p>
          <p style="margin:0;color:#e5e7eb;font-size:13px;line-height:1.6;">
            운영자: 박진환<br>문의: hwanys2@naver.com<br>발신: ${escapeHtml(MAIL_FROM_VISIBLE)}
          </p>
        </td></tr>
        <tr><td style="text-align:center;padding-bottom:20px;">
          <a href="${escapeHtml(siteOrigin)}/" target="_blank" style="color:#93c5fd;text-decoration:none;margin:0 12px;font-size:14px;">홈</a>
          <a href="${escapeHtml(siteOrigin)}/guide" target="_blank" style="color:#93c5fd;text-decoration:none;margin:0 12px;font-size:14px;">가이드</a>
          <a href="${escapeHtml(siteOrigin)}/profile" target="_blank" style="color:#93c5fd;text-decoration:none;margin:0 12px;font-size:14px;">수신 설정</a>
        </td></tr>
        <tr><td style="text-align:center;padding-bottom:20px;">
          <div style="background-color:#374151;border-radius:8px;padding:16px;">
            <p style="margin:0 0 8px;color:#fca5a5;font-size:15px;font-weight:600;">구독 관리</p>
            <a href="${escapeHtml(unsubscribeLink)}" style="color:#fca5a5;text-decoration:none;font-weight:500;font-size:14px;">선택 메일 수신 거부하기</a>
            <p style="margin:10px 0 0;color:#9ca3af;font-size:12px;line-height:1.5;">
              필수 안내 메일은 서비스 운영상 수신거부할 수 없습니다.<br>
              수신 설정은 프로필에서도 변경할 수 있습니다.
            </p>
          </div>
        </td></tr>
        <tr><td>
          <div style="background-color:#374151;border-radius:8px;padding:16px;">
            <p style="margin:0 0 10px;color:#e5e7eb;font-size:13px;font-weight:600;">이메일 전송 정보</p>
            <p style="margin:0 0 6px;color:#9ca3af;font-size:12px;line-height:1.5;"><strong style="color:#d1d5db;">수신 이유:</strong> 숏.한국 회원 서비스 이용을 위해 발송됩니다.</p>
            <p style="margin:0 0 6px;color:#9ca3af;font-size:12px;line-height:1.5;"><strong style="color:#d1d5db;">발송 주소:</strong> ${escapeHtml(MAIL_FROM_VISIBLE)}</p>
            <p style="margin:0 0 6px;color:#9ca3af;font-size:12px;line-height:1.5;"><strong style="color:#d1d5db;">발송 목적:</strong> 서비스 안내, 기능 소식, 운영 공지</p>
            <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.5;"><strong style="color:#d1d5db;">개인정보:</strong> 이메일 주소는 숏.한국 서비스 제공 목적으로만 사용됩니다.</p>
            <p style="margin:14px 0 0;padding-top:12px;border-top:1px solid #4b5563;color:#6b7280;font-size:11px;text-align:center;">
              © ${new Date().getFullYear()} 숏.한국. All rights reserved.<br>
              이 메일은 숏.한국(${escapeHtml(MAIL_FROM_VISIBLE)})에서 발송되었습니다.
            </p>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

export function createMailTransporter() {
  if (!SMTP_USER || !SMTP_PASS) {
    throw new Error('AWS_SES_SMTP_USER and AWS_SES_SMTP_PASS must be configured');
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: false,
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendOneEmail(transporter, { to, subject, html }) {
  await transporter.sendMail({
    from: FROM_HEADER,
    to,
    subject,
    html,
  });
}
