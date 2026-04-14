/** 비밀번호 필드: 반각(ASCII 출력 가능) 문자만 유지. 한글 IME로 잘못 입력된 글자 제거 */
export function sanitizeAsciiPasswordInput(value) {
  return value.replace(/[^\x20-\x7E]/g, '');
}
