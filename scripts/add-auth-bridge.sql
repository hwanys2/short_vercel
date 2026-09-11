-- Supabase Auth 브릿지 컬럼 (운영 DB에서 1회 실행)
-- Dashboard → SQL Editor에서 실행하세요.

ALTER TABLE short_users
  ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_short_users_auth_user_id
  ON short_users(auth_user_id) WHERE auth_user_id IS NOT NULL;

ALTER TABLE short_users ALTER COLUMN password DROP NOT NULL;

ALTER TABLE short_users
  ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 1;
