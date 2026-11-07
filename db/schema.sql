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
