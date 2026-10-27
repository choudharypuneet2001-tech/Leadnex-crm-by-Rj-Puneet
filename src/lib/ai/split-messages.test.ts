import { describe, it, expect } from 'vitest'
import { splitIntoWhatsAppChunks } from './split-messages'

describe('splitIntoWhatsAppChunks', () => {
  it('returns empty array for empty or whitespace string', () => {
    expect(splitIntoWhatsAppChunks('')).toEqual([])
    expect(splitIntoWhatsAppChunks('   \n  ')).toEqual([])
  })

  it('keeps short single sentences intact', () => {
    const text = 'Namaste! Welcome to Gynocci.'
    expect(splitIntoWhatsAppChunks(text)).toEqual([text])
  })

  it('splits on explicit --- delimiter', () => {
    const text = `Namaste! Welcome to Gynocci - Hope Begins With Us. 🙏
---
Kripya apna shubh naam aur shahar batayein taaki hum behtar help kar sakein?`
    const chunks = splitIntoWhatsAppChunks(text)
    expect(chunks).toHaveLength(2)
    expect(chunks[0]).toBe('Namaste! Welcome to Gynocci - Hope Begins With Us. 🙏')
    expect(chunks[1]).toBe('Kripya apna shubh naam aur shahar batayein taaki hum behtar help kar sakein?')
  })

  it('splits on paragraphs when paragraphs are moderate size', () => {
    const text = `Namaste Pooja ji! 🙏

Ovulation aamtaur par period aane ke 12th se 16th day ke beech hota hai. Yeh time conception ke liye sabse best hota hai.

Aapka last period kis date ko aaya tha?`
    const chunks = splitIntoWhatsAppChunks(text)
    expect(chunks).toHaveLength(3)
    expect(chunks[0]).toBe('Namaste Pooja ji! 🙏')
    expect(chunks[1]).toContain('Ovulation aamtaur par')
    expect(chunks[2]).toBe('Aapka last period kis date ko aaya tha?')
  })

  it('splits long paragraph into sentences when no explicit delimiters exist', () => {
    const text = 'Namaste Priya ji! Ovulation tracking pregnancy plan karne ke liye zaroori hai. Period shuru hone ke 12th se 16th din ke beech ovulation hota hai. Is samay pregnant hone ke chances sabse zyada hote hain. Kya aapka menstrual cycle regular hai?'
    const chunks = splitIntoWhatsAppChunks(text)
    expect(chunks.length).toBeGreaterThanOrEqual(2)
    expect(chunks.length).toBeLessThanOrEqual(4)
    expect(chunks.join(' ')).toContain('Priya ji')
    expect(chunks.join(' ')).toContain('menstrual cycle regular')
  })

  it('respects maxChunks limit', () => {
    const text = 'One. ---\nTwo. ---\nThree. ---\nFour. ---\nFive. ---\nSix.'
    const chunks = splitIntoWhatsAppChunks(text, 3)
    expect(chunks).toHaveLength(3)
  })
})
