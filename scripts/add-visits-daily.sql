-- 일별 방문 집계 (배포 이후부터 적재)
CREATE TABLE IF NOT EXISTS short_url_visits_daily (
  url_id BIGINT NOT NULL REFERENCES short_urls(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (url_id, day)
);

CREATE INDEX IF NOT EXISTS idx_short_url_visits_daily_day
  ON short_url_visits_daily (day);

-- 방문 증가 + KST(Asia/Seoul) 기준 일별 upsert
-- 파라미터명은 컬럼명과 겹치지 않게 p_url_id 사용
DROP FUNCTION IF EXISTS increment_short_url_visits(BIGINT);

CREATE FUNCTION increment_short_url_visits(p_url_id BIGINT)
RETURNS VOID AS $$
DECLARE
  kst_day DATE;
BEGIN
  UPDATE short_urls
  SET visits = COALESCE(visits, 0) + 1, last_visit = NOW()
  WHERE id = p_url_id;

  kst_day := (NOW() AT TIME ZONE 'Asia/Seoul')::date;

  INSERT INTO short_url_visits_daily (url_id, day, count)
  VALUES (p_url_id, kst_day, 1)
  ON CONFLICT (url_id, day)
  DO UPDATE SET count = short_url_visits_daily.count + 1;
END;
$$ LANGUAGE plpgsql;
