ALTER TABLE user_sessions
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

-- status values:
--   pending   → must accept disclaimer
--   active    → fully registered and active
