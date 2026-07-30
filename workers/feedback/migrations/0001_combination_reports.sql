CREATE TABLE IF NOT EXISTS combination_reports (
  id TEXT PRIMARY KEY NOT NULL,
  pair_key TEXT NOT NULL,
  a TEXT NOT NULL CHECK (length(a) BETWEEN 1 AND 28),
  b TEXT NOT NULL CHECK (length(b) BETWEEN 1 AND 28),
  expected TEXT NOT NULL DEFAULT '' CHECK (length(expected) <= 28),
  reason TEXT NOT NULL DEFAULT '',
  mode TEXT NOT NULL,
  reporter_hash TEXT NOT NULL CHECK (length(reporter_hash) = 64),
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  UNIQUE (pair_key, reporter_hash)
);

CREATE INDEX IF NOT EXISTS idx_combination_reports_pair
  ON combination_reports (pair_key);

CREATE INDEX IF NOT EXISTS idx_combination_reports_recent
  ON combination_reports (last_seen_at DESC);
