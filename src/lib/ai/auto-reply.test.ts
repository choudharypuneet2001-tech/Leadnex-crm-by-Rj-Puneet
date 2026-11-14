import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AiConfig } from './types'

// Shared, hoisted mock state so the module mocks can close over it.
const h = vi.hoisted(() => ({
  loadAiConfig: vi.fn(),
  buildConversationContext: vi.fn(),
  retrieveKnowledge: vi.fn(),
  generateReply: vi.fn(),
  engineSendText: vi.fn(),
  loadAccountMetaCredentials: vi.fn(),
  sendTypingIndicator: vi.fn(),
  state: {
    conv: null as Record<string, unknown> | null,
    autoResponders: [] as { id: string }[],
    claim: true as boolean,
    updatePayload: null as Record<string, unknown> | null,
    rpcCalls: [] as { name: string; args: unknown }[],
  },
}))

vi.mock('./config', () => ({ loadAiConfig: h.loadAiConfig }))
vi.mock('./context', () => ({ buildConversationContext: h.buildConversationContext }))
vi.mock('./knowledge', () => ({ retrieveKnowledge: h.retrieveKnowledge }))
vi.mock('./generate', () => ({ generateReply: h.generateReply }))
vi.mock('@/lib/flows/meta-send', () => ({
  engineSendText: h.engineSendText,
  loadAccountMetaCredentials: h.loadAccountMetaCredentials,
}))
vi.mock('@/lib/whatsapp/meta-api', () => ({
  sendTypingIndicator: h.sendTypingIndicator,
}))
vi.mock('./admin-client', () => ({
  supabaseAdmin: () => ({
    from: (table: string) => {
      if (table === 'automations') {
        // .select().eq().eq().in().limit() → active auto-responders
        const chain = {
          select: () => chain,
          eq: () => chain,
          in: () => chain,
          limit: () =>
            Promise.resolve({ data: h.state.autoResponders, error: null }),
        }
        return chain
      }
      if (table === 'contacts') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
          update: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
        }
      }
      // conversations
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({ data: h.state.conv, error: null }),
          }),
        }),
        update: (payload: Record<string, unknown>) => {
          h.state.updatePayload = payload
          return { eq: () => Promise.resolve({ error: null }) }
        },
      }
    },
    rpc: (name: string, args: unknown) => {
      h.state.rpcCalls.push({ name, args })
      return Promise.resolve({ data: h.state.claim, error: null })
    },
  }),
}))

import {
  dispatchInboundToAiReply,
  getNextBookingQueryId,
  normalizePreferredDate,
  extractCityFromMessages,
  extractNameFromMessages,
  extractAgeFromMessages,
  extractPhoneFromMessages,
  extractConcernFromMessages,
  isClinicCity,
} from './auto-reply'

const ARGS = {
  accountId: 'acct-1',
  conversationId: 'conv-1',
  contactId: 'contact-1',
  configOwnerUserId: 'user-1',
  inboundMessageId: 'wamid.inbound-1',
}

function aiConfig(overrides: Partial<AiConfig> = {}): AiConfig {
  return {
    provider: 'openai',
    model: 'gpt-test',
    apiKey: 'sk-test',
    systemPrompt: null,
    isActive: true,
    autoReplyEnabled: true,
    autoReplyMaxPerConversation: 3,
    handoffAgentId: null,
    embeddingsApiKey: null,
    ...overrides,
  }
}

beforeEach(() => {
  h.state.conv = {
    assigned_agent_id: null,
    ai_autoreply_disabled: false,
    ai_reply_count: 0,
  }
  h.state.autoResponders = []
  h.state.claim = true
  h.state.updatePayload = null
  h.state.rpcCalls = []
  h.loadAiConfig.mockResolvedValue(aiConfig())
  h.buildConversationContext.mockResolvedValue([{ role: 'user', content: 'hi' }])
  h.retrieveKnowledge.mockResolvedValue([])
  h.generateReply.mockResolvedValue({ text: 'Hello!', handoff: false })
  h.engineSendText.mockResolvedValue({ whatsapp_message_id: 'm1' })
  h.loadAccountMetaCredentials.mockResolvedValue({
    phoneNumberId: 'pn-1',
    accessToken: 'tok',
  })
  h.sendTypingIndicator.mockResolvedValue(undefined)
})

describe('dispatchInboundToAiReply — eligibility gates', () => {
  it('claims a slot and sends on the happy path', async () => {
    await dispatchInboundToAiReply(ARGS)
    expect(h.state.rpcCalls).toEqual([
      {
        name: 'claim_ai_reply_slot',
        args: { conversation_id: 'conv-1', max_replies: 3 },
      },
    ])
    expect(h.engineSendText).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: 'conv-1', text: 'Hello!' }),
    )
  })

  it('splits multi-chunk replies and sends each chunk to WhatsApp', async () => {
    h.generateReply.mockResolvedValue({
      text: 'Namaste! Welcome. ---\nKripya apna naam batayein?',
      handoff: false,
    })
    await dispatchInboundToAiReply(ARGS)
    expect(h.engineSendText).toHaveBeenCalledTimes(2)
    expect(h.engineSendText).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ conversationId: 'conv-1', text: 'Namaste! Welcome.' }),
    )
    expect(h.engineSendText).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ conversationId: 'conv-1', text: 'Kripya apna naam batayein?' }),
    )
  })

  it('grounds the reply in retrieved knowledge', async () => {
    h.retrieveKnowledge.mockResolvedValue(['Returns accepted within 30 days.'])
    await dispatchInboundToAiReply(ARGS)
    expect(h.retrieveKnowledge).toHaveBeenCalled()
    const systemPrompt = h.generateReply.mock.calls[0][0].systemPrompt as string
    expect(systemPrompt).toContain('Returns accepted within 30 days.')
  })

  it('stands down when an active message-level automation exists', async () => {
    h.state.autoResponders = [{ id: 'auto-1' }]
    await dispatchInboundToAiReply(ARGS)
    expect(h.generateReply).not.toHaveBeenCalled()
    expect(h.engineSendText).not.toHaveBeenCalled()
    expect(h.sendTypingIndicator).not.toHaveBeenCalled()
  })

  it('does not send when the atomic slot claim loses the race', async () => {
    h.state.claim = false
    await dispatchInboundToAiReply(ARGS)
    // It still attempts the claim, but the send is skipped.
    expect(h.state.rpcCalls).toHaveLength(1)
    expect(h.engineSendText).not.toHaveBeenCalled()
  })

  it('skips when AI is off / not configured', async () => {
    h.loadAiConfig.mockResolvedValue(null)
    await dispatchInboundToAiReply(ARGS)
    expect(h.generateReply).not.toHaveBeenCalled()
    expect(h.engineSendText).not.toHaveBeenCalled()
  })

  it('skips when auto-reply is disabled for the account', async () => {
    h.loadAiConfig.mockResolvedValue(aiConfig({ autoReplyEnabled: false }))
    await dispatchInboundToAiReply(ARGS)
    expect(h.engineSendText).not.toHaveBeenCalled()
  })

  it('skips when a human agent is assigned', async () => {
    h.state.conv = {
      assigned_agent_id: 'agent-9',
      ai_autoreply_disabled: false,
      ai_reply_count: 0,
    }
    await dispatchInboundToAiReply(ARGS)
    expect(h.engineSendText).not.toHaveBeenCalled()
    expect(h.sendTypingIndicator).not.toHaveBeenCalled()
  })

  it('skips when auto-reply was disabled on this conversation', async () => {
    h.state.conv = {
      assigned_agent_id: null,
      ai_autoreply_disabled: true,
      ai_reply_count: 0,
    }
    await dispatchInboundToAiReply(ARGS)
    expect(h.engineSendText).not.toHaveBeenCalled()
  })

  it('skips when the per-conversation cap is reached', async () => {
    h.state.conv = {
      assigned_agent_id: null,
      ai_autoreply_disabled: false,
      ai_reply_count: 3,
    }
    await dispatchInboundToAiReply(ARGS)
    expect(h.engineSendText).not.toHaveBeenCalled()
  })

  it('skips when there is nothing to reply to', async () => {
    h.buildConversationContext.mockResolvedValue([])
    await dispatchInboundToAiReply(ARGS)
    expect(h.generateReply).not.toHaveBeenCalled()
    expect(h.engineSendText).not.toHaveBeenCalled()
    expect(h.sendTypingIndicator).not.toHaveBeenCalled()
  })
})

describe('dispatchInboundToAiReply — typing indicator (#527)', () => {
  it('shows "typing…" on the inbound wamid before calling the LLM', async () => {
    await dispatchInboundToAiReply(ARGS)
    expect(h.loadAccountMetaCredentials).toHaveBeenCalledWith(
      expect.anything(),
      'acct-1',
    )
    expect(h.sendTypingIndicator).toHaveBeenCalledTimes(1)
    expect(h.sendTypingIndicator).toHaveBeenCalledWith({
      phoneNumberId: 'pn-1',
      accessToken: 'tok',
      messageId: 'wamid.inbound-1',
    })
    // Ordering: the indicator goes out while the customer waits on the
    // model, not after the reply is already generated.
    const typingOrder = h.sendTypingIndicator.mock.invocationCallOrder[0]
    const llmOrder = h.generateReply.mock.invocationCallOrder[0]
    expect(typingOrder).toBeLessThan(llmOrder)
    expect(h.engineSendText).toHaveBeenCalledTimes(1)
  })

  it('still sends the reply when the indicator request fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    h.sendTypingIndicator.mockRejectedValue(new Error('Meta API error: 400'))
    await dispatchInboundToAiReply(ARGS)
    expect(h.generateReply).toHaveBeenCalledTimes(1)
    expect(h.engineSendText).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: 'conv-1', text: 'Hello!' }),
    )
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('typing indicator failed'),
      expect.any(Error),
    )
    warn.mockRestore()
  })

  it('still sends the reply when the WhatsApp credentials cannot be loaded', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    h.loadAccountMetaCredentials.mockRejectedValue(
      new Error('WhatsApp not configured for this account'),
    )
    await dispatchInboundToAiReply(ARGS)
    expect(h.sendTypingIndicator).not.toHaveBeenCalled()
    expect(h.engineSendText).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })

  it('skips the indicator when no inbound wamid is supplied', async () => {
    const { inboundMessageId: _omit, ...legacyArgs } = ARGS
    void _omit
    await dispatchInboundToAiReply(legacyArgs)
    expect(h.sendTypingIndicator).not.toHaveBeenCalled()
    expect(h.loadAccountMetaCredentials).not.toHaveBeenCalled()
    expect(h.engineSendText).toHaveBeenCalledTimes(1)
  })

  it('does not fire when a gate short-circuits before the LLM', async () => {
    h.loadAiConfig.mockResolvedValue(aiConfig({ autoReplyEnabled: false }))
    await dispatchInboundToAiReply(ARGS)
    expect(h.sendTypingIndicator).not.toHaveBeenCalled()
    expect(h.loadAccountMetaCredentials).not.toHaveBeenCalled()
  })
})

describe('dispatchInboundToAiReply — handoff', () => {
  it('disables auto-reply, writes a summary, and does not send on handoff', async () => {
    h.generateReply.mockResolvedValue({ text: '', handoff: true })
    await dispatchInboundToAiReply(ARGS)
    expect(h.engineSendText).not.toHaveBeenCalled()
    expect(h.state.rpcCalls).toHaveLength(0)
    expect(h.state.updatePayload).toMatchObject({ ai_autoreply_disabled: true })
    expect(h.state.updatePayload?.ai_handoff_summary).toContain(
      'AI agent handed off',
    )
    // No handoff target configured → conversation left unassigned.
    expect(h.state.updatePayload).not.toHaveProperty('assigned_agent_id')
  })

  it('routes to the configured handoff agent on handoff', async () => {
    h.loadAiConfig.mockResolvedValue(aiConfig({ handoffAgentId: 'agent-7' }))
    h.generateReply.mockResolvedValue({ text: '', handoff: true })
    await dispatchInboundToAiReply(ARGS)
    expect(h.state.updatePayload).toMatchObject({
      ai_autoreply_disabled: true,
      assigned_agent_id: 'agent-7',
    })
  })
})

describe('getNextBookingQueryId (#GYN-001 series)', () => {
  it('starts at #GYN-001 when there are no existing bookings', async () => {
    const mockDb = {
      from: () => ({
        select: () => ({
          eq: () => Promise.resolve({ data: [] }),
        }),
      }),
    } as any

    const nextId = await getNextBookingQueryId(mockDb, 'acc-1')
    expect(nextId).toBe('#GYN-001')
  })

  it('increments sequentially from existing #GYN-00X series', async () => {
    const mockDb = {
      from: () => ({
        select: () => ({
          eq: () =>
            Promise.resolve({
              data: [
                { booking_query_id: '#GYN-001' },
                { booking_query_id: '#GYN-002' },
                { booking_query_id: '#GYN-003' },
              ],
            }),
        }),
      }),
    } as any

    const nextId = await getNextBookingQueryId(mockDb, 'acc-1')
    expect(nextId).toBe('#GYN-004')
  })
})

describe('normalizePreferredDate', () => {
  it('normalizes "kal" to tomorrow with weekday in IST', () => {
    const result = normalizePreferredDate('kal')
    expect(result).toContain('Kal')
    expect(result).toMatch(/\d{1,2}\s+[A-Za-z]+\s+\d{4}/)
  })

  it('normalizes "parso" to day after tomorrow', () => {
    const result = normalizePreferredDate('parso')
    expect(result).toContain('Parso')
  })

  it('passes through specific explicit dates', () => {
    expect(normalizePreferredDate('25 December 2026')).toBe('25 December 2026')
  })
})

describe('Conversation history extraction helpers', () => {
  const sampleMessages = [
    { role: 'user', content: 'Others' },
    { role: 'assistant', content: 'नमस्ते! Gynocci Femtech में आपका स्वागत है।' },
    { role: 'user', content: 'Kanpur se hu' },
    { role: 'user', content: 'Aur mera sperm low hai aur meri wife ke baccha nahi ho rha' },
    { role: 'assistant', content: 'Gynocci में हम प्राकृतिक आयुर्वेदिक उपचार प्रदान करते हैं।' },
    { role: 'user', content: 'Acha to mein to kanpur se hu fir ab mein kya karu' },
    { role: 'assistant', content: 'हम आपको 45 मिनट की ऑनलाइन वीडियो कंसल्टेशन प्रदान कर सकते हैं।' },
    { role: 'user', content: 'Haa kar do' },
    { role: 'assistant', content: 'कृपया अपनी जानकारी दें।' },
    { role: 'user', content: 'Mera naam rajesh hai' },
    { role: 'user', content: '9588233263' },
    { role: 'user', content: '26 saal ka hu mein' },
  ]

  it('extracts city from conversational messages', () => {
    expect(extractCityFromMessages(sampleMessages)).toBe('Kanpur')
    expect(extractCityFromMessages([{ role: 'user', content: 'Hum Bikaner se hain' }])).toBe('Bikaner')
    expect(extractCityFromMessages([{ role: 'user', content: 'City: Jaipur' }])).toBe('Jaipur')
  })

  it('extracts name from conversational messages', () => {
    expect(extractNameFromMessages(sampleMessages)).toBe('Rajesh')
    expect(extractNameFromMessages([{ role: 'user', content: 'Mera naam Priya Sharma hai ji' }])).toBe('Priya Sharma')
  })

  it('extracts age and phone correctly', () => {
    expect(extractAgeFromMessages(sampleMessages)).toBe('26')
    expect(extractPhoneFromMessages(sampleMessages)).toBe('9588233263')
  })

  it('extracts clinical concern from conversation', () => {
    const concern = extractConcernFromMessages(sampleMessages)
    expect(concern).toContain('स्पर्म')
  })

  it('correctly identifies 9 clinic cities vs outside cities', () => {
    expect(isClinicCity('Jaipur')).toBe(true)
    expect(isClinicCity('Delhi')).toBe(true)
    expect(isClinicCity('Lucknow')).toBe(true)
    expect(isClinicCity('Amritsar')).toBe(true)
    expect(isClinicCity('Ludhiana')).toBe(true)
    expect(isClinicCity('Patna')).toBe(true)
    expect(isClinicCity('Ranchi')).toBe(true)
    expect(isClinicCity('Hisar')).toBe(true)
    expect(isClinicCity('Rewari')).toBe(true)

    expect(isClinicCity('Kanpur')).toBe(false)
    expect(isClinicCity('Bikaner')).toBe(false)
    expect(isClinicCity('Mumbai')).toBe(false)
    expect(isClinicCity(null)).toBe(false)
  })
})
