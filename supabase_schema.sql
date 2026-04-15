-- ============================================
-- 숏.한국 Supabase 마이그레이션 SQL
-- 기존 MySQL 데이터를 Supabase(PostgreSQL)로 이전
-- ============================================

-- 1. 사용자 테이블 생성
CREATE TABLE IF NOT EXISTS short_users (
  id BIGSERIAL PRIMARY KEY,
  legacy_id INTEGER UNIQUE,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_short_users_email ON short_users(email);
CREATE INDEX IF NOT EXISTS idx_short_users_username ON short_users(username);

-- 2. URL 테이블 생성
CREATE TABLE IF NOT EXISTS short_urls (
  id BIGSERIAL PRIMARY KEY,
  legacy_id INTEGER UNIQUE,
  original_url TEXT NOT NULL,
  code VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expiration_date TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 week'),
  visits INTEGER DEFAULT 0,
  last_visit TIMESTAMPTZ,
  user_id BIGINT REFERENCES short_users(id) ON DELETE CASCADE,
  -- 회원 단축 URL 비밀번호 보호 (NULL = 비활성)
  link_password_hash TEXT,
  link_password_unlock_version INTEGER NOT NULL DEFAULT 0
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_short_urls_code ON short_urls(code);
CREATE INDEX IF NOT EXISTS idx_short_urls_user_id ON short_urls(user_id);
CREATE INDEX IF NOT EXISTS idx_short_urls_expiration ON short_urls(expiration_date);

-- user_id가 NULL인 경우를 위한 부분 유니크 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS idx_short_urls_code_null_user 
  ON short_urls(code) WHERE user_id IS NULL;

-- user_id가 NOT NULL인 경우의 유니크 제약
CREATE UNIQUE INDEX IF NOT EXISTS idx_short_urls_code_user
  ON short_urls(code, user_id);

-- 3. updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_short_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_short_users_updated_at ON short_users;
CREATE TRIGGER trigger_short_users_updated_at
  BEFORE UPDATE ON short_users
  FOR EACH ROW
  EXECUTE FUNCTION update_short_users_updated_at();

-- 4. 방문 횟수 증가 RPC 함수
CREATE OR REPLACE FUNCTION increment_short_url_visits(url_id BIGINT)
RETURNS VOID AS $$
BEGIN
  UPDATE short_urls 
  SET visits = visits + 1, last_visit = NOW() 
  WHERE id = url_id;
END;
$$ LANGUAGE plpgsql;

-- 5. RLS 정책
ALTER TABLE short_urls ENABLE ROW LEVEL SECURITY;
ALTER TABLE short_users ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (재실행 시 충돌 방지)
DROP POLICY IF EXISTS "Anyone can read urls" ON short_urls;
DROP POLICY IF EXISTS "Service can insert urls" ON short_urls;
DROP POLICY IF EXISTS "Service can update urls" ON short_urls;
DROP POLICY IF EXISTS "Service can delete urls" ON short_urls;
DROP POLICY IF EXISTS "Service can manage users" ON short_users;

-- short_urls: 모든 작업 허용 (API Route에서 service_role 사용)
CREATE POLICY "Anyone can read urls" ON short_urls FOR SELECT USING (true);
CREATE POLICY "Service can insert urls" ON short_urls FOR INSERT WITH CHECK (true);
CREATE POLICY "Service can update urls" ON short_urls FOR UPDATE USING (true);
CREATE POLICY "Service can delete urls" ON short_urls FOR DELETE USING (true);

-- short_users: 모든 작업 허용 (API Route에서 service_role 사용)
CREATE POLICY "Service can manage users" ON short_users FOR ALL USING (true);

-- 6. 만료된 URL 자동 정리 (PostgreSQL cron 또는 Supabase Edge Function 사용)
-- Supabase에서는 pg_cron 확장을 통해 자동 정리 가능
-- SELECT cron.schedule('cleanup-expired-urls', '0 * * * *', $$
--   DELETE FROM short_urls WHERE expiration_date < NOW() AND user_id IS NULL;
-- $$);

-- 기존 DB에 컬럼만 추가할 때 (이미 테이블이 있는 경우)
ALTER TABLE short_urls ADD COLUMN IF NOT EXISTS link_password_hash TEXT;
ALTER TABLE short_urls ADD COLUMN IF NOT EXISTS link_password_unlock_version INTEGER NOT NULL DEFAULT 0;

SELECT 'Supabase 테이블 생성 완료!';
