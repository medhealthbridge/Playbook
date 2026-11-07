-- Playbook application schema (Postgres / Neon).
-- Auth tables ("user", session, account, verification) are created by
-- Better Auth's migrator (scripts/migrate.ts). Everything here is idempotent.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Platform-wide settings editable by the platform admin.
CREATE TABLE IF NOT EXISTS platform_setting (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text REFERENCES "user"(id) ON DELETE SET NULL
);
INSERT INTO platform_setting (key, value) VALUES
  ('booking_fee', '{"type":"percent","percent":3,"min_cents":1000,"max_cents":5000}'),
  ('trial_days', '30')
ON CONFLICT (key) DO NOTHING;

-- A venue (tenant). Players pay the venue directly; Playbook bills the venue
-- its subscription plus per-booking platform fees.
CREATE TABLE IF NOT EXISTS venue (
  id                text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  slug              text NOT NULL UNIQUE,
  name              text NOT NULL,
  area              text NOT NULL,
  address           text NOT NULL,
  city              text NOT NULL DEFAULT 'Metro Manila',
  phone             text,
  description       text,
  business_name     text,
  business_reg_no   text,
  status            text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'active', 'suspended', 'rejected')),
  status_reason     text,
  open_time         time NOT NULL DEFAULT '07:00',
  close_time        time NOT NULL DEFAULT '22:00',
  deposit_percent   int  NOT NULL DEFAULT 50 CHECK (deposit_percent BETWEEN 0 AND 100),
  free_cancel_hours int  NOT NULL DEFAULT 24 CHECK (free_cancel_hours >= 0),
  plan              text NOT NULL DEFAULT 'trial'
                      CHECK (plan IN ('trial', 'manage', 'capture', 'club')),
  trial_ends_at     timestamptz,
  created_by        text REFERENCES "user"(id) ON DELETE SET NULL,
  approved_by       text REFERENCES "user"(id) ON DELETE SET NULL,
  approved_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS venue_status_idx ON venue (status);

-- Who can manage a venue, and how much.
CREATE TABLE IF NOT EXISTS venue_member (
  venue_id   text NOT NULL REFERENCES venue(id) ON DELETE CASCADE,
  user_id    text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('owner', 'manager', 'staff')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (venue_id, user_id)
);
CREATE INDEX IF NOT EXISTS venue_member_user_idx ON venue_member (user_id);

-- Bookable courts, tables and pitches.
CREATE TABLE IF NOT EXISTS resource (
  id                text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  venue_id          text NOT NULL REFERENCES venue(id) ON DELETE CASCADE,
  name              text NOT NULL,
  kind              text NOT NULL CHECK (kind IN ('court', 'table', 'pitch')),
  sports            text[] NOT NULL,
  indoor            boolean NOT NULL DEFAULT true,
  surface           text,
  capacity          int NOT NULL DEFAULT 4 CHECK (capacity > 0),
  hourly_rate_cents int NOT NULL CHECK (hourly_rate_cents >= 0),
  increment_min     int NOT NULL DEFAULT 30 CHECK (increment_min IN (15, 30, 60)),
  min_duration_min  int NOT NULL DEFAULT 60,
  max_duration_min  int NOT NULL DEFAULT 180,
  buffer_min        int NOT NULL DEFAULT 0,
  recording_capable boolean NOT NULL DEFAULT false,
  active            boolean NOT NULL DEFAULT true,
  sort              int NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS resource_venue_idx ON resource (venue_id);

-- Bookings. The exclusion constraint makes double-booking impossible at the
-- database level for active (held / confirmed) bookings.
CREATE TABLE IF NOT EXISTS booking (
  id                 text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  ref                text NOT NULL UNIQUE,
  venue_id           text NOT NULL REFERENCES venue(id) ON DELETE CASCADE,
  resource_id        text NOT NULL REFERENCES resource(id) ON DELETE RESTRICT,
  user_id            text REFERENCES "user"(id) ON DELETE SET NULL,
  customer_name      text NOT NULL,
  customer_email     text,
  customer_phone     text,
  sport              text NOT NULL,
  date               date NOT NULL,
  start_min          int  NOT NULL CHECK (start_min >= 0 AND start_min < 1440),
  end_min            int  NOT NULL CHECK (end_min > start_min AND end_min <= 1440),
  status             text NOT NULL DEFAULT 'held'
                       CHECK (status IN ('held', 'confirmed', 'cancelled', 'completed', 'no_show')),
  hold_expires_at    timestamptz,
  source             text NOT NULL DEFAULT 'online' CHECK (source IN ('online', 'walk_in', 'staff')),
  price_cents        int NOT NULL DEFAULT 0,
  deposit_cents      int NOT NULL DEFAULT 0,
  paid_cents         int NOT NULL DEFAULT 0,
  payment_status     text NOT NULL DEFAULT 'unpaid'
                       CHECK (payment_status IN ('unpaid', 'deposit_paid', 'paid', 'refunded', 'partially_refunded', 'failed')),
  platform_fee_cents int NOT NULL DEFAULT 0,
  notes              text,
  checked_in_at      timestamptz,
  cancelled_at       timestamptz,
  cancel_reason      text,
  created_by         text REFERENCES "user"(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS booking_venue_date_idx ON booking (venue_id, date);
CREATE INDEX IF NOT EXISTS booking_user_idx ON booking (user_id);
DO $$ BEGIN
  ALTER TABLE booking ADD CONSTRAINT booking_no_overlap
    EXCLUDE USING gist (resource_id WITH =, date WITH =, int4range(start_min, end_min) WITH &&)
    WHERE (status IN ('held', 'confirmed'));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- Maintenance and other blocks on a resource.
CREATE TABLE IF NOT EXISTS resource_block (
  id          text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  resource_id text NOT NULL REFERENCES resource(id) ON DELETE CASCADE,
  date        date NOT NULL,
  start_min   int  NOT NULL,
  end_min     int  NOT NULL CHECK (end_min > start_min),
  reason      text NOT NULL,
  created_by  text REFERENCES "user"(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS resource_block_idx ON resource_block (resource_id, date);

-- Every privileged action, for accountability.
CREATE TABLE IF NOT EXISTS audit_log (
  id          bigserial PRIMARY KEY,
  actor_id    text REFERENCES "user"(id) ON DELETE SET NULL,
  action      text NOT NULL,
  target_type text NOT NULL,
  target_id   text,
  meta        jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_log_created_idx ON audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_target_idx ON audit_log (target_type, target_id);

-- ---------------------------------------------------------------- Phase 2
-- Venue payment settings. PayMongo secrets are AES-256-GCM encrypted by the app.
ALTER TABLE venue ADD COLUMN IF NOT EXISTS allow_pay_at_venue boolean NOT NULL DEFAULT true;
ALTER TABLE venue ADD COLUMN IF NOT EXISTS paymongo_public_key text;
ALTER TABLE venue ADD COLUMN IF NOT EXISTS paymongo_secret_enc text;
ALTER TABLE venue ADD COLUMN IF NOT EXISTS paymongo_webhook_id text;
ALTER TABLE venue ADD COLUMN IF NOT EXISTS paymongo_webhook_secret_enc text;
ALTER TABLE venue ADD COLUMN IF NOT EXISTS paymongo_livemode boolean;
ALTER TABLE venue ADD COLUMN IF NOT EXISTS paymongo_connected_at timestamptz;

-- Booking payment tracking.
ALTER TABLE booking ADD COLUMN IF NOT EXISTS pay_method text CHECK (pay_method IN ('online', 'at_venue', 'cash', 'gcash_manual'));
ALTER TABLE booking ADD COLUMN IF NOT EXISTS checkout_session_id text;
ALTER TABLE booking ADD COLUMN IF NOT EXISTS payment_id text;
ALTER TABLE booking ADD COLUMN IF NOT EXISTS refund_cents int NOT NULL DEFAULT 0;
ALTER TABLE booking ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;
CREATE INDEX IF NOT EXISTS booking_checkout_idx ON booking (checkout_session_id);

-- Processed webhook events (idempotency).
CREATE TABLE IF NOT EXISTS payment_event (
  id          text PRIMARY KEY,
  venue_id    text REFERENCES venue(id) ON DELETE CASCADE,
  type        text NOT NULL,
  booking_id  text REFERENCES booking(id) ON DELETE SET NULL,
  payload     jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- Phase 3: billing
-- Plan prices (monthly, centavos) and billing settings, edited by the platform admin.
INSERT INTO platform_setting (key, value) VALUES
  ('plan_prices', '{"manage":0,"capture":0,"club":0}'),
  ('billing', '{"manual_instructions":"","due_days":7}')
ON CONFLICT (key) DO NOTHING;

-- Monthly invoices to venues: subscription + Playbook booking fees for the period.
CREATE TABLE IF NOT EXISTS invoice (
  id                  text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  number              text NOT NULL UNIQUE,
  venue_id            text NOT NULL REFERENCES venue(id) ON DELETE CASCADE,
  period_start        date NOT NULL,
  period_end          date NOT NULL,
  plan                text NOT NULL,
  subscription_cents  int  NOT NULL DEFAULT 0,
  booking_count       int  NOT NULL DEFAULT 0,
  booking_fee_cents   int  NOT NULL DEFAULT 0,
  total_cents         int  NOT NULL,
  status              text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'paid', 'void')),
  due_date            date NOT NULL,
  checkout_session_id text,
  payment_id          text,
  paid_via            text,
  paid_at             timestamptz,
  note                text,
  created_by          text REFERENCES "user"(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (venue_id, period_start)
);
CREATE INDEX IF NOT EXISTS invoice_status_idx ON invoice (status, due_date);

-- When a plan was chosen (trial venues pick a plan before the trial ends).
ALTER TABLE venue ADD COLUMN IF NOT EXISTS plan_chosen_at timestamptz;

-- ---------------------------------------------------------------- Open play (pickleball queue)
CREATE TABLE IF NOT EXISTS open_play_session (
  id             text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  venue_id       text NOT NULL REFERENCES venue(id) ON DELETE CASCADE,
  code           text NOT NULL UNIQUE,
  title          text NOT NULL,
  sport          text NOT NULL DEFAULT 'pickleball',
  date           date NOT NULL,
  start_min      int  NOT NULL,
  end_min        int  NOT NULL CHECK (end_min > start_min),
  court_ids      text[] NOT NULL,
  fee_cents      int  NOT NULL DEFAULT 0,
  max_players    int  NOT NULL DEFAULT 24,
  mode           text NOT NULL DEFAULT 'all_off' CHECK (mode IN ('all_off', 'winners_stay')),
  skill_match    boolean NOT NULL DEFAULT false,
  status         text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'ended', 'cancelled')),
  created_by     text REFERENCES "user"(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS open_play_session_venue_idx ON open_play_session (venue_id, date);

CREATE TABLE IF NOT EXISTS open_play_player (
  id            text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  session_id    text NOT NULL REFERENCES open_play_session(id) ON DELETE CASCADE,
  user_id       text REFERENCES "user"(id) ON DELETE SET NULL,
  name          text NOT NULL,
  skill         text NOT NULL DEFAULT 'intermediate' CHECK (skill IN ('beginner', 'intermediate', 'advanced')),
  status        text NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'waiting', 'playing', 'resting', 'left')),
  queue_at      timestamptz,
  games_played  int NOT NULL DEFAULT 0,
  win_streak    int NOT NULL DEFAULT 0,
  paid_cents    int NOT NULL DEFAULT 0,
  checked_in_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, user_id)
);
CREATE INDEX IF NOT EXISTS open_play_player_queue_idx ON open_play_player (session_id, status, queue_at);

CREATE TABLE IF NOT EXISTS open_play_game (
  id          text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  session_id  text NOT NULL REFERENCES open_play_session(id) ON DELETE CASCADE,
  resource_id text NOT NULL REFERENCES resource(id) ON DELETE CASCADE,
  team_a      text[] NOT NULL,
  team_b      text[] NOT NULL,
  winner      text CHECK (winner IN ('a', 'b')),
  status      text NOT NULL DEFAULT 'playing' CHECK (status IN ('playing', 'done')),
  started_at  timestamptz NOT NULL DEFAULT now(),
  ended_at    timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS open_play_one_game_per_court ON open_play_game (resource_id) WHERE status = 'playing';

ALTER TABLE resource_block ADD COLUMN IF NOT EXISTS open_play_session_id text REFERENCES open_play_session(id) ON DELETE CASCADE;

-- ---------------------------------------------------------------- Open play online fees
ALTER TABLE open_play_player ADD COLUMN IF NOT EXISTS checkout_session_id text;
ALTER TABLE open_play_player ADD COLUMN IF NOT EXISTS payment_id text;
ALTER TABLE open_play_player ADD COLUMN IF NOT EXISTS paid_online boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------- Recurring bookings
CREATE TABLE IF NOT EXISTS booking_series (
  id             text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  venue_id       text NOT NULL REFERENCES venue(id) ON DELETE CASCADE,
  resource_id    text NOT NULL REFERENCES resource(id) ON DELETE CASCADE,
  customer_name  text NOT NULL,
  customer_phone text,
  customer_email text,
  weekday        int  NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_min      int  NOT NULL,
  end_min        int  NOT NULL,
  first_date     date NOT NULL,
  weeks          int  NOT NULL CHECK (weeks BETWEEN 1 AND 52),
  price_cents    int  NOT NULL,
  notes          text,
  status         text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  created_by     text REFERENCES "user"(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE booking ADD COLUMN IF NOT EXISTS series_id text REFERENCES booking_series(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS booking_series_idx ON booking (series_id);

-- ---------------------------------------------------------------- Messaging
CREATE TABLE IF NOT EXISTS booking_message (
  id          bigserial PRIMARY KEY,
  booking_id  text NOT NULL REFERENCES booking(id) ON DELETE CASCADE,
  author_id   text REFERENCES "user"(id) ON DELETE SET NULL,
  author_side text NOT NULL CHECK (author_side IN ('player', 'venue')),
  body        text NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS booking_message_idx ON booking_message (booking_id, created_at);

CREATE TABLE IF NOT EXISTS venue_follower (
  venue_id   text NOT NULL REFERENCES venue(id) ON DELETE CASCADE,
  user_id    text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  email_ok   boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (venue_id, user_id)
);

CREATE TABLE IF NOT EXISTS venue_announcement (
  id         text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  venue_id   text NOT NULL REFERENCES venue(id) ON DELETE CASCADE,
  title      text NOT NULL,
  body       text NOT NULL,
  created_by text REFERENCES "user"(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS venue_announcement_idx ON venue_announcement (venue_id, created_at DESC);
