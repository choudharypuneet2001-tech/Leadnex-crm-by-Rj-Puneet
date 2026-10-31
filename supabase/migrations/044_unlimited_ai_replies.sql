-- ============================================================
-- 044_unlimited_ai_replies.sql
--
-- Remove the upper cap on auto_reply_max_per_conversation (was BETWEEN 1 AND 20)
-- and support unlimited continuous conversation (value 0).
-- Also update claim_ai_reply_slot to support max_replies <= 0 as unlimited.
-- ============================================================

ALTER TABLE ai_configs DROP CONSTRAINT IF EXISTS ai_configs_auto_reply_max_per_conversation_check;
ALTER TABLE ai_configs ADD CONSTRAINT ai_configs_auto_reply_max_per_conversation_check CHECK (auto_reply_max_per_conversation >= 0);

CREATE OR REPLACE FUNCTION public.claim_ai_reply_slot(
  conversation_id uuid,
  max_replies integer
)
RETURNS boolean AS $$
  WITH claimed AS (
    UPDATE conversations
    SET ai_reply_count = ai_reply_count + 1
    WHERE id = conversation_id
      AND (max_replies <= 0 OR ai_reply_count < max_replies)
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM claimed);
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.claim_ai_reply_slot(uuid, integer) TO service_role;

