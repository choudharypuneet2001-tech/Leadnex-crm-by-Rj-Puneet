-- ============================================================
-- 049_multi_workspace_switcher.sql — Multi-workspace switching & isolation
--
-- Drops the single-account-per-owner constraint on accounts,
-- allowing organizations to create and manage multiple dedicated
-- workspaces (e.g. Marketing/Ads with AI, Clinic Billing with human chat,
-- regional branches).
--
-- Data isolation (contacts, conversations, messages, broadcasts,
-- whatsapp_config, ai_configs) remains 100% strictly enforced
-- by account_id via Postgres Row Level Security (RLS).
-- ============================================================

-- Drop the one-account-per-owner unique index if present,
-- allowing owners to operate multiple workspaces under one login.
DROP INDEX IF EXISTS idx_accounts_one_per_owner;

-- Recreate as a non-unique lookup index for fast queries
CREATE INDEX IF NOT EXISTS idx_accounts_owner_user_id
  ON accounts(owner_user_id);
