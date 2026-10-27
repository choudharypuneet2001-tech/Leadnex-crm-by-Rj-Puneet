import type { ChatMessage } from './types'

/**
 * The text to retrieve knowledge against: the most recent customer
 * (`user`) turn in the conversation context. Falls back to the last
 * message of any role, then empty string. Shared by the draft route and
 * the auto-reply bot so both query the knowledge base the same way.
 */
export function latestUserMessage(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') return messages[i].content
  }
  return messages.length > 0 ? messages[messages.length - 1].content : ''
}

const GREETING_PHRASES = [
  'good morning',
  'good afternoon',
  'good evening',
  'shubh prabhat',
  'shubh sandhya',
  'radhe radhe',
  'jai shree krishna',
  'jai sri krishna',
  'jai shree ram',
  'jai shri ram',
  'jai jinendra',
  'ram ram',
  'kaise ho',
  'kya haal hai',
  'kem cho',
  'kashi aahat',
  'how are you',
  'how r u',
  'namaste ji',
  'namaskar ji',
  'hello sir',
  'hello madam',
  'hello doctor',
  'hi sir',
  'hi doctor',
]

const GREETING_WORDS = new Set([
  'hi',
  'hii',
  'hiii',
  'hello',
  'helloo',
  'hey',
  'heyy',
  'namaste',
  'namasteji',
  'namaskar',
  'namaskaram',
  'pranam',
  'salaam',
  'adaab',
  'sir',
  'madam',
  'maam',
  'mam',
  'ji',
  'bhai',
  'didi',
  'doctor',
  'dr',
  'hru',
  'aap',
  'kaise',
  'kya',
  'haal',
  'sab',
  'theek',
  'fine',
  'thanks',
  'thank',
  'you',
])

/**
 * Returns true if the customer input is purely a greeting / pleasantry
 * (e.g., "hi", "namaskar", "namaste ji", "hello doctor", "good morning").
 *
 * For these messages, performing a semantic vector search across the knowledge base
 * is completely redundant and adds 1.5 - 2.5s of latency (OpenAI embeddings + Supabase RPCs).
 * Detecting this enables a sub-second instant response path for greetings!
 */
export function isGreetingOnly(text: string): boolean {
  if (!text) return false
  let clean = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!clean) return false

  for (const phrase of GREETING_PHRASES) {
    if (clean === phrase) return true
    if (clean.startsWith(phrase + ' ')) {
      clean = clean.slice(phrase.length).trim()
    } else if (clean.endsWith(' ' + phrase)) {
      clean = clean.slice(0, -phrase.length).trim()
    }
  }

  if (!clean) return true

  const words = clean.split(' ').filter(Boolean)
  if (words.length === 0 || words.length > 5) return false

  return words.every((w) => GREETING_WORDS.has(w))
}

