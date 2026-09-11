-- 메일 수신 동의 + 단체 메일 캠페인

ALTER TABLE short_users
  ADD COLUMN IF NOT EXISTS accepts_optional_mail BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_short_users_optional_mail
  ON short_users (accepts_optional_mail)
  WHERE accepts_optional_mail = TRUE;

CREATE TABLE IF NOT EXISTS mailing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by BIGINT NOT NULL REFERENCES short_users(id) ON DELETE CASCADE,
  audience TEXT NOT NULL CHECK (audience IN ('system', 'optional')),
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'preparing', 'queued', 'running', 'paused', 'completed', 'failed', 'cancelled')
  ),
  total_recipients INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  locked_until TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mailing_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES mailing_campaigns(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES short_users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'sending', 'sent', 'failed', 'skipped')
  ),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  last_error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (campaign_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_mailing_campaigns_created
  ON mailing_campaigns (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mailing_campaigns_status_updated
  ON mailing_campaigns (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_mailing_recipients_campaign_status
  ON mailing_recipients (campaign_id, status);

CREATE INDEX IF NOT EXISTS idx_mailing_recipients_stale_sending
  ON mailing_recipients (campaign_id, status, updated_at)
  WHERE status = 'sending';

ALTER TABLE mailing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE mailing_recipients ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE mailing_campaigns FROM anon, authenticated;
REVOKE ALL ON TABLE mailing_recipients FROM anon, authenticated;
GRANT ALL ON TABLE mailing_campaigns TO service_role;
GRANT ALL ON TABLE mailing_recipients TO service_role;
