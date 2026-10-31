-- ============================================================
-- 045_account_suspension_status.sql
--
-- Add status column to accounts table for Super Admin tenant
-- management (hold / suspend / resume / delete companies).
-- ============================================================

ALTER TABLE accounts 
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active' 
  CHECK (status IN ('active', 'suspended', 'cancelled'));

ALTER TABLE accounts 
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);
