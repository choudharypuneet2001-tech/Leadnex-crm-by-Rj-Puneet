import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

// decrypt is identity in tests so we don't depend on real ciphertext.
vi.mock('@/lib/whatsapp/encryption', () => ({
  decrypt: (v: string) => `plain:${v}`,
}))

import { loadAiConfig, loadEmbeddingsKey } from './config'
import { normalizeOpenAiModel } from './defaults'

function dbReturning(row: Record<string, unknown> | null): SupabaseClient {
  const chain = {
    from: () => chain,
    select: () => chain,
    eq: () => chain,
    maybeSingle: () => Promise.resolve({ data: row, error: null }),
  }
  return chain as unknown as SupabaseClient
}

const ROW = {
  provider: 'openai',
  model: 'gpt-x',
  api_key: 'enc-key',
  system_prompt: null,
  is_active: false,
  auto_reply_enabled: false,
  auto_reply_max_per_conversation: 3,
  embeddings_api_key: null,
}

describe('loadAiConfig requireActive', () => {
  it('returns null for an inactive config by default', async () => {
    expect(await loadAiConfig(dbReturning(ROW), 'acct')).toBeNull()
  })

  it('returns the config when requireActive is false (Playground path)', async () => {
    const config = await loadAiConfig(dbReturning(ROW), 'acct', {
      requireActive: false,
    })
    expect(config).not.toBeNull()
    expect(config!.provider).toBe('openai')
    expect(config!.apiKey).toBe('plain:enc-key')
    // Automatically reuses OpenAI API key for embeddings if embeddings_api_key is null
    expect(config!.embeddingsApiKey).toBe('plain:enc-key')
  })

  it('returns null when there is no row', async () => {
    expect(
      await loadAiConfig(dbReturning(null), 'acct', { requireActive: false }),
    ).toBeNull()
  })

  it('loads embeddings key from openai api_key if embeddings_api_key is null', async () => {
    const { key, corrupt } = await loadEmbeddingsKey(dbReturning(ROW), 'acct')
    expect(key).toBe('plain:enc-key')
    expect(corrupt).toBe(false)
  })
})

describe('normalizeOpenAiModel', () => {
  it('normalizes common variants of gpt-4o-mini', () => {
    expect(normalizeOpenAiModel('gpt 4.1 mini')).toBe('gpt-4o-mini')
    expect(normalizeOpenAiModel('gpt-4.1-mini')).toBe('gpt-4o-mini')
    expect(normalizeOpenAiModel('gpt 4o mini')).toBe('gpt-4o-mini')
    expect(normalizeOpenAiModel('4o-mini')).toBe('gpt-4o-mini')
    expect(normalizeOpenAiModel('gpt-4o-mini')).toBe('gpt-4o-mini')
  })

  it('normalizes common variants of gpt-4o', () => {
    expect(normalizeOpenAiModel('gpt 4.1')).toBe('gpt-4o')
    expect(normalizeOpenAiModel('gpt 4o')).toBe('gpt-4o')
    expect(normalizeOpenAiModel('gpt-4o')).toBe('gpt-4o')
  })

  it('preserves other custom model names', () => {
    expect(normalizeOpenAiModel('o3-mini')).toBe('o3-mini')
  })
})
