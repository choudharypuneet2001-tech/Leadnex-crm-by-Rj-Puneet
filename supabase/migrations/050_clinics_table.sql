-- Migration 050: Clinics Management Table
-- Stores Gynocci physical clinics / branches configured per account.

CREATE TABLE IF NOT EXISTS clinics (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  city TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  landmark TEXT,
  google_maps_url TEXT,
  helpline TEXT DEFAULT '+91 93524 93700',
  timings TEXT DEFAULT '10:00 AM से 6:30 PM (सोमवार से रविवार - सातों दिन खुला)',
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clinics_account_id ON clinics(account_id);
CREATE INDEX IF NOT EXISTS idx_clinics_city ON clinics(city);
CREATE INDEX IF NOT EXISTS idx_clinics_is_active ON clinics(is_active);

ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;

CREATE POLICY clinics_select ON clinics
  FOR SELECT
  USING (is_account_member(account_id));

CREATE POLICY clinics_insert ON clinics
  FOR INSERT
  WITH CHECK (is_account_member(account_id, 'agent'));

CREATE POLICY clinics_update ON clinics
  FOR UPDATE
  USING (is_account_member(account_id, 'agent'));

CREATE POLICY clinics_delete ON clinics
  FOR DELETE
  USING (is_account_member(account_id, 'admin'));

-- Enable realtime on clinics table
ALTER PUBLICATION supabase_realtime ADD TABLE clinics;
