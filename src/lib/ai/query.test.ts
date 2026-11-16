import { describe, it, expect } from 'vitest'
import {
  latestUserMessage,
  isGreetingOnly,
  isGreetingOrAdClick,
  cleanDisplayName,
  isEnglishMessage,
  isLikelyFemaleName,
  detectRequestedLanguage,
  resolveConversationLanguage,
  SUPPORTED_INDIAN_LANGUAGES,
} from './query'

describe('latestUserMessage', () => {
  it('returns the most recent user turn', () => {
    expect(
      latestUserMessage([
        { role: 'user', content: 'first' },
        { role: 'assistant', content: 'reply' },
        { role: 'user', content: 'latest' },
      ]),
    ).toBe('latest')
  })

  it('falls back to the last message when none are user', () => {
    expect(
      latestUserMessage([{ role: 'assistant', content: 'only assistant' }]),
    ).toBe('only assistant')
  })

  it('returns empty string for no messages', () => {
    expect(latestUserMessage([])).toBe('')
  })
})

describe('isGreetingOnly', () => {
  it('detects pure greetings', () => {
    expect(isGreetingOnly('hi')).toBe(true)
    expect(isGreetingOnly('Hello!')).toBe(true)
    expect(isGreetingOnly('Namaskar')).toBe(true)
    expect(isGreetingOnly('Namaste ji 🙏')).toBe(true)
    expect(isGreetingOnly('Good morning sir')).toBe(true)
    expect(isGreetingOnly('Hi doctor')).toBe(true)
    expect(isGreetingOnly('Radhe Radhe')).toBe(true)
    expect(isGreetingOnly('Kaise ho aap?')).toBe(true)
  })

  it('returns false for questions and clinical messages', () => {
    expect(isGreetingOnly('PCOS treatment')).toBe(false)
    expect(isGreetingOnly('Mujhe consult karna hai')).toBe(false)
    expect(isGreetingOnly('Namaste, fees kitni hai?')).toBe(false)
    expect(isGreetingOnly('Mera naam Anjali hai')).toBe(false)
    expect(isGreetingOnly('Ovulation tracking kaise karein')).toBe(false)
    expect(isGreetingOnly('')).toBe(false)
  })
})

describe('isGreetingOrAdClick', () => {
  it('detects both greetings and ad referral prefill text', () => {
    expect(isGreetingOrAdClick('Hi')).toBe(true)
    expect(isGreetingOrAdClick('Hi, I saw your ad on Facebook')).toBe(true)
    expect(isGreetingOrAdClick('I saw this on Facebook')).toBe(true)
    expect(isGreetingOrAdClick('Interested in this')).toBe(true)
    expect(isGreetingOrAdClick('Please send details')).toBe(true)
    expect(isGreetingOrAdClick('Mujhe jankari chahiye')).toBe(true)
    expect(isGreetingOrAdClick('Hello I saw your ad on Instagram')).toBe(true)
  })

  it('does not classify complex medical queries as ad greetings', () => {
    expect(isGreetingOrAdClick('Mujhe periods me dard hota hai')).toBe(false)
    expect(isGreetingOrAdClick('IVF cycle fail hone par kya karein')).toBe(false)
  })
})

describe('cleanDisplayName', () => {
  it('strips emojis, brackets, symbols, and phone numbers', () => {
    expect(cleanDisplayName('Rj Puneet ( जाट ) 🦅')).toBe('Rj Puneet')
    expect(cleanDisplayName('Priya ❤️')).toBe('Priya')
    expect(cleanDisplayName('Dr. Komal Choudhary')).toBe('Dr. Komal Choudhary')
    expect(cleanDisplayName('+919588233263')).toBe(null)
    expect(cleanDisplayName('')).toBe(null)
    expect(cleanDisplayName(null)).toBe(null)
  })
})

describe('isEnglishMessage', () => {
  it('detects explicit English requests', () => {
    expect(isEnglishMessage('Can you talk in engiish with me')).toBe(true)
    expect(isEnglishMessage('Can you talk in english with me')).toBe(true)
    expect(isEnglishMessage('Please speak in english')).toBe(true)
    expect(isEnglishMessage('talk with me in english')).toBe(true)
    expect(isEnglishMessage('english mein baat karo')).toBe(true)
    expect(isEnglishMessage('english please')).toBe(true)
  })

  it('rejects general English or Hinglish text so the AI defaults to Hindi as per business rule', () => {
    expect(isEnglishMessage('Where is your clinic?')).toBe(false)
    expect(isEnglishMessage('What are the consultation fees?')).toBe(false)
    expect(isEnglishMessage('I want to book an appointment for tomorrow')).toBe(false)
    expect(isEnglishMessage('Fees kab deni hai mujhe')).toBe(false)
    expect(isEnglishMessage('Mein jaipur se hu')).toBe(false)
    expect(isEnglishMessage('Doctor se kab mil sakte hain')).toBe(false)
    expect(isEnglishMessage('Namaste, mujhe bikaner me clinic dekhna hai')).toBe(false)
    expect(isEnglishMessage('Bikaner')).toBe(false)
    expect(isEnglishMessage('Jaipur')).toBe(false)
    expect(isEnglishMessage('Haa book kar do')).toBe(false)
    expect(isEnglishMessage('Kya online consult ho sakta hai?')).toBe(false)
    expect(isEnglishMessage('नमस्ते डॉक्टर')).toBe(false)
  })
})

describe('isLikelyFemaleName', () => {
  it('identifies common Indian female names', () => {
    expect(isLikelyFemaleName('Priya')).toBe(true)
    expect(isLikelyFemaleName('Pooja')).toBe(true)
    expect(isLikelyFemaleName('Meenal')).toBe(true)
    expect(isLikelyFemaleName('Mumtreen')).toBe(true)
    expect(isLikelyFemaleName('Sunita')).toBe(true)
    expect(isLikelyFemaleName('Anjali')).toBe(true)
    expect(isLikelyFemaleName('Sheetal')).toBe(true)
    expect(isLikelyFemaleName('Komal')).toBe(true)
  })

  it('identifies male names as false', () => {
    expect(isLikelyFemaleName('Rajesh')).toBe(false)
    expect(isLikelyFemaleName('Rahul')).toBe(false)
    expect(isLikelyFemaleName('Amit')).toBe(false)
    expect(isLikelyFemaleName('Rj Puneet')).toBe(false)
    expect(isLikelyFemaleName('Abaan')).toBe(false)
    expect(isLikelyFemaleName('Mohammad')).toBe(false)
    expect(isLikelyFemaleName('Deepak')).toBe(false)
    expect(isLikelyFemaleName('Ravi')).toBe(false)
  })
})

describe('detectRequestedLanguage', () => {
  it('detects Punjabi through keywords and Gurmukhi script', () => {
    expect(detectRequestedLanguage('punjabi vich gal karo')?.code).toBe('pa')
    expect(detectRequestedLanguage('punjabi')?.code).toBe('pa')
    expect(detectRequestedLanguage('ਸਤਿ ਸ਼੍ਰੀ ਅਕਾਲ ਜੀ')?.code).toBe('pa')
  })

  it('detects Marathi through keywords and phrases', () => {
    expect(detectRequestedLanguage('marathi madhe bola')?.code).toBe('mr')
    expect(detectRequestedLanguage('मराठीत बोला')?.code).toBe('mr')
    expect(detectRequestedLanguage('marathi')?.code).toBe('mr')
  })

  it('detects Bengali through keywords and script', () => {
    expect(detectRequestedLanguage('bangla e kotha bolun')?.code).toBe('bn')
    expect(detectRequestedLanguage('bengali')?.code).toBe('bn')
    expect(detectRequestedLanguage('নমস্কার')?.code).toBe('bn')
  })

  it('detects Telugu through keywords and script', () => {
    expect(detectRequestedLanguage('telugu lo matladandi')?.code).toBe('te')
    expect(detectRequestedLanguage('నమస్కారం')?.code).toBe('te')
  })

  it('detects Tamil and avoids false positive on Tamil Nadu place name', () => {
    expect(detectRequestedLanguage('tamilil pesavum')?.code).toBe('ta')
    expect(detectRequestedLanguage('வணக்கம்')?.code).toBe('ta')
    expect(detectRequestedLanguage('Main Tamil Nadu se hu')).toBe(null)
  })

  it('detects Gujarati through keywords and script', () => {
    expect(detectRequestedLanguage('gujarati ma vat karo')?.code).toBe('gu')
    expect(detectRequestedLanguage('કેમ છો')?.code).toBe('gu')
  })

  it('detects Kannada, Malayalam, Odia, Urdu, and regional languages', () => {
    expect(detectRequestedLanguage('kannadadalli mathanadi')?.code).toBe('kn')
    expect(detectRequestedLanguage('മലയാളം')?.code).toBe('ml')
    expect(detectRequestedLanguage('odia re katha kuha')?.code).toBe('or')
    expect(detectRequestedLanguage('اردو')?.code).toBe('ur')
    expect(detectRequestedLanguage('urdu mein baat karein')?.code).toBe('ur')
    expect(detectRequestedLanguage('bhojpuri me baat kara')?.code).toBe('bho')
    expect(detectRequestedLanguage('marwari me bolo')?.code).toBe('raj')
    expect(detectRequestedLanguage('मैथिली')?.code).toBe('mai')
  })

  it('detects English and explicit switch back to Hindi', () => {
    expect(detectRequestedLanguage('can you talk in english with me')?.code).toBe('en')
    expect(detectRequestedLanguage('hindi me baat karo')?.code).toBe('hi')
    expect(detectRequestedLanguage('हिंदी में बात करो')?.code).toBe('hi')
  })

  it('returns null for general Hindi/Hinglish queries so default applies', () => {
    expect(detectRequestedLanguage('Mujhe appointment chahiye')).toBe(null)
    expect(detectRequestedLanguage('Clinic kahan hai?')).toBe(null)
    expect(detectRequestedLanguage('Mein Jaipur se hu')).toBe(null)
    expect(detectRequestedLanguage('Mein Punjab se hu')).toBe(null)
  })
})

describe('resolveConversationLanguage', () => {
  it('defaults to Hindi when no explicit language preference exists', () => {
    const lang = resolveConversationLanguage('Mujhe PCOS ka ilaaj chahiye', [])
    expect(lang.code).toBe('hi')
    expect(lang.isDefaultHindi).toBe(true)
  })

  it('switches immediately on current turn language request', () => {
    const lang = resolveConversationLanguage('punjabi vich gal karo', [
      { role: 'user', content: 'hello' },
    ])
    expect(lang.code).toBe('pa')
  })

  it('maintains language persistently from conversation history', () => {
    const lang = resolveConversationLanguage('Mera naam Gurpreet hai, Ludhiana to', [
      { role: 'user', content: 'punjabi vich gal karo' },
      { role: 'assistant', content: 'ਸਤਿ ਸ਼੍ਰੀ ਅਕਾਲ ਜੀ! Gynocci Femtech ਵਿੱਚ ਤੁਹਾਡਾ ਸਵਾਗਤ ਹੈ।' },
    ])
    expect(lang.code).toBe('pa')
  })

  it('switches back to Hindi when customer requests Hindi mid-conversation', () => {
    const lang = resolveConversationLanguage('ab hindi me baat karo', [
      { role: 'user', content: 'punjabi vich gal karo' },
      { role: 'assistant', content: 'ਸਤਿ ਸ਼੍ਰੀ ਅਕਾਲ ਜੀ!' },
    ])
    expect(lang.code).toBe('hi')
  })
})

