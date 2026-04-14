-- One-off repair after visits were corrupted (NaN/NULL) by member redirect bug.
-- Run once in Supabase SQL Editor if dashboard shows empty click counts.
UPDATE short_urls SET visits = 0 WHERE visits IS NULL;
