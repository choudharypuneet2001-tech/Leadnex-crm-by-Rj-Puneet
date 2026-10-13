import { AiError, type ProviderResult } from '../types'
import { MAX_OUTPUT_TOKENS } from '../defaults'
import {
  mergeConsecutive,
  normalizeUsage,
  providerHttpError,
  toNetworkError,
  type ProviderArgs,
} from './shared'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

interface GroqResponse {
  choices?: { message?: { content?: string } }[]
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
}

const FALLBACK_MODELS = ['llama-3.1-8b-instant', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b']

function isModelAvailabilityError(status: number, message: string): boolean {
  const lower = message.toLowerCase()
  return (
    status === 404 ||
    lower.includes('does not exist') ||
    lower.includes('not have access') ||
    lower.includes('decommissioned') ||
    lower.includes('model_not_found')
  )
}

/**
 * Call Groq's high-speed inference endpoint with the caller's own key.
 * Automatically tries resilient fallback models if the requested model
 * is not available or restricted on the caller's Groq tier.
 */
export async function generateGroq(args: ProviderArgs): Promise<ProviderResult> {
  const { apiKey, model, systemPrompt, messages, timeoutMs } = args

  const requested = model.trim() || 'llama-3.1-8b-instant'
  const candidateModels = [
    requested,
    ...FALLBACK_MODELS.filter((m) => m !== requested),
  ]

  let lastError: unknown = null

  for (let i = 0; i < candidateModels.length; i++) {
    const currentModel = candidateModels[i]
    let res: Response
    try {
      res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: currentModel,
          messages: [
            { role: 'system', content: systemPrompt },
            ...mergeConsecutive(messages),
          ],
          max_tokens: MAX_OUTPUT_TOKENS,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (err) {
      throw toNetworkError(err)
    }

    if (!res.ok) {
      const httpErr = await providerHttpError('Groq', res)
      if (
        isModelAvailabilityError(res.status, httpErr.message) &&
        i < candidateModels.length - 1
      ) {
        lastError = httpErr
        continue
      }
      throw httpErr
    }

    const data = (await res.json().catch(() => null)) as GroqResponse | null
    const text = data?.choices?.[0]?.message?.content
    if (!text || typeof text !== 'string' || !text.trim()) {
      throw new AiError('Groq returned an empty response.', {
        code: 'empty_response',
        status: 502,
      })
    }

    return {
      text: text.trim(),
      usage: normalizeUsage({
        prompt: data.usage?.prompt_tokens,
        completion: data.usage?.completion_tokens,
        total: data.usage?.total_tokens,
      }),
    }
  }

  throw lastError || new AiError('Groq model could not be loaded.', { code: 'groq_error', status: 500 })
}
