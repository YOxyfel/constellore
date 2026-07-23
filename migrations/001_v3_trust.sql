BEGIN;

CREATE SCHEMA IF NOT EXISTS constellore;

CREATE TABLE IF NOT EXISTS constellore.schema_migrations (
  version integer PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS constellore.players (
  id uuid PRIMARY KEY,
  callsign text NOT NULL,
  auth_version integer NOT NULL DEFAULT 1 CHECK (auth_version >= 0),
  created_at timestamptz NOT NULL,
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS constellore.device_sessions (
  id uuid PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES constellore.players(id),
  token_digest text NOT NULL UNIQUE,
  device_label text NOT NULL,
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CHECK (expires_at > issued_at)
);
CREATE INDEX IF NOT EXISTS device_sessions_player_idx ON constellore.device_sessions(player_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS constellore.challenge_versions (
  challenge_key text PRIMARY KEY CHECK (challenge_key ~ '^ch3_[A-Za-z0-9_-]{24}$'),
  public_challenge_id text NOT NULL,
  mode text NOT NULL,
  target_key text NOT NULL,
  seed text NOT NULL,
  modifier jsonb NOT NULL,
  graph_version text NOT NULL,
  build_version text NOT NULL,
  rules_version text NOT NULL,
  assistance_class text NOT NULL CHECK (assistance_class IN ('pure', 'open', 'study')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS constellore.ranked_attempts (
  id uuid PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES constellore.players(id),
  challenge_key text NOT NULL REFERENCES constellore.challenge_versions(challenge_key),
  status text NOT NULL CHECK (status IN ('active', 'completed', 'submitted', 'expired', 'forfeited')),
  started_at timestamptz NOT NULL,
  deadline_at timestamptz,
  completed_at timestamptz,
  submitted_at timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  rejected_attempts integer NOT NULL DEFAULT 0 CHECK (rejected_attempts >= 0),
  assist text NOT NULL DEFAULT 'none'
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_ranked_attempt_per_challenge
  ON constellore.ranked_attempts(player_id, challenge_key)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS constellore.run_events (
  id uuid PRIMARY KEY,
  idempotency_key text NOT NULL UNIQUE,
  run_id uuid NOT NULL,
  player_id uuid NOT NULL REFERENCES constellore.players(id),
  challenge_key text REFERENCES constellore.challenge_versions(challenge_key),
  sequence integer NOT NULL CHECK (sequence >= 0),
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL,
  UNIQUE (run_id, sequence)
);

CREATE TABLE IF NOT EXISTS constellore.score_submissions (
  id uuid PRIMARY KEY,
  idempotency_key text NOT NULL UNIQUE,
  run_id uuid NOT NULL UNIQUE,
  player_id uuid NOT NULL REFERENCES constellore.players(id),
  challenge_key text NOT NULL REFERENCES constellore.challenge_versions(challenge_key),
  division text NOT NULL CHECK (division IN ('pure', 'open')),
  score integer NOT NULL CHECK (score >= 0),
  moves integer NOT NULL CHECK (moves >= 0),
  attempts integer NOT NULL CHECK (attempts >= moves),
  rejected_attempts integer NOT NULL CHECK (rejected_attempts >= 0),
  elapsed_ms bigint NOT NULL CHECK (elapsed_ms > 0),
  verification_status text NOT NULL CHECK (verification_status IN ('verified', 'provisional', 'rejected')),
  anomaly_flags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL,
  UNIQUE (player_id, challenge_key, division)
);
CREATE INDEX IF NOT EXISTS verified_score_ladder_idx
  ON constellore.score_submissions(challenge_key, division, score DESC, moves ASC, elapsed_ms ASC)
  WHERE verification_status = 'verified';

CREATE TABLE IF NOT EXISTS constellore.progression_events (
  id uuid PRIMARY KEY,
  idempotency_key text NOT NULL UNIQUE,
  player_id uuid NOT NULL REFERENCES constellore.players(id),
  run_id uuid,
  event_type text NOT NULL,
  atlas_xp integer NOT NULL DEFAULT 0,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS constellore.economy_events (
  id uuid PRIMARY KEY,
  idempotency_key text NOT NULL UNIQUE,
  player_id uuid NOT NULL REFERENCES constellore.players(id),
  event_type text NOT NULL,
  currency text NOT NULL,
  amount bigint NOT NULL,
  related_event_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS constellore.entitlement_events (
  id uuid PRIMARY KEY,
  idempotency_key text NOT NULL UNIQUE,
  player_id uuid NOT NULL REFERENCES constellore.players(id),
  product_id text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('grant', 'revoke', 'refund', 'restore')),
  provider text NOT NULL,
  provider_transaction_digest text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS entitlement_provider_event_unique
  ON constellore.entitlement_events(provider, provider_transaction_digest, event_type);

CREATE TABLE IF NOT EXISTS constellore.ai_recipe_proposals (
  proposal_id text PRIMARY KEY,
  pair_fingerprint text NOT NULL,
  ingredient_a text NOT NULL,
  ingredient_b text NOT NULL,
  result_word text NOT NULL,
  emoji text NOT NULL,
  rationale text NOT NULL,
  source text NOT NULL,
  prompt_version text NOT NULL,
  model text NOT NULL,
  provenance text NOT NULL,
  status text NOT NULL CHECK (status IN ('quarantined', 'promoted', 'rejected', 'rolled_back')),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  generated_at timestamptz NOT NULL,
  reviewed_at timestamptz,
  reviewed_by text,
  review_reason text
);

CREATE TABLE IF NOT EXISTS constellore.ai_recipe_review_events (
  id uuid PRIMARY KEY,
  idempotency_key text NOT NULL UNIQUE,
  proposal_id text NOT NULL REFERENCES constellore.ai_recipe_proposals(proposal_id),
  from_status text NOT NULL,
  to_status text NOT NULL,
  reviewer text NOT NULL,
  reason text,
  occurred_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS constellore.analytics_daily_cohorts (
  day date NOT NULL,
  cohort_digest text NOT NULL,
  event_name text NOT NULL,
  event_count integer NOT NULL DEFAULT 0 CHECK (event_count >= 0),
  PRIMARY KEY (day, cohort_digest, event_name)
);

CREATE TABLE IF NOT EXISTS constellore.rejected_pair_expectations (
  pair_fingerprint text PRIMARY KEY,
  reviewed_sample text[],
  report_count integer NOT NULL DEFAULT 0 CHECK (report_count >= 0),
  modes jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_seen_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS constellore.rejected_pair_reporters (
  pair_fingerprint text NOT NULL REFERENCES constellore.rejected_pair_expectations(pair_fingerprint),
  reporter_digest text NOT NULL,
  first_reported_at timestamptz NOT NULL,
  PRIMARY KEY (pair_fingerprint, reporter_digest)
);

CREATE OR REPLACE FUNCTION constellore.reject_ledger_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'append-only ledger rows cannot be updated or deleted';
END;
$$;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['run_events', 'progression_events', 'economy_events', 'entitlement_events', 'ai_recipe_review_events']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS append_only_guard ON constellore.%I', table_name);
    EXECUTE format('CREATE TRIGGER append_only_guard BEFORE UPDATE OR DELETE ON constellore.%I FOR EACH ROW EXECUTE FUNCTION constellore.reject_ledger_mutation()', table_name);
  END LOOP;
END;
$$;

INSERT INTO constellore.schema_migrations(version) VALUES (1)
ON CONFLICT (version) DO NOTHING;

COMMIT;
