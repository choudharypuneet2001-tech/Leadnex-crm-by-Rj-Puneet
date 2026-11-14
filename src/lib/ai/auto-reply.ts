import { supabaseAdmin } from './admin-client'
import { loadAiConfig } from './config'
import { buildConversationContext } from './context'
import { retrieveKnowledge } from './knowledge'
import { generateReply } from './generate'
import { buildSystemPrompt } from './defaults'
import { buildHandoffSummary } from './handoff'
import { logAiUsage } from './usage'
import {
  latestUserMessage,
  isGreetingOrAdClick,
  cleanDisplayName,
  isEnglishMessage,
  isLikelyFemaleName,
} from './query'
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

    // Trace details directly from accumulated chat history
    const tracedCity = extractCityFromMessages(messages)
    const tracedName = extractNameFromMessages(messages)
    const tracedAge = extractAgeFromMessages(messages)
    const tracedPhone = extractPhoneFromMessages(messages)
    const tracedConcern = extractConcernFromMessages(messages)

    // Effective patient name: prefer explicitly stated name from chat; clean profile handle otherwise
    let effectiveName = tracedName || cleanDisplayName(contact?.name) || null
    if (effectiveName && /puneet/i.test(effectiveName) && !tracedName) {
      // Owner testing handle without stating actual patient name yet
      effectiveName = null
    }

    // Effective city: prefer traced city from chat
    let effectiveCity =
      tracedCity ||
      (contact?.company && !contact.company.includes('[') && !contact.company.includes('शहर')
        ? contact.company
        : null) ||
      ((contact as any)?.city && !(contact as any).city.includes('[') ? (contact as any).city : null) ||
      null

    const effectivePhone = tracedPhone || contact?.phone || null

    // Proactively persist extracted name / city to DB so contact profile stays clean & up-to-date
    if (
      (tracedName && tracedName !== contact?.name) ||
      (tracedCity && tracedCity !== contact?.company)
    ) {
      try {
        const updatePayload: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        }
        if (tracedName) updatePayload.name = tracedName
        if (tracedCity) {
          updatePayload.company = tracedCity
          updatePayload.city = tracedCity
        }
        await db.from('contacts').update(updatePayload).eq('id', contactId)
      } catch (err) {
        console.warn('[ai auto-reply] proactive contact update failed:', err)
      }
    }

    // Ground the reply in the account's knowledge base (best-effort).
    // Greetings and ad clicks automatically take the 0ms fast-path!
    const knowledge = await retrieveKnowledge(
      db,
      accountId,
      config,
      userMsg,
    )

    const isEnglish = isEnglishMessage(userMsg)

    const systemPrompt = buildSystemPrompt({
      userPrompt: config.systemPrompt,
      mode: 'auto_reply',
      knowledge,
      contact: {
        name: effectiveName,
        city: effectiveCity,
        age: tracedAge,
        phone: effectivePhone,
        concern: tracedConcern,
      },
      isEnglish,
      latestUserMsg: userMsg,
    })

    const { text, handoff, usage, contactUpdate, bookingConfirmed } = await generateReply({
      config,
      systemPrompt,
      messages,
    })

    // If contact name or city was extracted, update the contact record
    const extractedName = contactUpdate?.name || bookingConfirmed?.patient_name || tracedName
    const extractedCity = contactUpdate?.city || bookingConfirmed?.city || tracedCity
    if (extractedName || extractedCity) {
      try {
        const updatePayload: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        }
        if (extractedName && (!contact?.name || contact.name.trim() === '' || /puneet/i.test(contact.name))) {
          updatePayload.name = extractedName
          effectiveName = extractedName
        }
        if (extractedCity && (!contact?.company || contact.company.trim() === '' || contact.company.includes('['))) {
          updatePayload.company = extractedCity
          effectiveCity = extractedCity
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
          (bookingConfirmed.patient_name && !bookingConfirmed.patient_name.includes('['))
            ? bookingConfirmed.patient_name.trim()
            : (effectiveName || 'Patient')

        const phone =
          (bookingConfirmed.phone && !bookingConfirmed.phone.includes('['))
            ? bookingConfirmed.phone.trim()
            : (effectivePhone || '')

        const rawCity = bookingConfirmed.city?.trim() || ''
        const city =
          rawCity && !rawCity.includes('[') && !rawCity.includes('शहर')
            ? rawCity
            : (effectiveCity || '')

        const preferredDate = normalizePreferredDate(bookingConfirmed.preferred_date)
        const preferredTime = bookingConfirmed.preferred_time?.trim() || ''
        const rawHealthConcern = bookingConfirmed.health_concern?.trim() || ''
        const healthConcern =
          rawHealthConcern && !rawHealthConcern.includes('[') && !rawHealthConcern.toLowerCase().includes('yahan')
            ? rawHealthConcern
            : (tracedConcern || (contact?.ad_name ? `Consultation for ${contact.ad_name}` : 'Women Reproductive Health & Ayurvedic Care'))

        // If city is NOT one of the 9 clinic cities, consultationType MUST BE video_consultation!
        const consultationType =
          isClinicCity(city) && bookingConfirmed.consultation_type?.toLowerCase().includes('clinic')
            ? 'clinic_visit'
            : 'video_consultation'

        const clinicLocation = isClinicCity(city) ? (bookingConfirmed.clinic_location?.trim() || `${city} Clinic`) : null
        const notes = bookingConfirmed.age || tracedAge ? `Age: ${bookingConfirmed.age || tracedAge}` : null

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

    const finalPatientName =
      (bookingConfirmed?.patient_name && !bookingConfirmed.patient_name.includes('['))
        ? bookingConfirmed.patient_name.trim()
        : (effectiveName || 'Patient')
    const finalCity =
      (bookingConfirmed?.city && !bookingConfirmed.city.includes('[') && !bookingConfirmed.city.includes('शहर'))
        ? bookingConfirmed.city.trim()
        : (effectiveCity || '')
    const finalAge = bookingConfirmed?.age || tracedAge || ''
    const finalPhone =
      (bookingConfirmed?.phone && !bookingConfirmed.phone.includes('['))
        ? bookingConfirmed.phone.trim()
        : (effectivePhone || '')
    const finalConcern =
      (bookingConfirmed?.health_concern && !bookingConfirmed.health_concern.includes('['))
        ? bookingConfirmed.health_concern.trim()
        : (tracedConcern || contact?.ad_name || 'Ayurvedic Health Consultation')

    // If a booking was confirmed, ensure the reply text has the exact assigned sequential ID
    if (assignedQueryId) {
      replyText = replyText.replace(/#GYN-[A-Za-z0-9_-]+/gi, assignedQueryId)
    }

    // Clean up any stray template placeholders so patients never see developer notes
    replyText = replyText.replace(/\s*\(yahan aapka health concern[\s\S]*?\)/gi, '')
    replyText = replyText.replace(/\[(?:Takleef|Concern|Takleef\/Concern|Health Concern|Actual Takleef|Actual Problem)\]/gi, finalConcern)
    replyText = replyText.replace(/\[(?:Random 4 digits|Random 4 Digits|\.\.\.|XXXX)\]/gi, (assignedQueryId || '#GYN-001').replace('#GYN-', ''))
    replyText = replyText.replace(/\[(?:Actual Age \/ Umar|Actual Age|Age|Umar)\]/gi, finalAge)
    replyText = replyText.replace(/\[(?:Actual Phone|Phone|Mobile)\]/gi, finalPhone)
    replyText = replyText.replace(/\[(?:Actual City|City|आपका शहर|शहर)\]/gi, finalCity)

    // Clean up any leaked [Name] / [Patient Name] placeholders and ensure gender-aware titles
    if (effectiveName) {
      const isFemale = isLikelyFemaleName(effectiveName)
      const honorific = isFemale ? "Ma'am" : 'Sir'
      replyText = replyText.replace(/\[?(?:Name|Patient Name|Naam|Actual Name|Actual Patient Name|Patient)\]\s*(?:Sir\s*\/\s*Ma'am|Sir|Ma'am)/gi, `${effectiveName} ${honorific}`)
      replyText = replyText.replace(/\[?(?:Name|Patient Name|Naam|Actual Name|Actual Patient Name|Patient)\]\s*जी?/gi, `${effectiveName} जी`)
      replyText = replyText.replace(/\bName\s*जी\b/gi, `${effectiveName} जी`)
    } else {
      // If name is unknown, completely remove [Name] जी and fix punctuation
      replyText = replyText.replace(/,\s*\[?(?:Name|Patient Name|Naam|Actual Name|Actual Patient Name|Patient)\]\s*जी?!?/gi, '!')
      replyText = replyText.replace(/\[?(?:Name|Patient Name|Naam|Actual Name|Actual Patient Name|Patient)\]\s*जी?!?/gi, '')
      replyText = replyText.replace(/\bName\s*जी\b/gi, '')
      replyText = replyText.replace(/धन्यवाद,\s*!/gi, 'धन्यवाद!')
      replyText = replyText.replace(/,\s*!/g, '!')
    }

    // Ongoing chat: strip repeated first greeting if model emitted it mid-chat
    const userMessagesCount = messages.filter((m) => m.role === 'user').length
    if (userMessagesCount > 1) {
      replyText = replyText.replace(
        /^(?:नमस्ते!\s*Gynocci\s*Femtech\s*में\s*आपका\s*स्वागत\s*है।?\s*(?:🙏)?\s*(?:---\n*)?)/gi,
        '',
      )
      replyText = replyText.replace(
        /^(?:Hello!\s*Welcome\s*to\s*Gynocci\s*Femtech\.?\s*(?:🙏)?\s*(?:---\n*)?)/gi,
        '',
      )
      replyText = replyText.trim()
    }

    // If English was requested or inbound was English, prevent refusal or Hindi fallback
    if (isEnglish) {
      replyText = replyText.replace(
        /(?:मैं हिंदी में ही बात कर सकती हूँ|main hindi me hi baat kar sakti hoon|i can only speak hindi)[^.\n]*[.\n]?/gi,
        'Yes, absolutely! I would be glad to assist you in English. How may I help you today?',
      )
    }

    // Mandatory Appointment Booking Name Intake phrasing
    replyText = replyText.replace(
      /क्या मैं आपका शुभ नाम जान सकती हूँ\?\s*(?:ताकि मैं अपॉइंटमेंट बुक कर सकूँ)?/gi,
      'आप किसके नाम से अपॉइंटमेंट बुक करवाना चाहते हैं, कृपया उनका नाम बताएं?',
    )

    // Strict City line cleanup in confirmation receipt
    if (finalCity) {
      replyText = replyText.replace(/📍\s*City:\s*\[?(?:आपका शहर|शहर|Actual City|City)?\]?/gi, `📍 City: ${finalCity}`)
    }

    // If city is a clinic city (e.g. Jaipur), ensure we NEVER unilaterally pitch video consultation
    if (finalCity && isClinicCity(finalCity)) {
      replyText = replyText.replace(
        /(?:इसके बाद\s*)?मैं आपकी ऑनलाइन वीडियो कंसल्टेशन की व्यवस्था कर दूंगी\.?/gi,
        `क्या आप हमारे ${finalCity} क्लीनिक में विज़िट करना चाहेंगे या ऑनलाइन परामर्श लेना चाहेंगे?`,
      )
      replyText = replyText.replace(
        /उसके आधार पर,\s*मैं आपको ऑनलाइन वीडियो कंसल्टेशन की व्यवस्था कर दूंगी\.?/gi,
        `ताकि हम आपको उचित क्लीनिक विज़िट अथवा ऑनलाइन परामर्श की सुविधा दे सकें।`,
      )
    }

    // If city is not a clinic city, make sure the consultation type in the receipt is video consultation
    if (finalCity && !isClinicCity(finalCity)) {
      replyText = replyText.replace(
        /🏥\s*Consultation Type:\s*Clinic Visit[^\n]*/gi,
        '🏥 Consultation Type: Online Video Consultation (45 Min Dedicated Session)',
      )
    }

    // If patient stated their name (e.g. Rajesh), replace any wrongly output owner name in greeting or congrats
    if (effectiveName && !/puneet/i.test(effectiveName)) {
      replyText = replyText.replace(/Rj Puneet\s*जी/gi, `${effectiveName} जी`)
      replyText = replyText.replace(/Puneet\s*जी/gi, `${effectiveName} जी`)
    }

    // Strict label formatting as required by user
    replyText = replyText.replace(/👤\s*मरीज का नाम:/gi, '👤 Patient Name:')
    replyText = replyText.replace(/🏥\s*परामर्श का प्रकार:/gi, '🏥 Consultation Type:')
    replyText = replyText.replace(/Ab main aapka appointment isi information ke saath book kar rahi hoon\.\s*Aapki booking successful hone ke baad,?\s*aapko confirmation detail mil jayegi\.\s*Ab thoda intezaar kijiye!?/gi, '')
    replyText = replyText.replace(/Ab thoda intezaar kijiye!?/gi, '')

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

export const CLINIC_CITIES = [
  'Jaipur',
  'Delhi',
  'Lucknow',
  'Amritsar',
  'Ludhiana',
  'Patna',
  'Ranchi',
  'Hisar',
  'Rewari',
] as const

export function isClinicCity(city?: string | null): boolean {
  if (!city) return false
  const c = city.trim().toLowerCase()
  return CLINIC_CITIES.some(
    (cc) => cc.toLowerCase() === c || (c === 'new delhi' && cc === 'Delhi'),
  )
}

const KNOWN_INDIAN_CITIES = [
  'Jaipur', 'Delhi', 'New Delhi', 'Lucknow', 'Amritsar', 'Ludhiana', 'Patna', 'Ranchi', 'Hisar', 'Rewari',
  'Kanpur', 'Bikaner', 'Kota', 'Jodhpur', 'Udaipur', 'Ajmer', 'Sikar', 'Alwar', 'Agra', 'Bareilly',
  'Varanasi', 'Meerut', 'Ghaziabad', 'Noida', 'Gurgaon', 'Gurugram', 'Faridabad', 'Chandigarh',
  'Jalandhar', 'Bathinda', 'Rohtak', 'Panipat', 'Karnal', 'Sonipat', 'Indore', 'Bhopal', 'Gwalior',
  'Jabalpur', 'Raipur', 'Bilaspur', 'Kolkata', 'Ahmedabad', 'Surat', 'Vadodara', 'Rajkot',
  'Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Hyderabad', 'Bengaluru', 'Bangalore', 'Chennai',
  'Dehradun', 'Haridwar', 'Gaya', 'Muzaffarpur', 'Dhanbad', 'Jamshedpur', 'Prayagraj', 'Allahabad',
  'Gorakhpur', 'Ayodhya', 'Mathura', 'Aligarh', 'Moradabad', 'Saharanpur', 'Jhansi',
  'Ujjain', 'Bhilwara', 'Bharatpur', 'Pali', 'Tonk', 'Jhunjhunu', 'Churu', 'Sri Ganganagar'
]

export function extractCityFromMessages(messages: { role: string; content: string }[]): string | null {
  const cityRegexes = [
    /(?:mein\s+to\s+|hum\s+|main\s+|me\s+)?([a-zA-Z\u0900-\u097F]{3,20})\s+se\s+(?:hu|hoon|hai|h|hain|rehta|rehti)\b/i,
    /(?:shehar|city|location|from)\s*(?::|=|-)?\s*([a-zA-Z\u0900-\u097F]{3,20})/i,
    /\b([a-zA-Z\u0900-\u097F]{3,20})\s+se\b/i,
  ]
  const nonCities = new Set([
    'aap', 'yaha', 'waha', 'ghar', 'subah', 'shaam', 'online', 'doctor', 'clinic', 'hospital',
    'mein', 'hum', 'sir', 'maam', 'theek', 'kaha', 'kahan', 'hai', 'paas', 'sabse', 'kripya',
    'shuru', 'bhi', 'kuch', 'bahut', 'pareshan', 'shadi', 'pehle', 'baad', 'conusltation', 'consultation'
  ])

  // Scan user messages in reverse chronological order
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role !== 'user') continue
    const text = messages[i].content.trim()

    // 1. Check known Indian cities with word boundary
    for (const kc of KNOWN_INDIAN_CITIES) {
      const wReg = new RegExp(`\\b${kc}\\b`, 'i')
      if (wReg.test(text)) {
        return kc
      }
    }

    // 2. Check conversational patterns
    for (const reg of cityRegexes) {
      const match = text.match(reg)
      if (match && match[1]) {
        const candidate = match[1].trim()
        if (!nonCities.has(candidate.toLowerCase()) && candidate.length >= 3) {
          return candidate.charAt(0).toUpperCase() + candidate.slice(1)
        }
      }
    }
  }
  return null
}

export function extractNameFromMessages(messages: { role: string; content: string }[]): string | null {
  const nameRegexes = [
    /(?:mera\s+naam|naam|patient\s+name|my\s+name\s+is)\s*(?::|=|-)?\s*([a-zA-Z\u0900-\u097F]+(?:\s+[a-zA-Z\u0900-\u097F]+)?)/i,
  ]
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role !== 'user') continue
    const text = messages[i].content.trim()
    for (const reg of nameRegexes) {
      const match = text.match(reg)
      if (match && match[1]) {
        let name = match[1].trim()
        name = name.replace(/\s+(?:hai|hoon|hu|h|ji)$/i, '').trim()
        if (name.length >= 2 && !/^(kya|bhi|nahi|hai|hu|hoon|theek)$/i.test(name)) {
          return name.charAt(0).toUpperCase() + name.slice(1)
        }
      }
    }
  }
  return null
}

export function extractAgeFromMessages(messages: { role: string; content: string }[]): string | null {
  const ageRegexes = [
    /\b(\d{2})\s*(?:saal|year|years|yr|yrs|umar|age)\b/i,
    /(?:umar|age)\s*(?::|=|-)?\s*(\d{2})\b/i,
    /\b(\d{2})\s*(?:ka\s+hu|ki\s+hu|saal\s+ka)\b/i,
  ]
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role !== 'user') continue
    const text = messages[i].content.trim()
    for (const reg of ageRegexes) {
      const match = text.match(reg)
      if (match && match[1]) {
        const ageNum = parseInt(match[1], 10)
        if (ageNum >= 15 && ageNum <= 90) return match[1]
      }
    }
  }
  return null
}

export function extractPhoneFromMessages(messages: { role: string; content: string }[]): string | null {
  const phoneRegex = /\b([6-9]\d{9})\b/
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role !== 'user') continue
    const text = messages[i].content.trim()
    const match = text.match(phoneRegex)
    if (match && match[1]) return match[1]
  }
  return null
}

export function extractConcernFromMessages(messages: { role: string; content: string }[]): string | null {
  const text = messages
    .filter((m) => m.role === 'user')
    .map((m) => m.content)
    .join(' ')
    .toLowerCase()

  if (/\b(sperm|nil sperm|azoospermia|shukranu)\b/i.test(text)) {
    if (/\b(baccha|conceive|pregnancy)\b/i.test(text)) {
      return 'स्पर्म की कमी एवं गर्भधारण में समस्या (Male Infertility & Difficulty Conceiving)'
    }
    return 'लो स्पर्म काउंट / स्पर्म समस्या (Male Infertility & Low Sperm Count)'
  }
  if (/\b(tube block|tubal block|fallopian)\b/i.test(text)) {
    return 'फैलोपियन ट्यूबल ब्लॉकेज (Fallopian Tubal Blockage)'
  }
  if (/\b(pcod|pcos|irregular period|period)\b/i.test(text)) {
    return 'PCOD / अनियमित पीरियड्स (PCOD & Irregular Periods)'
  }
  if (/\b(miscarriage|garbhpaat|abortion)\b/i.test(text)) {
    return 'बार-बार गर्भपात (Recurrent Miscarriage)'
  }
  if (/\b(low amh|amh)\b/i.test(text)) {
    return 'लो एएमएच (Low AMH)'
  }
  if (/\b(baccha|conceive|infertility|pregnancy|santana)\b/i.test(text)) {
    return 'गर्भधारण न होना / इनफर्टिलिटी (Difficulty Conceiving & Infertility)'
  }
  return null
}
