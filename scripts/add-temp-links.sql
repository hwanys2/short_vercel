-- ============================================
-- 회원 임시 단축 주소 (숏.한국/코드) 대시보드 관리
--
-- 임시 주소는 비회원 링크와 같은 네임스페이스(user_id IS NULL, user_code_id IS NULL)에
-- 저장되어 리다이렉트/만료 정리 로직을 그대로 재사용한다.
-- 누가 만들었는지는 created_by_user_id 로 기록하여 대시보드 목록·수정·삭제에 사용한다.
--   - 본인 코드(영구) 링크: user_id = created_by_user_id = 회원 id
--   - 임시 주소:            user_id = NULL, created_by_user_id = 회원 id
--   - 비회원 링크:          user_id = NULL, created_by_user_id = NULL
-- ============================================

-- 1. 생성자 컬럼 (계정 삭제 시 함께 삭제)
ALTER TABLE short_urls
  ADD COLUMN IF NOT EXISTS created_by_user_id BIGINT REFERENCES short_users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_short_urls_created_by_user_id
  ON short_urls (created_by_user_id)
  WHERE created_by_user_id IS NOT NULL;

-- 2. 기존 회원 링크 백필
UPDATE short_urls
SET created_by_user_id = user_id
WHERE user_id IS NOT NULL
  AND created_by_user_id IS NULL;

-- 3. 트리거: user_id 가 있는데 created_by_user_id 가 비어 있으면 자동 채움 (구버전 앱/외부 API 호환)
CREATE OR REPLACE FUNCTION fill_short_url_created_by()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND NEW.created_by_user_id IS NULL THEN
    NEW.created_by_user_id := NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_fill_short_url_created_by ON short_urls;
CREATE TRIGGER trigger_fill_short_url_created_by
  BEFORE INSERT OR UPDATE OF user_id, created_by_user_id ON short_urls
  FOR EACH ROW
  EXECUTE FUNCTION fill_short_url_created_by();
