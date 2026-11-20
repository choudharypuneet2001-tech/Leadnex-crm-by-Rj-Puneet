import type { SupabaseClient } from '@supabase/supabase-js';
import type { Contact, Tag } from '@/types';

export const BLOCKED_TAG_NAME = '🚫 Blocked';

/**
 * Checks synchronously whether a hydrated contact has a blocked tag.
 */
export function isContactBlocked(
  contact?: (Partial<Contact> & { tags?: Tag[] }) | null
): boolean {
  if (!contact) return false;
  if (Array.isArray(contact.tags)) {
    return contact.tags.some((t) =>
      t.name.toLowerCase().includes('blocked')
    );
  }
  return false;
}

/**
 * Checks in Supabase whether a contact is blocked.
 * Checks both contact_tags for any tag containing 'blocked' and contact_notes for '[BLOCKED]'.
 */
export async function checkIfContactIsBlocked(
  supabase: SupabaseClient,
  contactId: string,
  _accountId?: string
): Promise<boolean> {
  if (!contactId) return false;

  try {
    // 1. Check contact_tags
    let query: any = supabase
      .from('contact_tags')
      .select('id, tags!inner(name)')
      .eq('contact_id', contactId);

    if (typeof query.ilike === 'function') {
      query = query.ilike('tags.name', '%blocked%');
    }
    if (typeof query.limit === 'function') {
      query = query.limit(1);
    }
    const { data: tagMatch } = await query;

    if (tagMatch && tagMatch.length > 0) {
      return true;
    }

    // 2. Fallback check contact_notes for [BLOCKED] marker
    let noteQuery: any = supabase
      .from('contact_notes')
      .select('id')
      .eq('contact_id', contactId);

    if (typeof noteQuery.ilike === 'function') {
      noteQuery = noteQuery.ilike('note_text', '%[BLOCKED]%');
    }
    if (typeof noteQuery.limit === 'function') {
      noteQuery = noteQuery.limit(1);
    }
    const { data: noteMatch } = await noteQuery;

    if (noteMatch && noteMatch.length > 0) {
      return true;
    }
  } catch (err) {
    console.warn('[block-service] Error checking blocked status:', err);
  }

  return false;
}

export interface BlockContactParams {
  supabase: SupabaseClient;
  contactId: string;
  accountId: string;
  userId: string;
  reason?: string;
}

/**
 * Adds a contact to the block list.
 * 1. Creates/finds the '🚫 Blocked' tag.
 * 2. Assigns it to the contact.
 * 3. Records a [BLOCKED] note with timestamp and reason.
 * 4. Closes active conversations and disables AI auto-replies.
 */
export async function blockContact({
  supabase,
  contactId,
  accountId,
  userId,
  reason,
}: BlockContactParams): Promise<{ success: boolean; tag?: Tag; error?: string }> {
  try {
    // 1. Find or create the Blocked tag
    let { data: existingTag } = await supabase
      .from('tags')
      .select('*')
      .eq('account_id', accountId)
      .ilike('name', '%blocked%')
      .maybeSingle();

    if (!existingTag) {
      const { data: newTag, error: createTagErr } = await supabase
        .from('tags')
        .insert({
          account_id: accountId,
          user_id: userId,
          name: BLOCKED_TAG_NAME,
          color: '#ef4444',
        })
        .select('*')
        .single();

      if (createTagErr && createTagErr.code !== '23505') {
        throw createTagErr;
      }
      existingTag = newTag;
    }

    if (existingTag) {
      // 2. Attach tag to contact
      const { error: tagAssignErr } = await supabase
        .from('contact_tags')
        .insert({
          contact_id: contactId,
          tag_id: existingTag.id,
        });

      // Ignore unique violation (23505) if already assigned
      if (tagAssignErr && tagAssignErr.code !== '23505') {
        console.warn('[block-service] Tag assignment warning:', tagAssignErr);
      }
    }

    // 3. Add note in contact_notes for clear audit trail
    const timestampStr = new Date().toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    const cleanReason = reason?.trim();
    const noteText = cleanReason
      ? `[BLOCKED] Patient ko block list mein daala gaya hai (${timestampStr}). Reason: ${cleanReason}. Inbound WhatsApp messages will be discarded.`
      : `[BLOCKED] Patient ko block list mein daala gaya hai (${timestampStr}). Faltu messages ki wajah se block kiya gaya. Inbound WhatsApp messages will be discarded.`;

    await supabase.from('contact_notes').insert({
      contact_id: contactId,
      user_id: userId,
      note_text: noteText,
    });

    // 4. Close any active conversation and disable AI auto-reply
    await supabase
      .from('conversations')
      .update({
        status: 'closed',
        ai_autoreply_disabled: true,
        updated_at: new Date().toISOString(),
      })
      .eq('contact_id', contactId);

    return { success: true, tag: existingTag || undefined };
  } catch (err: any) {
    console.error('[block-service] Failed to block contact:', err);
    return { success: false, error: err?.message || 'Failed to block contact' };
  }
}

export interface UnblockContactParams {
  supabase: SupabaseClient;
  contactId: string;
  accountId: string;
  userId: string;
}

/**
 * Removes a contact from the block list.
 * 1. Removes any 'blocked' tags from contact_tags.
 * 2. Adds an [UNBLOCKED] note.
 */
export async function unblockContact({
  supabase,
  contactId,
  accountId,
  userId,
}: UnblockContactParams): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Find all blocked tags for this account
    const { data: blockedTags } = await supabase
      .from('tags')
      .select('id')
      .eq('account_id', accountId)
      .ilike('name', '%blocked%');

    if (blockedTags && blockedTags.length > 0) {
      const tagIds = blockedTags.map((t) => t.id);
      await supabase
        .from('contact_tags')
        .delete()
        .eq('contact_id', contactId)
        .in('tag_id', tagIds);
    }

    // 2. Add an unblock audit note
    const timestampStr = new Date().toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    await supabase.from('contact_notes').insert({
      contact_id: contactId,
      user_id: userId,
      note_text: `[UNBLOCKED] Patient ko block list se hata diya gaya hai (${timestampStr}). Ab inke messages aam taur par receive honge.`,
    });

    return { success: true };
  } catch (err: any) {
    console.error('[block-service] Failed to unblock contact:', err);
    return { success: false, error: err?.message || 'Failed to unblock contact' };
  }
}
