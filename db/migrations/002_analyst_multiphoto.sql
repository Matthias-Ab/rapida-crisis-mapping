-- Add analyst workflow columns
ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS analyst_notes    TEXT,
  ADD COLUMN IF NOT EXISTS verified_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS additional_photos TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS reports_is_verified_idx ON reports(is_verified);
CREATE INDEX IF NOT EXISTS reports_is_flagged_idx  ON reports(is_flagged);
