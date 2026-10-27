import { describe, it, expect } from 'vitest'
import { latestUserMessage, isGreetingOnly } from './query'

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

