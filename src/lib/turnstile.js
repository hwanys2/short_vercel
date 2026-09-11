/**
 * Cloudflare Turnstile 서버 사이드 토큰 검증
 * @param {string} token - 클라이언트가 전송한 cf-turnstile-response 토큰
 * @param {string} remoteIp - 클라이언트 IP 주소
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function verifyTurnstileToken(token, remoteIp) {
  const secretKey = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY?.trim();

  // 환경변수가 미설정된 경우(로컬 개발 또는 키 발급 전): 무조건 통과(Bypass)
  if (!secretKey) {
    return { success: true };
  }

  if (!token) {
    return { success: false, error: '보안 확인(Turnstile)을 완료해주세요.' };
  }

  try {
    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', token);
    if (remoteIp && remoteIp !== 'unknown') {
      formData.append('remoteip', remoteIp);
    }

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const data = await res.json();
    if (data.success) {
      return { success: true };
    }

    console.warn('Turnstile verification failed:', data['error-codes']);
    return { success: false, error: '보안 검증에 실패했습니다. 다시 시도해주세요.' };
  } catch (err) {
    console.error('Turnstile verification network error:', err);
    // 검증 서버 통신 장애 시 정상 사용자가 차단되는 것을 방지하기 위해 통과 처리
    return { success: true };
  }
}
