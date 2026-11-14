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

/**
 * Strips emojis, brackets, symbols, and phone numbers from raw WhatsApp profile names
 * so the AI addresses the customer respectfully and naturally (e.g. "Rj Puneet" instead of "Rj Puneet ( जाट ) 🦅").
 */
export function cleanDisplayName(raw?: string | null): string | null {
  if (!raw) return null
  if (/^(\+?\d[\d\s-]{7,}\d)$/.test(raw.trim())) return null
  let s = raw.replace(/\s*[\(\[\{][^\)\]\}]*[\)\]\}]/g, '')
  s = s.replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Symbol}]/gu, '')
  s = s.replace(/[^\p{L}\s.]/gu, '')
  s = s.replace(/\s+/g, ' ').trim()
  if (!s || s.length < 2) return null
  return s
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

export const AD_CLICK_PHRASES = [
  'i saw your ad',
  'i saw this ad',
  'saw your ad',
  'i saw this on facebook',
  'i saw this on instagram',
  'i saw your ad on facebook',
  'i saw your ad on instagram',
  'saw ad on facebook',
  'saw ad on instagram',
  'can i get more info',
  'can you tell me more',
  'want to know more',
  'want more info',
  'interested in this',
  'interested in gynocci',
  'please send details',
  'send details',
  'details please',
  'mujhe jankari chahiye',
  'jaankari chahiye',
  'more info',
  'info please',
  'get started',
]

/**
 * Returns true if the customer input is purely a greeting or an incoming
 * Click-to-WhatsApp ad prefill message (e.g., "Hi, I saw your ad on Facebook").
 */
export function isGreetingOrAdClick(text: string): boolean {
  if (!text) return false
  if (isGreetingOnly(text)) return true

  const clean = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  for (const phrase of AD_CLICK_PHRASES) {
    if (clean.includes(phrase)) return true
  }

  // Common pattern: starts with greeting + asks about ad / Facebook / Instagram / details
  if (
    (clean.startsWith('hi ') || clean.startsWith('hello ') || clean.startsWith('namaste ') || clean.startsWith('hey ')) &&
    (clean.includes('ad') || clean.includes('facebook') || clean.includes('instagram') || clean.includes('fb') || clean.includes('insta') || clean.includes('details') || clean.includes('jankari'))
  ) {
    return true
  }

  return false
}

/**
 * Returns true if the customer input is purely a greeting / pleasantry
 * (e.g., "hi", "namaskar", "namaste ji", "hello doctor", "good morning",
 * or an ad-click headline).
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

  for (const phrase of AD_CLICK_PHRASES) {
    if (clean === phrase) return true
  }

  const words = clean.split(' ').filter(Boolean)
  if (words.length === 0 || words.length > 5) return false

  return words.every((w) => GREETING_WORDS.has(w))
}

const HINGLISH_MARKERS = new Set([
  'hai', 'hain', 'ho', 'hu', 'hoon', 'kya', 'kaise', 'kahan', 'kaha', 'mein',
  'se', 'ko', 'ki', 'ke', 'ka', 'aur', 'bhi', 'nahi', 'nahin', 'kar', 'karein',
  'rahe', 'rahi', 'raha', 'mujhe', 'hume', 'aap', 'aapko', 'aapka', 'aapki', 'aapke',
  'meri', 'mera', 'mere', 'tum', 'tera', 'teri', 'par', 'pe', 'kab', 'kyu', 'kyun',
  'batao', 'bataiye', 'chahiye', 'deni', 'dena', 'aaj', 'kal', 'parso', 'theek', 'thik',
  'shahar', 'shehar', 'takleef', 'samasya', 'ilaaj', 'dawa', 'dawai', 'shuru', 'pehle',
  'kitna', 'kitne', 'kitni', 'paise', 'rupaye', 'kuch', 'accha', 'achha', 'acha',
  'baat', 'karni', 'karna', 'kardo', 'kariye', 'ji', 'haan', 'han', 'suno', 'bolo',
  'bhejo', 'bhej', 'milna', 'mil', 'sakta', 'sakti', 'sakte', 'hoga', 'hogi', 'honge',
  'paas', 'dikhao', 'dikha', 'dekh', 'dekho', 'lekin', 'kyoki', 'kyunki', 'parantu',
  'baccha', 'bache', 'bachey', 'umar', 'naam', 'sirf', 'shukriya', 'dhanyawad'
])

const COMMON_ENGLISH_WORDS = new Set([
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on',
  'with', 'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we',
  'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their',
  'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when',
  'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take', 'people', 'into',
  'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other', 'than', 'then', 'now',
  'look', 'only', 'come', 'its', 'over', 'think', 'also', 'back', 'after', 'use', 'two',
  'how', 'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because', 'any',
  'these', 'give', 'day', 'most', 'us', 'please', 'hello', 'hi', 'doctor', 'appointment',
  'book', 'fees', 'cost', 'price', 'clinic', 'located', 'where', 'when', 'call', 'consult',
  'consultation', 'treatment', 'ayurvedic', 'medicine', 'problem', 'suffering', 'pcod',
  'pcos', 'tubal', 'blockage', 'sperm', 'count', 'pregnancy', 'pregnant', 'baby', 'infertility',
  'yes', 'okay', 'ok', 'sure', 'speak', 'talk', 'reply', 'language', 'english', 'thanks', 'thank'
])

/**
 * Detects if an incoming customer message is in English (or an explicit request for English).
 * Distinguishes true English messages from Roman Hinglish ("Mein jaipur se hu", "Fees kab deni hai mujhe").
 */
export function isEnglishMessage(text?: string | null): boolean {
  if (!text) return false
  const trimmed = text.trim()
  if (/[\u0900-\u0D7F]/.test(trimmed)) return false // Indic script is not English

  // Explicit English request (even with common typos like "engiish")
  if (
    /\b(in\s+english|talk\s+in\s+english|speak\s+in\s+english|chat\s+in\s+english|reply\s+in\s+english|english\s+please|can\s+we\s+speak\s+in\s+english|can\s+you\s+talk\s+in\s+eng[li]{1,2}sh|prefer\s+english)\b/i.test(
      trimmed,
    )
  ) {
    return true
  }

  const words = trimmed.toLowerCase().match(/[a-z]+/g) || []
  if (words.length === 0) return false

  let hinglishCount = 0
  let englishCount = 0

  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    // Special handling for 'me': in Hindi it means in/inside, in English it is the pronoun 'me'
    if (w === 'me') {
      const prev = i > 0 ? words[i - 1] : ''
      if (['with', 'for', 'to', 'help', 'tell', 'call', 'give', 'ask', 'guide', 'contact'].includes(prev)) {
        englishCount++
        continue
      }
    }
    if (HINGLISH_MARKERS.has(w)) {
      hinglishCount++
    } else if (COMMON_ENGLISH_WORDS.has(w)) {
      englishCount++
    }
  }

  if (hinglishCount > 0) return false
  return englishCount >= 2 || (words.length === 1 && ['english', 'yes', 'okay', 'ok', 'sure', 'hello', 'hi', 'thanks', 'thankyou'].includes(words[0]))
}

const KNOWN_FEMALE_NAMES = new Set([
  'meenal', 'payal', 'komal', 'kajal', 'suman', 'kiran', 'poonam', 'sheetal', 'simran',
  'mumtreen', 'fatima', 'shabnam', 'shabana', 'rubina', 'yasmin', 'salma', 'parveen',
  'noor', 'nargis', 'rehana', 'afsana', 'shama', 'tannu', 'mannu', 'guddi', 'chhavi'
])

const KNOWN_MALE_NAMES = new Set([
  'rajesh', 'rahul', 'amit', 'puneet', 'rohit', 'vikas', 'suresh', 'ramesh', 'ajay',
  'vijay', 'sanjay', 'manoj', 'rakesh', 'deepak', 'anil', 'sunil', 'mukesh', 'dinesh',
  'mohit', 'sumit', 'aman', 'abaan', 'mohammad', 'mohd', 'khan', 'singh', 'kumar',
  'gaurav', 'sourabh', 'saurabh', 'ankit', 'ashish', 'abhishek', 'alok', 'arun', 'ashok',
  'shashank', 'mayank', 'prateek', 'prashant', 'praveen', 'naveen', 'tarun', 'varun'
])

/**
 * Predicts whether an Indian first name is likely female or male so the AI
 * can address them respectfully as "Ma'am" or "Sir" with proper grammatical honorifics.
 */
export function isLikelyFemaleName(name?: string | null): boolean {
  if (!name) return false
  const first = name.trim().toLowerCase().split(/\s+/)[0]
  if (KNOWN_FEMALE_NAMES.has(first)) return true
  if (KNOWN_MALE_NAMES.has(first)) return false

  // Typical Indian female name endings
  if (/(a|i|ee|ya|ka|na|ti|vi|ta|shi|ni)$/.test(first)) {
    // Exceptions for male names ending in a or i
    if (['krishna', 'rama', 'ravi', 'hari', 'ali', 'rishi', 'mani', 'shiva', 'surya'].includes(first)) {
      return false
    }
    return true
  }
  return false
}


