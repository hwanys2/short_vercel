-- 본인 코드(username) 변경 쿨다운 추적용
ALTER TABLE short_users
  ADD COLUMN IF NOT EXISTS username_changed_at TIMESTAMPTZ;

COMMENT ON COLUMN short_users.username_changed_at IS
  'Last successful username (short-code prefix) change. NULL means never changed after onboarding.';
