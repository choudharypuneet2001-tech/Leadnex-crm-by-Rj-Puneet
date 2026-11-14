import { describe, it, expect } from 'vitest'
import {
  latestUserMessage,
  isGreetingOnly,
  isGreetingOrAdClick,
  cleanDisplayName,
  isEnglishMessage,
  isLikelyFemaleName,
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
  it('detects English requests and messages', () => {
    expect(isEnglishMessage('Can you talk in engiish with me')).toBe(true)
    expect(isEnglishMessage('Can you talk in english with me')).toBe(true)
    expect(isEnglishMessage('Please speak in english')).toBe(true)
    expect(isEnglishMessage('Where is your clinic?')).toBe(true)
    expect(isEnglishMessage('What are the consultation fees?')).toBe(true)
    expect(isEnglishMessage('I want to book an appointment for tomorrow')).toBe(true)
    expect(isEnglishMessage('My wife has tubal blockage issue')).toBe(true)
    expect(isEnglishMessage('Hello doctor, can you help me with pcod?')).toBe(true)
    expect(isEnglishMessage('Yes please book for me')).toBe(true)
    expect(isEnglishMessage('Is there any branch in Mumbai?')).toBe(true)
  })

  it('rejects Hindi / Roman Hinglish messages so they receive Hindi replies', () => {
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

