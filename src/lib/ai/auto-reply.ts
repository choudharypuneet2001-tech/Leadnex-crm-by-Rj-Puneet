import { supabaseAdmin } from './admin-client'
import { loadAiConfig } from './config'
import { buildConversationContext } from './context'
import { retrieveKnowledge } from './knowledge'
import { generateReply } from './generate'
import { buildSystemPrompt } from './defaults'
import { buildHandoffSummary } from './handoff'
import { logAiUsage } from './usage'
import { latestUserMessage } from './query'
import {
  engineSendText,
  loadAccountMetaCredentials,
} from '@/lib/flows/meta-send'
import { sendTypingIndicator } from '@/lib/whatsapp/meta-api'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { splitIntoWhatsAppChunks } from './split-messages'

interface DispatchArgs {
  /** Tenancy key — drives config, contact, and whatsapp_config lookups. */
  accountId: string
  conversationId: string
  contactId: string
  /** The account's WhatsApp config owner, used for the outbound send's
   *  audit columns (mirrors how the flow runner passes it through). */
  configOwnerUserId: string
  /** Meta's wamid of the customer message we're replying to. When set,
   *  a typing indicator (which also marks it read) is shown while the
   *  reply is generated. Optional so older callers keep working. */
  inboundMessageId?: string
}

/**
 * AI auto-reply for a freshly-arrived inbound message.
 *
 * Invoked from the WhatsApp webhook's `after()` block, only when no
 * deterministic flow consumed the message (flows win). Mirrors the flow
 * runner's contract: it owns its try/catch and NEVER throws — a failing
 * or slow LLM call must not affect the webhook's 200 to Meta.
 *
 * Eligibility gates (any → silent no-op):
 *   - AI off / auto-reply disabled for the account
 *   - a human agent is assigned (they own the thread)
 *   - auto-reply was disabled for this conversation (prior handoff)
 *   - the per-conversation reply cap is reached
 *   - there's nothing to reply to
 *
 * The 24h WhatsApp session window is inherently open here — we're
 * reacting to a customer message that just landed — so no separate
 * window check is needed.
 */
export async function dispatchInboundToAiReply(
  args: DispatchArgs,
): Promise<void> {
  const {
    accountId,
    conversationId,
    contactId,
    configOwnerUserId,
    inboundMessageId,
  } = args

  try {
    const db = supabaseAdmin()

    const config = await loadAiConfig(db, accountId)
    if (!config || !config.autoReplyEnabled) return

    // Parallelize pre-checks for minimum latency: automations, conversation status,
    // recent context messages, and contact details are fetched simultaneously.
    const [autoRespondersRes, convRes, messages, contactRes] = await Promise.all([
      db
        .from('automations')
        .select('id')
        .eq('account_id', accountId)
        .eq('is_active', true)
        .in('trigger_type', ['new_message_received', 'keyword_match'])
        .limit(1),
      db
        .from('conversations')
        .select('assigned_agent_id, ai_autoreply_disabled, ai_reply_count')
        .eq('id', conversationId)
        .maybeSingle(),
      buildConversationContext(db, conversationId),
      db
        .from('contacts')
        .select('id, name, company')
        .eq('id', contactId)
        .maybeSingle(),
    ])

    const autoResponders = autoRespondersRes.data
    if (autoResponders && autoResponders.length > 0) return

    const conv = convRes.data
    if (convRes.error || !conv) return
    if (conv.assigned_agent_id) return // a human owns this thread
    if (conv.ai_autoreply_disabled) return // handed off / turned off here

    // 0 or >= 100 indicates Unlimited replies (continuous chatting until manual human takeover)
    const isUnlimited =
      !config.autoReplyMaxPerConversation ||
      config.autoReplyMaxPerConversation <= 0 ||
      config.autoReplyMaxPerConversation >= 100

    if (!isUnlimited && conv.ai_reply_count >= config.autoReplyMaxPerConversation) {
      console.log(
        `[ai auto-reply] reply cap reached for conversation ${conversationId} (${conv.ai_reply_count}/${config.autoReplyMaxPerConversation})`,
      )
      return
    }

    if (messages.length === 0) return

    // Account-wide throttle on the shared BYO key.
    const acctLimit = checkRateLimit(
      `ai-autoreply:${accountId}`,
      RATE_LIMITS.aiAutoReplyAccount,
    )
    if (!acctLimit.success) {
      console.warn(
        `[ai auto-reply] account ${accountId} hit the per-account rate limit — skipping this inbound.`,
      )
      return
    }

    // Fire typing indicator concurrently in the background so it marks the message read
    // and displays "typing…" without blocking the LLM retrieval and generation pipeline.
    if (inboundMessageId) {
      void showTypingIndicator(db, accountId, inboundMessageId)
    }

    const contact = contactRes.data

    // Ground the reply in the account's knowledge base (best-effort).
    // Greetings automatically take the 0ms fast-path!
    const knowledge = await retrieveKnowledge(
      db,
      accountId,
      config,
      latestUserMessage(messages),
    )

    const systemPrompt = buildSystemPrompt({
      userPrompt: config.systemPrompt,
      mode: 'auto_reply',
      knowledge,
      contact: {
        name: contact?.name,
        city: contact?.company,
      },
    })

    const { text, handoff, usage, contactUpdate } = await generateReply({
      config,
      systemPrompt,
      messages,
    })

    // If contact name or city was extracted, update the contact record
    if (contactUpdate && (contactUpdate.name || contactUpdate.city)) {
      try {
        const updatePayload: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        }
        if (contactUpdate.name && (!contact?.name || contact.name.trim() === '')) {
          updatePayload.name = contactUpdate.name
        }
        if (contactUpdate.city && (!contact?.company || contact.company.trim() === '')) {
          updatePayload.company = contactUpdate.city
        }
        if (Object.keys(updatePayload).length > 1) {
          if (contactUpdate.city) {
            const res = await db
              .from('contacts')
              .update({ ...updatePayload, city: contactUpdate.city })
              .eq('id', contactId)
            if (res.error) {
              await db
                .from('contacts')
                .update(updatePayload)
                .eq('id', contactId)
            }
          } else {
            await db
              .from('contacts')
              .update(updatePayload)
              .eq('id', contactId)
          }
        }
      } catch (err) {
        console.warn('[ai auto-reply] failed to update contact with extracted info:', err)
      }
    }

    // Record token spend on the account's BYO key. Fire-and-forget so it
    // never adds latency to the customer-facing send: `logAiUsage`
    // swallows its own errors, so the floating promise can't reject.
    // Logged regardless of handoff — the provider call happened either
    // way.
    void logAiUsage(db, {
      accountId,
      conversationId,
      mode: 'auto_reply',
      provider: config.provider,
      model: config.model,
      usage,
    })

    let replyText = text?.trim() ?? ''

    if (!replyText) {
      if (handoff) {
        // The model explicitly asked for handoff with no text to send
        const summary = buildHandoffSummary({
          messages,
          replyCount: conv.ai_reply_count ?? 0,
        })
        const update: Record<string, unknown> = {
          ai_autoreply_disabled: true,
          ai_handoff_summary: summary,
        }
        if (config.handoffAgentId && !conv.assigned_agent_id) {
          update.assigned_agent_id = config.handoffAgentId
        }
        await db.from('conversations').update(update).eq('id', conversationId)
        return
      }

      // If text was unexpectedly empty but no handoff, provide warm fallback so patient is not left hanging
      replyText =
        'Namaste ji! Main aapki bilkul madad kar sakti hoon. Kripya batayein aapko kis baare mein jaankari chahiye? Humari team aapki poori sahayata karegi. 🙏'
    }

    // Atomically claim a reply slot. For unlimited configs, pass 999999 so it never blocks.
    const maxSlotLimit = isUnlimited ? 999999 : config.autoReplyMaxPerConversation
    const { data: claimed, error: claimErr } = await db.rpc(
      'claim_ai_reply_slot',
      {
        conversation_id: conversationId,
        max_replies: maxSlotLimit,
      },
    )
    if (claimErr) {
      // A real error here (vs. losing the cap race) is almost always a
      // deploy issue — e.g. `claim_ai_reply_slot` not EXECUTE-able by the
      // service role, or the migration not applied. Log it loudly: a
      // silent return makes "auto-reply never fires" undiagnosable.
      console.error('[ai auto-reply] claim_ai_reply_slot failed:', claimErr)
      return
    }
    if (claimed !== true) return // lost the per-conversation cap race

    // Split large paragraphs into 1-4 short, bite-sized messages ("tukde")
    // for natural, easy-to-read WhatsApp chatting.
    const chunks = splitIntoWhatsAppChunks(replyText, 4)
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      if (i > 0) {
        // Natural 400ms pause between message chunks so WhatsApp delivers
        // and displays them in exact sequential order.
        await new Promise((r) => setTimeout(r, 400))
      }
      try {
        await engineSendText({
          accountId,
          userId: configOwnerUserId,
          conversationId,
          contactId,
          text: chunk,
          aiGenerated: true,
        })
      } catch (sendErr) {
        console.error(
          `[ai auto-reply] failed to send message chunk ${i + 1}/${chunks.length}:`,
          sendErr,
        )
        break
      }
    }
  } catch (err) {
    console.error('[ai auto-reply] dispatch failed:', err)
  }
}

/**
 * Best-effort "typing…" for the inbound we're about to answer. Swallows
 * every failure (no WhatsApp config, bad token, Meta 4xx) with a warning
 * — the indicator is cosmetic, the reply is not.
 */
async function showTypingIndicator(
  db: ReturnType<typeof supabaseAdmin>,
  accountId: string,
  inboundMessageId: string,
): Promise<void> {
  try {
    const { phoneNumberId, accessToken } = await loadAccountMetaCredentials(
      db,
      accountId,
    )
    await sendTypingIndicator({
      phoneNumberId,
      accessToken,
      messageId: inboundMessageId,
    })
  } catch (err) {
    console.warn('[ai auto-reply] typing indicator failed (continuing):', err)
  }
}
