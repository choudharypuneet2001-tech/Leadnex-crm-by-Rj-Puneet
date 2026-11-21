import type { SupabaseClient } from '@supabase/supabase-js'
import type { ChatMessage } from './types'
import { aiContextMessageLimit } from './defaults'

interface DbMessage {
  sender_type: 'customer' | 'agent' | 'bot'
  content_type?: string | null
  content_text: string | null
}

/**
 * Fetch the last N text or media messages of a conversation and map them to the
 * provider-neutral chat shape. Customer messages become `user`; agent
 * and bot messages become `assistant`. Non-text messages like report photos or
 * document PDFs are assigned descriptive placeholders so the AI knows reports
 * were shared.
 *
 * Ordered oldest-first (chronological) so the transcript reads
 * naturally and the most recent customer message lands last.
 */
export async function buildConversationContext(
  db: SupabaseClient,
  conversationId: string,
  limit: number = aiContextMessageLimit(),
): Promise<ChatMessage[]> {
  let query: any = db
    .from('messages')
    .select('sender_type, content_type, content_text')
    .eq('conversation_id', conversationId)

  if (typeof query.in === 'function') {
    query = query.in('content_type', ['text', 'image', 'document', 'interactive'])
  }
  query = query.order('created_at', { ascending: false }).limit(limit)

  const { data, error } = await query

  if (error) throw error

  const rows = ((data ?? []) as DbMessage[]).reverse()
  return rows
    .map((m) => {
      let text = (m.content_text || '').trim()
      if (!text) {
        if (m.content_type === 'image') {
          text = '[Patient sent a report photo / image]'
        } else if (m.content_type === 'document') {
          text = '[Patient sent a report document / PDF]'
        }
      }
      return {
        role: m.sender_type === 'customer' ? ('user' as const) : ('assistant' as const),
        content: text,
      }
    })
    .filter((m) => m.content.length > 0)
}
