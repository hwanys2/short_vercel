/** 비회원 단축 코드 재사용 가능까지 남은 시간 (한국어, 대략 표기) */
export function formatKoreanDurationUntil(ms) {
  if (ms <= 0) return '곧';
  let sec = Math.floor(ms / 1000);
  const days = Math.floor(sec / 86400);
  sec %= 86400;
  const hours = Math.floor(sec / 3600);
  sec %= 3600;
  const mins = Math.floor(sec / 60);
  const parts = [];
  if (days > 0) parts.push(`${days}일`);
  if (hours > 0) parts.push(`${hours}시간`);
  if (days === 0 && mins > 0) parts.push(`${mins}분`);
  if (parts.length === 0) parts.push('1분 미만');
  return parts.join(' ');
}

export function guestDuplicateCodeMessage(expirationIso) {
  if (!expirationIso) return '이미 사용 중인 단축 코드입니다.';
  const ms = new Date(expirationIso).getTime() - Date.now();
  if (ms <= 0) return '이미 사용 중인 단축 코드입니다.';
  return `이미 사용 중인 단축 코드입니다. 동일 코드로 다시 만들 수 있을 때까지 약 ${formatKoreanDurationUntil(ms)} 남았습니다.`;
}

export function memberDuplicateCodeMessage() {
  return '이미 사용 중인 단축 코드입니다. 내 계정에서 이미 이 코드를 쓰고 있어요. 대시보드에서 삭제한 뒤 다시 만들 수 있습니다.';
}
