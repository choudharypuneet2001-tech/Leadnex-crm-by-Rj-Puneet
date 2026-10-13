-- ============================================================
-- 043_add_gemini_groq_ai_providers.sql
-- Expand AI providers to include 'gemini' (Google AI) and 'groq'.
--
-- Safe and idempotent: drops existing check constraints and replaces
-- them with the expanded provider list.
-- ============================================================

-- 1. Relax provider check on ai_configs
ALTER TABLE ai_configs
  DROP CONSTRAINT IF EXISTS ai_configs_provider_check;

ALTER TABLE ai_configs
  ADD CONSTRAINT ai_configs_provider_check
  CHECK (provider IN ('openai', 'anthropic', 'gemini', 'groq'));

-- 2. Relax provider check on ai_usage_log
ALTER TABLE ai_usage_log
  DROP CONSTRAINT IF EXISTS ai_usage_log_provider_check;

ALTER TABLE ai_usage_log
  ADD CONSTRAINT ai_usage_log_provider_check
  CHECK (provider IN ('openai', 'anthropic', 'gemini', 'groq'));
