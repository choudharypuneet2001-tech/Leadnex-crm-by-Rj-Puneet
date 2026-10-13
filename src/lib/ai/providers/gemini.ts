import { AiError, type ProviderResult } from '../types'
import { MAX_OUTPUT_TOKENS } from '../defaults'
import {
  normalizeUsage,
  providerHttpError,
  toNetworkError,
  type ProviderArgs,
} from './shared'

interface GeminiNativeResponse {
  candidates?: {
    content?: {
      parts?: { text?: string }[]
    }
  }[]
  usageMetadata?: {
    promptTokenCount?: number
    candidatesTokenCount?: number
    totalTokenCount?: number
  }
}

/**
 * Call Google Gemini with the caller's own API key from Google AI Studio.
 * Uses Google's primary native generateContent REST endpoint for maximum reliability.
 */
export async function generateGemini(args: ProviderArgs): Promise<ProviderResult> {
  const { apiKey, model, systemPrompt, messages, timeoutMs } = args

  // Normalize model name:
  // Map any older/deprecated models (1.5, 2.0, 2.5) directly to Google's current gemini-3.8-flash
  let cleanModel = model.replace(/^models\//, '').trim()
  if (
    !cleanModel ||
    cleanModel.includes('1.5') ||
    cleanModel.includes('2.0') ||
    cleanModel.includes('2.5') ||
    cleanModel === 'gemini-flash'
  ) {
    cleanModel = 'gemini-3.8-flash'
  }

  // Format messages into Gemini's contents array with alternating roles ('user' and 'model')
  const mergedContents: { role: 'user' | 'model'; parts: { text: string }[] }[] = []
  for (const m of messages) {
    const role = m.role === 'assistant' ? 'model' : 'user'
    const last = mergedContents[mergedContents.length - 1]
    if (last && last.role === role) {
      last.parts[0].text += '\n\n' + m.content
    } else {
      mergedContents.push({ role, parts: [{ text: m.content }] })
    }
  }

  // Drop any leading model turn (Gemini requires the first turn to be 'user')
  while (mergedContents.length > 0 && mergedContents[0].role === 'model') {
    mergedContents.shift()
  }

  if (mergedContents.length === 0) {
    mergedContents.push({ role: 'user', parts: [{ text: 'Hello' }] })
  }

  const payload: Record<string, unknown> = {
    contents: mergedContents,
    generationConfig: {
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    },
  }

  if (systemPrompt && systemPrompt.trim()) {
    payload.system_instruction = {
      parts: [{ text: systemPrompt.trim() }],
    }
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${encodeURIComponent(apiKey)}`

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (err) {
    throw toNetworkError(err)
  }

  if (!res.ok) {
    throw await providerHttpError('Google Gemini', res)
  }

  const data = (await res.json().catch(() => null)) as GeminiNativeResponse | null
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text || typeof text !== 'string' || !text.trim()) {
    throw new AiError('Google Gemini returned an empty response.', {
      code: 'empty_response',
      status: 502,
    })
  }

  return {
    text: text.trim(),
    usage: normalizeUsage({
      prompt: data?.usageMetadata?.promptTokenCount,
      completion: data?.usageMetadata?.candidatesTokenCount,
      total: data?.usageMetadata?.totalTokenCount,
    }),
  }
}
