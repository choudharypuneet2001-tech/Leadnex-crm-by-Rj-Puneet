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
 * Detects if an incoming customer message is an EXPLICIT request to communicate in English.
 * Business Rule: Do NOT switch to English unless the customer explicitly asks to talk/speak in English!
 * By default, always communicate in Hindi (Devanagari script).
 */
export function isEnglishMessage(text?: string | null): boolean {
  if (!text) return false
  const trimmed = text.trim()
  if (/[\u0900-\u0D7F]/.test(trimmed)) return false // Indic script is not English

  // Explicit English request (even with common typos like "engiish", "engish", "englis")
  return (
    /\b(?:talk|speak|chat|reply|write|converse)\s+(?:with\s+me\s+|to\s+me\s+)?in\s+eng[li]{1,3}sh?\b/i.test(trimmed) ||
    /\bcan\s+(?:you|we)\s+(?:please\s+)?(?:talk|speak|chat|reply)\s+(?:with\s+me\s+|to\s+me\s+)?in\s+eng[li]{1,3}sh?\b/i.test(trimmed) ||
    /\beng[li]{1,3}sh?\s*(?:mein|me|mai)\s*baat\b/i.test(trimmed) ||
    /\b(?:in\s+)?eng[li]{1,3}sh?\s+please\b/i.test(trimmed) ||
    /\bprefer\s+eng[li]{1,3}sh?\b/i.test(trimmed) ||
    /\beng[li]{1,3}sh?\s+language\b/i.test(trimmed) ||
    /\bdo\s+you\s+speak\s+eng[li]{1,3}sh?\b/i.test(trimmed)
  )
}

export interface DetectedLanguage {
  code: string
  name: string
  nativeName: string
  script: string
  isDefaultHindi?: boolean
}

export const DEFAULT_HINDI_LANGUAGE: DetectedLanguage = {
  code: 'hi',
  name: 'Hindi',
  nativeName: 'हिन्दी',
  script: 'Devanagari',
  isDefaultHindi: true,
}

export const SUPPORTED_INDIAN_LANGUAGES: Record<string, DetectedLanguage> = {
  hi: DEFAULT_HINDI_LANGUAGE,
  en: { code: 'en', name: 'English', nativeName: 'English', script: 'Latin' },
  pa: { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', script: 'Gurmukhi' },
  mr: { code: 'mr', name: 'Marathi', nativeName: 'मराठी', script: 'Devanagari' },
  bn: { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', script: 'Bengali' },
  te: { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', script: 'Telugu' },
  ta: { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', script: 'Tamil' },
  gu: { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', script: 'Gujarati' },
  kn: { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', script: 'Kannada' },
  ml: { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', script: 'Malayalam' },
  or: { code: 'or', name: 'Odia', nativeName: 'ଓଡ଼ିଆ', script: 'Odia' },
  ur: { code: 'ur', name: 'Urdu', nativeName: 'اردو', script: 'Urdu (Perso-Arabic)' },
  as: { code: 'as', name: 'Assamese', nativeName: 'অসমীয়া', script: 'Assamese' },
  bho: { code: 'bho', name: 'Bhojpuri', nativeName: 'भोजपुरी', script: 'Devanagari' },
  raj: { code: 'raj', name: 'Rajasthani / Marwari', nativeName: 'राजस्थानी / मारवाड़ी', script: 'Devanagari' },
  mai: { code: 'mai', name: 'Maithili', nativeName: 'मैथिली', script: 'Devanagari' },
}

/**
 * Detects if a customer has requested or written in an Indian regional language or English.
 * Supports Punjabi, Marathi, Bengali, Telugu, Tamil, Gujarati, Kannada, Malayalam,
 * Odia, Urdu, Assamese, Bhojpuri, Rajasthani/Marwari, Maithili, English, and Hindi.
 */
export function detectRequestedLanguage(text?: string | null): DetectedLanguage | null {
  if (!text) return null
  const trimmed = text.trim()
  if (!trimmed) return null

  // 1. Check unique non-Devanagari Indic & Perso-Arabic scripts
  if (/[\u0A00-\u0A7F]/.test(trimmed)) return SUPPORTED_INDIAN_LANGUAGES.pa
  if (/[\u0C00-\u0C7F]/.test(trimmed)) return SUPPORTED_INDIAN_LANGUAGES.te
  if (/[\u0B80-\u0BFF]/.test(trimmed)) return SUPPORTED_INDIAN_LANGUAGES.ta
  if (/[\u0A80-\u0AFF]/.test(trimmed)) return SUPPORTED_INDIAN_LANGUAGES.gu
  if (/[\u0C80-\u0CFF]/.test(trimmed)) return SUPPORTED_INDIAN_LANGUAGES.kn
  if (/[\u0D00-\u0D7F]/.test(trimmed)) return SUPPORTED_INDIAN_LANGUAGES.ml
  if (/[\u0B00-\u0B7F]/.test(trimmed)) return SUPPORTED_INDIAN_LANGUAGES.or
  if (/[\u0600-\u06FF]/.test(trimmed)) return SUPPORTED_INDIAN_LANGUAGES.ur
  if (/[\u0980-\u09FF]/.test(trimmed)) {
    if (/\b(?:assamese|oxomiya|axomiya|asamiya)\b/i.test(trimmed) || /অসমীয়া/.test(trimmed)) {
      return SUPPORTED_INDIAN_LANGUAGES.as
    }
    return SUPPORTED_INDIAN_LANGUAGES.bn
  }

  // 2. Check explicit English requests
  if (isEnglishMessage(trimmed)) {
    return SUPPORTED_INDIAN_LANGUAGES.en
  }

  // 3. Check explicit Hindi requests (when switching back to Hindi)
  if (
    /\b(?:talk|speak|chat|reply|write)\s+in\s+hindi\b/i.test(trimmed) ||
    /\bhindi\s*(?:mein|me|mai)\s*baat\b/i.test(trimmed) ||
    /\b(?:in\s+)?hindi\s+please\b/i.test(trimmed) ||
    /\bhindi\s+language\b/i.test(trimmed) ||
    /^(?:hindi|हिन्दी|हिंदी)$/i.test(trimmed) ||
    /(?:हिंदी|हिन्दी)\s*(?:में|में\s*बात|बोलो)/.test(trimmed)
  ) {
    return SUPPORTED_INDIAN_LANGUAGES.hi
  }

  // 4. Keyword and native phrase triggers for Indian regional languages
  if (/\b(?:punjabi|panjabi|punjabee)\b/i.test(trimmed) || /ਪੰਜਾਬੀ/.test(trimmed)) {
    return SUPPORTED_INDIAN_LANGUAGES.pa
  }
  if (/\b(?:marathi|marathe|marathit)\b/i.test(trimmed) || /(?:मराठी|मराठीत|मराठी\s*मध्ये)/.test(trimmed)) {
    return SUPPORTED_INDIAN_LANGUAGES.mr
  }
  if (/\b(?:bengali|bangla|bangali|banglay|banglate)\b/i.test(trimmed) || /বাংলা/.test(trimmed)) {
    return SUPPORTED_INDIAN_LANGUAGES.bn
  }
  if (/\b(?:telugu|telgu|telugulo)\b/i.test(trimmed) || /తెలుగు/.test(trimmed)) {
    return SUPPORTED_INDIAN_LANGUAGES.te
  }
  if (/\btamilnadu\b/i.test(trimmed) || /\btamil\s+nadu\b/i.test(trimmed)) {
    if (/\b(?:talk|speak|chat|reply|write|baat|pesavum|sollunga|in\s+tamil|tamil\s*(?:me|mein|il))\b/i.test(trimmed)) {
      return SUPPORTED_INDIAN_LANGUAGES.ta
    }
  } else if (/\b(?:tamil|thamizh|tamilil|thamizhil)\b/i.test(trimmed) || /தமிழ்/.test(trimmed)) {
    return SUPPORTED_INDIAN_LANGUAGES.ta
  }
  if (/\b(?:gujarati|gujrati|gujaratima)\b/i.test(trimmed) || /ગુજરાતી/.test(trimmed)) {
    return SUPPORTED_INDIAN_LANGUAGES.gu
  }
  if (/\b(?:kannada|canarese|kannadadalli)\b/i.test(trimmed) || /ಕನ್ನಡ/.test(trimmed)) {
    return SUPPORTED_INDIAN_LANGUAGES.kn
  }
  if (/\b(?:malayalam|mallu|malayalathil)\b/i.test(trimmed) || /മലയാളം/.test(trimmed)) {
    return SUPPORTED_INDIAN_LANGUAGES.ml
  }
  if (/\b(?:odia|oriya|odiare|oriyare)\b/i.test(trimmed) || /ଓଡ଼ିଆ/.test(trimmed)) {
    return SUPPORTED_INDIAN_LANGUAGES.or
  }
  if (/\b(?:urdu)\b/i.test(trimmed) || /اردو/.test(trimmed)) {
    return SUPPORTED_INDIAN_LANGUAGES.ur
  }
  if (/\b(?:assamese|oxomiya|axomiya|asamiya)\b/i.test(trimmed) || /অসমীয়া/.test(trimmed)) {
    return SUPPORTED_INDIAN_LANGUAGES.as
  }
  if (/\b(?:bhojpuri|bhojpoori)\b/i.test(trimmed) || /भोजपुरी/.test(trimmed)) {
    return SUPPORTED_INDIAN_LANGUAGES.bho
  }
  if (/\b(?:rajasthani|marwari|marwadi)\b/i.test(trimmed) || /(?:राजस्थानी|मारवाड़ी|मारवाड़ी)/.test(trimmed)) {
    return SUPPORTED_INDIAN_LANGUAGES.raj
  }
  if (/\b(?:maithili|maithli)\b/i.test(trimmed) || /मैथिली/.test(trimmed)) {
    return SUPPORTED_INDIAN_LANGUAGES.mai
  }

  return null
}

/**
 * Resolves the active conversation language by checking the latest user message
 * and scanning conversation history backwards for persistent language selection.
 * Defaults to Hindi (Devanagari) when no explicit language preference has been indicated.
 */
export function resolveConversationLanguage(
  latestMsg?: string | null,
  history?: { role: string; content?: string }[],
): DetectedLanguage {
  const current = detectRequestedLanguage(latestMsg)
  if (current) return current

  if (history && history.length > 0) {
    for (let i = history.length - 1; i >= 0; i--) {
      const msg = history[i]
      if (msg.role === 'user' && msg.content) {
        const histLang = detectRequestedLanguage(msg.content)
        if (histLang) return histLang
      }
    }
  }

  return DEFAULT_HINDI_LANGUAGE
}

export const KNOWN_FEMALE_NAMES = new Set([
  'shikha', 'priya', 'pooja', 'puja', 'anjali', 'sunita', 'neha', 'aarti', 'arti', 'sneha',
  'divya', 'ritu', 'rekha', 'kavita', 'jyoti', 'meenal', 'payal', 'komal', 'kajal', 'suman',
  'kiran', 'poonam', 'sheetal', 'simran', 'mamta', 'geeta', 'gita', 'seema', 'sima', 'anita',
  'renu', 'meena', 'radha', 'chhaya', 'vandana', 'swati', 'shweta', 'preeti', 'priti', 'pinky',
  'pinki', 'manju', 'sarita', 'babita', 'usha', 'saroj', 'shashi', 'pushpa', 'nirmala', 'asha',
  'santosh', 'kamla', 'krishna', 'maya', 'sushma', 'shakuntala', 'vimla', 'malti', 'manisha',
  'monika', 'monica', 'ruchi', 'shalu', 'deepika', 'dipika', 'garima', 'sonam', 'priyanka',
  'richa', 'pallavi', 'pragya', 'tanu', 'tanya', 'ishita', 'rashi', 'shivani', 'varsha',
  'chanchal', 'mumtreen', 'fatima', 'shabnam', 'shabana', 'rubina', 'yasmin', 'salma',
  'parveen', 'noor', 'nargis', 'rehana', 'afsana', 'shama', 'tannu', 'mannu', 'guddi',
  'chhavi', 'sapna', 'sonia', 'soniya', 'bhavna', 'dimple', 'khushboo', 'alka', 'anju',
  'kanchan', 'sudha', 'archana', 'sakshi', 'muskan', 'muskaan', 'nisha', 'roshni', 'komila'
])

export const KNOWN_MALE_NAMES = new Set([
  'rajesh', 'rahul', 'amit', 'puneet', 'rohit', 'vikas', 'suresh', 'ramesh', 'ajay',
  'vijay', 'sanjay', 'manoj', 'rakesh', 'deepak', 'anil', 'sunil', 'mukesh', 'dinesh',
  'mohit', 'sumit', 'aman', 'abaan', 'mohammad', 'mohd', 'khan', 'singh', 'kumar',
  'gaurav', 'sourabh', 'saurabh', 'ankit', 'ashish', 'abhishek', 'alok', 'arun', 'ashok',
  'shashank', 'mayank', 'prateek', 'prashant', 'praveen', 'naveen', 'tarun', 'varun',
  'rauf', 'sonu', 'rabis', 'sachin', 'nitin', 'nikhil', 'vivek', 'vishal', 'vikram',
  'harpreet', 'gurpreet', 'manpreet', 'jaspreet', 'kuldeep', 'sandip', 'sandeep',
  'pradeep', 'jagdish', 'mahesh', 'kamlesh', 'naresh', 'kailash', 'subhash', 'satish',
  'vinod', 'pramod', 'devendra', 'surendra', 'jitendra', 'dharmendra', 'ravindra',
  'bhupendra', 'arvind', 'govind', 'anand', 'prakash', 'om', 'shyam', 'ram', 'mohan',
  'sohan', 'roshan', 'chetan', 'pankaj', 'neeraj', 'hemant', 'lalit', 'manish', 'yogesh'
])

export const COMMON_INDIAN_SURNAMES = new Set([
  'sharma', 'verma', 'gupta', 'singh', 'kaur', 'yadav', 'patel', 'jain', 'choudhary',
  'chaudhary', 'agarwal', 'agrawal', 'mishra', 'tiwari', 'pandey', 'jha', 'joshi',
  'saini', 'rao', 'reddy', 'nair', 'pillai', 'khan', 'ali', 'sheikh', 'ansari',
  'bairwa', 'rajpurohit', 'rathore', 'chauhan', 'shekhawat', 'gehlot', 'meena', 'jangid',
  'kumari', 'devi', 'bano', 'khatoon', 'begum', 'das', 'roy', 'ghosh', 'banerjee'
])

export const NAME_BLACKLIST_WORDS = new Set([
  // Symptoms & clinical terms
  'pcod', 'pcos', 'tubal', 'blockage', 'fallopian', 'sperm', 'count', 'motility',
  'infertility', 'periods', 'period', 'baby', 'baccha', 'bacha', 'bache', 'bachey',
  'pregnancy', 'pregnant', 'conceive', 'conception', 'miscarriage', 'amh', 'fibroid',
  'cysts', 'cyst', 'ultrasound', 'hsg', 'semen', 'report', 'reports', 'dard', 'pain',
  'bleed', 'bleeding', 'white', 'discharge', 'problem', 'samasya', 'takleef', 'bimari',
  'ilaaj', 'treatment', 'upchar', 'dawa', 'dawai', 'medicine', 'nadi', 'jeebha', 'parikshan',

  // Actions, verbs & requests
  'call', 'batao', 'bataiye', 'bolo', 'boliye', 'suno', 'sun', 'dekh', 'dekho',
  'karo', 'karein', 'karna', 'karni', 'chahiye', 'bhejo', 'bheji', 'bheja', 'send',
  'aana', 'jana', 'milna', 'baat', 'consult', 'consultation', 'visit', 'book', 'booking',
  'dena', 'deni', 'lena', 'leni', 'kripya', 'please', 'madad', 'help', 'samjho', 'samjhao',
  'discuss', 'janana', 'jankari', 'detail', 'details', 'start', 'shuru',

  // Conversational fillers, affirmations, negation
  'ha', 'haa', 'haan', 'han', 'nahi', 'nahin', 'no', 'yes', 'ok', 'okay', 'theek',
  'thik', 'accha', 'achha', 'acha', 'shukriya', 'dhanyawad', 'thanks', 'thank', 'namaste',
  'namaskar', 'hello', 'hi', 'hey', 'hru', 'kaise', 'kaisa', 'kaisi', 'kya', 'haal', 'sab',
  'sir', 'maam', 'mam', 'madam', 'ji', 'bhai', 'didi', 'doctor', 'dr',

  // Money, numbers, fees & times
  'fees', 'fee', 'rupaye', 'rupees', 'rs', 'paise', 'kharche', 'kharch', 'online', 'offline',
  'free', 'discount', 'offer', 'aaj', 'kal', 'parso', 'today', 'tomorrow', 'morning',
  'evening', 'subah', 'shaam', 'baje', 'pm', 'am', 'time', 'date', 'tariq',

  // Places & clinic terms
  'clinic', 'hospital', 'jaipur', 'delhi', 'lucknow', 'amritsar', 'ludhiana', 'patna',
  'ranchi', 'hisar', 'rewari', 'city', 'shehar', 'shahar', 'pata', 'address', 'location',
  'near', 'kahan', 'kaha', 'kidhar',

  // Pronouns, prepositions & connectives
  'aap', 'aapko', 'aapka', 'aapki', 'aapke', 'mera', 'meri', 'mere', 'hum', 'hume',
  'humara', 'humari', 'tum', 'tera', 'teri', 'unka', 'unki', 'unke', 'woh', 'wo',
  'yeh', 'ye', 'kyu', 'kyun', 'kab', 'kiska', 'kiske', 'kiski', 'kitna', 'kitne',
  'kitni', 'aur', 'par', 'pe', 'se', 'ko', 'me', 'mein', 'mai', 'bhi', 'toh', 'to',
  'lekin', 'kyoki', 'kyunki', 'parantu', 'kuch', 'bahut', 'pareshan', 'sirf'
])

/**
 * Validates whether a text candidate is an actual Indian human name,
 * and NOT a medical symptom, question, conversational phrase, or action verb.
 */
export function isValidIndianPersonName(raw?: string | null): boolean {
  if (!raw) return false
  const clean = raw
    .trim()
    .replace(/^[:=\-\s]+/, '')
    .replace(/\s+(?:hai|hoon|hu|h|ji|sir|maam|madam)$/i, '')
    .trim()

  if (clean.length < 2 || clean.length > 30) return false
  if (!/^[a-zA-Z\u0900-\u097F\s.]+$/.test(clean)) return false

  const words = clean.split(/\s+/).map((w) => w.trim().toLowerCase()).filter(Boolean)
  if (words.length === 0 || words.length > 3) return false

  // If any word is in the non-name / medical / verb blacklist -> reject!
  if (words.some((w) => NAME_BLACKLIST_WORDS.has(w))) {
    return false
  }

  // If the candidate contains any recognized Indian first name or surname -> accept!
  for (const w of words) {
    if (KNOWN_FEMALE_NAMES.has(w) || KNOWN_MALE_NAMES.has(w) || COMMON_INDIAN_SURNAMES.has(w)) {
      return true
    }
  }

  // Devanagari names with 2-3 words where no word is blacklisted and length >= 3
  if (/^[\u0900-\u097F\s]+$/.test(clean) && words.length <= 2 && words.every((w) => w.length >= 3)) {
    return true
  }

  // English letters: 1-2 words where words end with typical Indian name phonology (a, i, eesh, deep, kant, endra, etc.)
  if (words.length <= 2) {
    const first = words[0]
    if (
      first.length >= 3 &&
      !NAME_BLACKLIST_WORDS.has(first) &&
      /(?:a|i|ee|ya|ka|na|ti|vi|ta|shi|ni|esh|raj|deep|pal|veer|jeet|kant|ender|endra|ant|an|ur|ik|al)$/.test(first)
    ) {
      return true
    }
  }

  return false
}

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


