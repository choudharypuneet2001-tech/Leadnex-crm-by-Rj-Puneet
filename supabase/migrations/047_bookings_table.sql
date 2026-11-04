-- Migration 047: Bookings / Appointments Table
-- Tracks patient appointments and consultations booked via AI assistant or staff.

CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  booking_query_id TEXT NOT NULL,
  patient_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  city TEXT,
  preferred_date TEXT,
  preferred_time TEXT,
  health_concern TEXT,
  ad_name TEXT,
  ad_id TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bookings_account_id ON bookings(account_id);
CREATE INDEX IF NOT EXISTS idx_bookings_contact_id ON bookings(contact_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON bookings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_query_id ON bookings(booking_query_id);

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY bookings_select ON bookings
  FOR SELECT
  USING (is_account_member(account_id));

CREATE POLICY bookings_insert ON bookings
  FOR INSERT
  WITH CHECK (is_account_member(account_id, 'agent'));

CREATE POLICY bookings_update ON bookings
  FOR UPDATE
  USING (is_account_member(account_id, 'agent'));

CREATE POLICY bookings_delete ON bookings
  FOR DELETE
  USING (is_account_member(account_id, 'admin'));

-- Enable realtime on bookings table
ALTER PUBLICATION supabase_realtime ADD TABLE bookings;

