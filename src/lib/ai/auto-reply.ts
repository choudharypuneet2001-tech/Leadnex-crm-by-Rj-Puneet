import { supabaseAdmin } from './admin-client'
import { loadAiConfig } from './config'
import { buildConversationContext } from './context'
import { retrieveKnowledge } from './knowledge'
import { generateReply } from './generate'
import { buildSystemPrompt } from './defaults'
import { buildHandoffSummary } from './handoff'
import { logAiUsage } from './usage'
import { latestUserMessage, isGreetingOrAdClick } from './query'
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
  /** True when inbound was triggered from an ad referral */
  isAdReferral?: boolean
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

    // Rapid-message burst debounce:
    // When a customer sends 2-3 short messages back-to-back (e.g. within ~1.2s),
    // wait briefly so older webhooks yield to the latest message, which responds
    // to the full accumulated context in a single, coherent turn.
    if (inboundMessageId && process.env.NODE_ENV !== 'test') {
      await new Promise((r) => setTimeout(r, 1200))

      const { data: latestInbound } = await db
        .from('messages')
        .select('message_id')
        .eq('conversation_id', conversationId)
        .eq('sender_type', 'customer')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (latestInbound?.message_id && latestInbound.message_id !== inboundMessageId) {
        return
      }
    }

    // Parallelize pre-checks for minimum latency: automations, conversation status,
    // recent context messages, contact details, and account name are fetched simultaneously.
    const [autoRespondersRes, convRes, messages, contactRes, accountRes] = await Promise.all([
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
        .select('id, name, company, phone, ad_name, ad_id')
        .eq('id', contactId)
        .maybeSingle(),
      db
        .from('accounts')
        .select('name')
        .eq('id', accountId)
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
    const userMsg = latestUserMessage(messages)

    // Ground the reply in the account's knowledge base (best-effort).
    // Greetings and ad clicks automatically take the 0ms fast-path!
    const knowledge = await retrieveKnowledge(
      db,
      accountId,
      config,
      userMsg,
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

    const { text, handoff, usage, contactUpdate, bookingConfirmed } = await generateReply({
      config,
      systemPrompt,
      messages,
    })

    // If contact name or city was extracted, update the contact record
    const extractedName = contactUpdate?.name || bookingConfirmed?.patient_name
    const extractedCity = contactUpdate?.city || bookingConfirmed?.city
    if (extractedName || extractedCity) {
      try {
        const updatePayload: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        }
        if (extractedName && (!contact?.name || contact.name.trim() === '')) {
          updatePayload.name = extractedName
        }
        if (extractedCity && (!contact?.company || contact.company.trim() === '')) {
          updatePayload.company = extractedCity
        }
        if (Object.keys(updatePayload).length > 1) {
          if (extractedCity) {
            const res = await db
              .from('contacts')
              .update({ ...updatePayload, city: extractedCity })
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

    let assignedQueryId: string | null = null

    // If an appointment booking was confirmed by the assistant, save it to `bookings`
    if (bookingConfirmed) {
      try {
        assignedQueryId = await getNextBookingQueryId(db, accountId)
        const queryId = assignedQueryId

        const patientName =
          bookingConfirmed.patient_name?.trim() || contact?.name || 'Patient'
        const phone =
          bookingConfirmed.phone?.trim() || contact?.phone || ''
        const city =
          bookingConfirmed.city?.trim() || contact?.company || ''
        const preferredDate = normalizePreferredDate(bookingConfirmed.preferred_date)
        const preferredTime = bookingConfirmed.preferred_time?.trim() || ''
        const rawHealthConcern = bookingConfirmed.health_concern?.trim() || ''
        const healthConcern =
          rawHealthConcern && !rawHealthConcern.includes('[') && !rawHealthConcern.toLowerCase().includes('yahan')
            ? rawHealthConcern
            : (contact?.ad_name ? `Consultation for ${contact.ad_name}` : 'Women Reproductive Health & Ayurvedic Care')

        const consultationType =
          bookingConfirmed.consultation_type?.toLowerCase().includes('clinic')
            ? 'clinic_visit'
            : 'video_consultation'

        const clinicLocation = bookingConfirmed.clinic_location?.trim() || null
        const notes = bookingConfirmed.age ? `Age: ${bookingConfirmed.age}` : null

        const { error: bookingErr } = await db.from('bookings').insert({
          account_id: accountId,
          contact_id: contactId,
          conversation_id: conversationId,
          booking_query_id: queryId,
          patient_name: patientName,
          phone: phone,
          city: city,
          preferred_date: preferredDate,
          preferred_time: preferredTime,
          health_concern: healthConcern,
          consultation_type: consultationType,
          clinic_location: clinicLocation,
          ad_name: contact?.ad_name || null,
          ad_id: contact?.ad_id || null,
          notes: notes,
          status: 'confirmed',
        })

        if (bookingErr) {
          console.error('[ai auto-reply] failed to record booking:', bookingErr)
        } else {
          console.log(`[ai auto-reply] recorded booking ${queryId} for contact ${contactId}`)
        }
      } catch (bookingSaveErr) {
        console.warn('[ai auto-reply] booking save exception:', bookingSaveErr)
      }
    }

    // Record token spend on the account's BYO key. Fire-and-forget so it
    // never adds latency to the customer-facing send: `logAiUsage`
    // swallows its own errors, so the floating promise can't reject.
    void logAiUsage(db, {
      accountId,
      conversationId,
      mode: 'auto_reply',
      provider: config.provider,
      model: config.model,
      usage,
    })

    let replyText = text?.trim() ?? ''

    // If a booking was confirmed, ensure the reply text has the exact assigned sequential ID
    if (assignedQueryId) {
      replyText = replyText.replace(/#GYN-[A-Za-z0-9_-]+/gi, assignedQueryId)
    }

    // Clean up any stray template placeholders so patients never see developer notes
    replyText = replyText.replace(/\s*\(yahan aapka health concern[\s\S]*?\)/gi, '')
    replyText = replyText.replace(/\[(?:Takleef|Concern|Takleef\/Concern|Health Concern|Actual Takleef|Actual Problem)\]/gi, contact?.ad_name || 'Ayurvedic Health Consultation')
    replyText = replyText.replace(/\[(?:Patient Name|Naam|Actual Patient Name)\]/gi, contact?.name || 'Patient')
    replyText = replyText.replace(/\[(?:Random 4 digits|Random 4 Digits|\.\.\.|XXXX)\]/gi, (assignedQueryId || '#GYN-001').replace('#GYN-', ''))
    replyText = replyText.replace(/\[(?:Actual Age \/ Umar|Actual Age|Age)\]/gi, bookingConfirmed?.age || '')
    replyText = replyText.replace(/\[(?:Actual Phone|Phone)\]/gi, contact?.phone || '')
    replyText = replyText.replace(/\[(?:Actual City|City)\]/gi, contact?.company || '')

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
        'Namaskar, Gynocci Femtech Ltd. mein aapka swagat hai! Kaise hain aap? Bataiye main aapki kya sahayta kar sakti hoon? 🙏'
    }

    // Pre-send guard: if another inbound arrived from the customer while the LLM was
    // generating, abort this send so we do not send an outdated reply or collide with the newer message.
    if (inboundMessageId && process.env.NODE_ENV !== 'test') {
      const { data: latestInbound } = await db
        .from('messages')
        .select('message_id')
        .eq('conversation_id', conversationId)
        .eq('sender_type', 'customer')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (latestInbound?.message_id && latestInbound.message_id !== inboundMessageId) {
        console.log(
          `[ai auto-reply] skipping send for ${inboundMessageId} because newer customer message ${latestInbound.message_id} arrived`,
        )
        return
      }
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
        // Natural 150ms pause between message chunks so WhatsApp delivers
        // and displays them in exact sequential order without unnecessary delay.
        await new Promise((r) => setTimeout(r, 150))
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

/**
 * Calculates the next sequential booking query ID for an account, e.g. #GYN-001, #GYN-002...
 */
export async function getNextBookingQueryId(
  db: ReturnType<typeof supabaseAdmin>,
  accountId: string,
): Promise<string> {
  try {
    const { data } = await db
      .from('bookings')
      .select('booking_query_id')
      .eq('account_id', accountId)

    let maxNum = 0
    if (data && data.length > 0) {
      for (const b of data) {
        const qId = b.booking_query_id || ''
        const match = qId.match(/^#GYN-(\d+)$/i)
        if (match) {
          const n = parseInt(match[1], 10)
          // Exclude legacy static test placeholder IDs like 1234 or 1492 if we are in series mode
          if (n !== 1234 && n !== 1492 && n < 1000) {
            if (n > maxNum) maxNum = n
          }
        }
      }
      if (maxNum === 0) {
        maxNum = data.length
      }
    }
    const nextNum = maxNum + 1
    return `#GYN-${String(nextNum).padStart(3, '0')}`
  } catch (err) {
    console.warn('[ai auto-reply] error computing next booking ID:', err)
    return `#GYN-001`
  }
}

/**
 * Normalizes relative conversational dates like "aaj", "kal", "parso" into real calendar dates in IST.
 */
export function normalizePreferredDate(inputDate?: string | null): string {
  if (!inputDate || !inputDate.trim()) return ''
  const trimmed = inputDate.trim()
  const lower = trimmed.toLowerCase()

  // Asia/Kolkata date
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  })
  const parts = formatter.formatToParts(now)
  let year = now.getFullYear()
  let month = now.getMonth() + 1
  let day = now.getDate()
  for (const p of parts) {
    if (p.type === 'year') year = parseInt(p.value, 10)
    if (p.type === 'month') month = parseInt(p.value, 10)
    if (p.type === 'day') day = parseInt(p.value, 10)
  }
  const todayIST = new Date(year, month - 1, day)

  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ]
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  const formatDate = (d: Date) => {
    return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()} (${DAYS[d.getDay()]})`
  }

  if (lower === 'aaj' || lower === 'today') {
    return `${formatDate(todayIST)} - Aaj`
  }
  if (lower === 'kal' || lower === 'tomorrow') {
    const tom = new Date(todayIST)
    tom.setDate(tom.getDate() + 1)
    return `${formatDate(tom)} - Kal`
  }
  if (lower === 'parso' || lower === 'parson' || lower === 'day after tomorrow') {
    const parso = new Date(todayIST)
    parso.setDate(parso.getDate() + 2)
    return `${formatDate(parso)} - Parso`
  }

  if (/\bparso\b/i.test(lower)) {
    const parso = new Date(todayIST)
    parso.setDate(parso.getDate() + 2)
    return `${formatDate(parso)} (${trimmed})`
  }
  if (/\bkal\b/i.test(lower) && !/\baaj\b/i.test(lower)) {
    const tom = new Date(todayIST)
    tom.setDate(tom.getDate() + 1)
    return `${formatDate(tom)} (${trimmed})`
  }
  if (/\baaj\b/i.test(lower)) {
    return `${formatDate(todayIST)} (${trimmed})`
  }

  return trimmed
}
