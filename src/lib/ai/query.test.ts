import { describe, it, expect } from 'vitest'
import { latestUserMessage, isGreetingOnly, isGreetingOrAdClick, cleanDisplayName } from './query'

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

