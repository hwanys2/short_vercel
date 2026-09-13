-- ============================================
-- 본인코드 다중 소유 (short_user_codes)
-- 계정당 기본 최대 2개, 추후 max_codes로 상향 가능
-- ============================================

-- 1. short_users.max_codes
ALTER TABLE short_users
  ADD COLUMN IF NOT EXISTS max_codes INTEGER NOT NULL DEFAULT 2;

-- 2. short_user_codes 테이블
CREATE TABLE IF NOT EXISTS short_user_codes (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES short_users(id) ON DELETE CASCADE,
  username VARCHAR(50) NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  username_changed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS short_user_codes_username_key
  ON short_user_codes (username);

CREATE UNIQUE INDEX IF NOT EXISTS idx_short_user_codes_primary
  ON short_user_codes (user_id)
  WHERE is_primary = TRUE;

CREATE INDEX IF NOT EXISTS idx_short_user_codes_user_id
  ON short_user_codes (user_id);

-- 3. 기존 short_users → primary 코드 백필
INSERT INTO short_user_codes (user_id, username, is_primary, username_changed_at, created_at)
SELECT
  u.id,
  u.username,
  TRUE,
  u.username_changed_at,
  COALESCE(u.created_at, NOW())
FROM short_users u
WHERE NOT EXISTS (
  SELECT 1 FROM short_user_codes c WHERE c.user_id = u.id AND c.is_primary = TRUE
)
AND NOT EXISTS (
  SELECT 1 FROM short_user_codes c2 WHERE c2.username = u.username
);

-- 4. short_urls.user_code_id (ON DELETE NO ACTION — 기본)
ALTER TABLE short_urls
  ADD COLUMN IF NOT EXISTS user_code_id BIGINT REFERENCES short_user_codes(id);

-- 회원 링크 → primary 코드로 백필
UPDATE short_urls su
SET user_code_id = c.id
FROM short_user_codes c
WHERE su.user_id IS NOT NULL
  AND su.user_code_id IS NULL
  AND c.user_id = su.user_id
  AND c.is_primary = TRUE;

-- 5. 유니크 인덱스 교체: (code, user_id) → (code, user_code_id)
DROP INDEX IF EXISTS idx_short_urls_code_user;

CREATE UNIQUE INDEX IF NOT EXISTS idx_short_urls_code_user_code
  ON short_urls (code, user_code_id)
  WHERE user_code_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_short_urls_user_code_id
  ON short_urls (user_code_id);

-- 6. CHECK: user_id / user_code_id null 동시성
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'short_urls_user_code_null_check'
  ) THEN
    ALTER TABLE short_urls
      ADD CONSTRAINT short_urls_user_code_null_check
      CHECK ((user_id IS NULL) = (user_code_id IS NULL));
  END IF;
END $$;

-- 7. 트리거: short_users → primary short_user_codes 동기화 (단방향)
CREATE OR REPLACE FUNCTION sync_primary_user_code()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO short_user_codes (user_id, username, is_primary, username_changed_at, created_at)
    VALUES (NEW.id, NEW.username, TRUE, NEW.username_changed_at, COALESCE(NEW.created_at, NOW()));
    RETURN NEW;
  END IF;

  IF NEW.username IS DISTINCT FROM OLD.username
     OR NEW.username_changed_at IS DISTINCT FROM OLD.username_changed_at THEN
    UPDATE short_user_codes
    SET
      username = NEW.username,
      username_changed_at = NEW.username_changed_at
    WHERE user_id = NEW.id
      AND is_primary = TRUE;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_primary_user_code_insert ON short_users;
CREATE TRIGGER trigger_sync_primary_user_code_insert
  AFTER INSERT ON short_users
  FOR EACH ROW
  EXECUTE FUNCTION sync_primary_user_code();

DROP TRIGGER IF EXISTS trigger_sync_primary_user_code_update ON short_users;
CREATE TRIGGER trigger_sync_primary_user_code_update
  AFTER UPDATE OF username, username_changed_at ON short_users
  FOR EACH ROW
  EXECUTE FUNCTION sync_primary_user_code();

-- 8. 트리거: short_urls INSERT 시 user_code_id 자동 채움 (구버전 앱 호환)
CREATE OR REPLACE FUNCTION fill_short_url_user_code_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND NEW.user_code_id IS NULL THEN
    SELECT id INTO NEW.user_code_id
    FROM short_user_codes
    WHERE user_id = NEW.user_id AND is_primary = TRUE
    LIMIT 1;

    IF NEW.user_code_id IS NULL THEN
      RAISE EXCEPTION 'primary user code not found for user_id %', NEW.user_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_fill_short_url_user_code_id ON short_urls;
CREATE TRIGGER trigger_fill_short_url_user_code_id
  BEFORE INSERT ON short_urls
  FOR EACH ROW
  EXECUTE FUNCTION fill_short_url_user_code_id();

-- 9. RPC: 원자적 코드 추가
CREATE OR REPLACE FUNCTION add_user_code(p_user_id BIGINT, p_username VARCHAR)
RETURNS short_user_codes
LANGUAGE plpgsql
AS $$
DECLARE
  v_max INTEGER;
  v_count INTEGER;
  v_row short_user_codes;
BEGIN
  SELECT max_codes INTO v_max
  FROM short_users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'user not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM short_user_codes
  WHERE user_id = p_user_id;

  IF v_count >= v_max THEN
    RAISE EXCEPTION 'code limit reached' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO short_user_codes (user_id, username, is_primary, created_at)
  VALUES (p_user_id, p_username, FALSE, NOW())
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- 10. RLS
ALTER TABLE short_user_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service can manage user codes" ON short_user_codes;
CREATE POLICY "Service can manage user codes" ON short_user_codes FOR ALL USING (true);
