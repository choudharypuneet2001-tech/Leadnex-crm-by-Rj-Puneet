import {
  AiError,
  type AiConfig,
  type AiUsage,
  type ChatMessage,
  type GenerateResult,
} from './types'
import { HANDOFF_SENTINEL, aiRequestTimeoutMs } from './defaults'
import { generateOpenAi } from './providers/openai'
import { generateAnthropic } from './providers/anthropic'
import { generateGemini } from './providers/gemini'
import { generateGroq } from './providers/groq'

export interface GenerateArgs {
  config: AiConfig
  /** Fully-built system prompt (see `buildSystemPrompt`). */
  systemPrompt: string
  /** Recent conversation turns, oldest first. */
  messages: ChatMessage[]
}

/**
 * Generate the next reply from the account's configured provider.
 * Dispatches to the right adapter, then parses the handoff sentinel out
 * of the raw text. Throws `AiError` on any provider/network failure.
 */
export async function generateReply(args: GenerateArgs): Promise<GenerateResult> {
  const { config, systemPrompt, messages } = args
  const timeoutMs = aiRequestTimeoutMs()
  const providerArgs = {
    apiKey: config.apiKey,
    model: config.model,
    systemPrompt,
    messages,
    timeoutMs,
  }

  let result: { text: string; usage: AiUsage | null }
  switch (config.provider) {
    case 'gemini':
      result = await generateGemini(providerArgs)
      break
    case 'openai':
      result = await generateOpenAi(providerArgs)
      break
    case 'groq':
      result = await generateGroq(providerArgs)
      break
    case 'anthropic':
      result = await generateAnthropic(providerArgs)
      break
    default:
      throw new AiError(`Unsupported AI provider: ${config.provider}`, {
        code: 'unsupported_provider',
        status: 400,
      })
  }

  return parseGeneration(result.text, result.usage)
}

import type { ContactUpdateExtracted } from './types'

export const CONTACT_UPDATE_REGEX =
  /\[\[(?:UPDATE_CONTACT|CONTACT_UPDATE):\s*(\{[\s\S]*?\})\s*\]\]/i

/**
 * Split the raw model output into `{ text, handoff, usage, contactUpdate }`. The
 * sentinel can appear alone or trailing a partial reply; either way we
 * treat the turn as a handoff and strip the marker from any remaining
 * text. `usage` is passed straight through (null when the provider
 * didn't report it).
 */
export function parseGeneration(
  raw: string,
  usage: AiUsage | null = null,
): GenerateResult {
  let contactUpdate: ContactUpdateExtracted | null = null
  const updateMatch = raw.match(CONTACT_UPDATE_REGEX)
  if (updateMatch) {
    try {
      const parsed = JSON.parse(updateMatch[1])
      if (typeof parsed === 'object' && parsed !== null) {
        const name =
          typeof parsed.name === 'string' && parsed.name.trim()
            ? parsed.name.trim()
            : undefined
        const city =
          typeof parsed.city === 'string' && parsed.city.trim()
            ? parsed.city.trim()
            : undefined
        if (name || city) {
          contactUpdate = { name, city }
        }
      }
    } catch {
      // Malformed JSON - ignore gracefully
    }
  }

  const cleanRaw = raw.replace(CONTACT_UPDATE_REGEX, '')
  const handoff = cleanRaw.includes(HANDOFF_SENTINEL)
  const text = cleanRaw.split(HANDOFF_SENTINEL).join('').trim()
  const result: GenerateResult = { text, handoff, usage }
  if (contactUpdate) {
    result.contactUpdate = contactUpdate
  }
  return result
}
