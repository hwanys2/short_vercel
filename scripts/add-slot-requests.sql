-- ============================================
-- 본인코드 슬롯 SNS 홍보 추가 신청 (short_slot_requests)
-- 사용자 SNS 홍보 링크 제출 및 관리자 승인/반려 관리
-- ============================================

CREATE TABLE IF NOT EXISTS short_slot_requests (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES short_users(id) ON DELETE CASCADE,
  sns_url TEXT NOT NULL,
  memo TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  granted_slots INTEGER NOT NULL DEFAULT 1,
  reviewed_by BIGINT REFERENCES short_users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_short_slot_requests_user_id
  ON short_slot_requests(user_id);

CREATE INDEX IF NOT EXISTS idx_short_slot_requests_status
  ON short_slot_requests(status);

CREATE INDEX IF NOT EXISTS idx_short_slot_requests_created_at
  ON short_slot_requests(created_at DESC);

-- RLS 활성화 및 서비스 정책
ALTER TABLE short_slot_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service can manage slot requests" ON short_slot_requests;
CREATE POLICY "Service can manage slot requests" ON short_slot_requests FOR ALL USING (true);
