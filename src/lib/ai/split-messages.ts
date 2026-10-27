/**
 * Splits an AI auto-reply into 1-4 short, bite-sized WhatsApp messages ("tukde").
 *
 * Real WhatsApp users find giant paragraphs overwhelming and slow to read.
 * This function divides responses into conversational chunks based on:
 * 1. Explicit message delimiters: '---' or '==='
 * 2. Clean paragraph breaks (\n\n+)
 * 3. Natural sentence boundaries for continuous text
 *
 * Guarantees between 1 and `maxChunks` (default 4) short, clean messages.
 */
export function splitIntoWhatsAppChunks(text: string, maxChunks = 4): string[] {
  const trimmed = text.trim()
  if (!trimmed) return []

  // Very short text (e.g. single sentence <= 120 chars) without explicit delimiter
  if (trimmed.length <= 120 && !trimmed.includes('---')) {
    return [trimmed]
  }

  // 1. Explicit delimiter '---' or '==='
  if (trimmed.includes('---') || trimmed.includes('===')) {
    const rawChunks = trimmed
      .split(/(?:\r?\n)?\s*(?:---+|===+)\s*(?:\r?\n)?/)
      .map((c) => c.trim())
      .filter(Boolean)
    if (rawChunks.length > 1) {
      return rawChunks.slice(0, maxChunks)
    }
  }

  // 2. Clean paragraph breaks (\n\n+)
  const paragraphs = trimmed
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter(Boolean)

  if (paragraphs.length >= 2 && paragraphs.length <= maxChunks) {
    const allModerate = paragraphs.every((p) => p.length < 350)
    if (allModerate) {
      return paragraphs
    }
  }

  // 3. Sentence boundaries for long or unformatted text
  const sentences = trimmed
    .split(/(?<=[.?!।\n])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)

  if (sentences.length <= 1) {
    return [trimmed]
  }

  const chunks: string[] = []
  let current = ''

  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i]
    if (!current) {
      current = s
    } else if (
      (current + ' ' + s).length <= 220 &&
      chunks.length < maxChunks - 1
    ) {
      current += (s.startsWith('\n') ? '' : ' ') + s
    } else {
      chunks.push(current)
      current = s
      if (chunks.length === maxChunks - 1) {
        // Collect all remaining sentences into the final chunk
        const remaining = sentences.slice(i + 1)
        if (remaining.length > 0) {
          current += ' ' + remaining.join(' ')
        }
        break
      }
    }
  }

  if (current) {
    chunks.push(current)
  }

  return chunks.slice(0, maxChunks).filter((c) => c.trim().length > 0)
}
