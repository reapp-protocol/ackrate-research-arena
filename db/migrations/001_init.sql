CREATE TABLE IF NOT EXISTS arenas (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  buyer_email TEXT NOT NULL,
  status TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS arenas_updated_at_idx
  ON arenas (updated_at DESC);
