-- WeWard card trading bot schema

CREATE TABLE IF NOT EXISTS collezioni (
  id   SERIAL PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS annunci (
  id                 SERIAL PRIMARY KEY,
  telegram_user_id   BIGINT      NOT NULL,
  telegram_username  TEXT,
  nickname_weward    TEXT        NOT NULL,
  collezione_id      INTEGER     NOT NULL REFERENCES collezioni(id) ON DELETE CASCADE,
  numero_carta       SMALLINT    NOT NULL CHECK (numero_carta BETWEEN 1 AND 9),
  tipo               TEXT        NOT NULL CHECK (tipo IN ('ho', 'cerco')),
  quantita           SMALLINT    CHECK (quantita > 0),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at         TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days')
);

CREATE TABLE IF NOT EXISTS user_sessions (
  telegram_user_id   BIGINT      PRIMARY KEY,
  telegram_username  TEXT,
  nickname_weward    TEXT,
  state              TEXT        NOT NULL DEFAULT 'idle',
  state_data         JSONB       NOT NULL DEFAULT '{}',
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_annunci_user        ON annunci (telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_annunci_carta       ON annunci (collezione_id, numero_carta, tipo);
CREATE INDEX IF NOT EXISTS idx_annunci_expires     ON annunci (expires_at);

-- Remove expired announcements (call periodically via pg_cron or Edge Function)
-- DELETE FROM annunci WHERE expires_at < now();

-- Seed collections – update names to match the real WeWard ones
INSERT INTO collezioni (nome) VALUES
  ('Primavera'),
  ('Estate'),
  ('Autunno'),
  ('Inverno'),
  ('Speciale')
ON CONFLICT (nome) DO NOTHING;
