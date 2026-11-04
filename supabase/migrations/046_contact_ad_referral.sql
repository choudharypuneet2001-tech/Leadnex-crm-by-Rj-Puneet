-- ============================================================
-- 046_contact_ad_referral
--
-- Track Meta Click-to-WhatsApp (CTWA) Ad referral details on contacts:
-- Ad ID, Ad Name / Headline, Ad Source URL, Ad Body, and Media URL.
-- Idempotent and additive only.
-- ============================================================

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS ad_id TEXT,
  ADD COLUMN IF NOT EXISTS ad_name TEXT,
  ADD COLUMN IF NOT EXISTS ad_source TEXT,
  ADD COLUMN IF NOT EXISTS ad_source_url TEXT,
  ADD COLUMN IF NOT EXISTS ad_body TEXT,
  ADD COLUMN IF NOT EXISTS ad_media_url TEXT;

COMMENT ON COLUMN contacts.ad_id IS 'Meta Ad ID or Post ID from which the contact originated';
COMMENT ON COLUMN contacts.ad_name IS 'Meta Ad headline / title from the Click-to-WhatsApp referral';
COMMENT ON COLUMN contacts.ad_source IS 'Source type, e.g. ad or post';
COMMENT ON COLUMN contacts.ad_source_url IS 'Direct URL or Facebook post URL of the ad';
COMMENT ON COLUMN contacts.ad_body IS 'Body copy / description of the ad';
COMMENT ON COLUMN contacts.ad_media_url IS 'Media image or video URL associated with the ad';

CREATE INDEX IF NOT EXISTS idx_contacts_ad_id ON contacts(ad_id);
