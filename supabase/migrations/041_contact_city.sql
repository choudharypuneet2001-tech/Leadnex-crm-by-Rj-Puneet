-- ============================================================
-- 041_contact_city
--
-- Add city column to contacts for patient and customer location tracking.
-- Idempotent and additive only.
-- ============================================================

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS city TEXT;

COMMENT ON COLUMN contacts.city IS
  'City or location of the contact, captured automatically by the AI intake assistant or edited by agents.';
