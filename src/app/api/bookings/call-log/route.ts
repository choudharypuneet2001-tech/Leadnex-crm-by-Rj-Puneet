import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/ai/admin-client';

interface CallLogRequestBody {
  bookingId: string;
  disposition: 'not_connected' | 'callback' | 'confirmed' | 'not_interested';
  agentName: string;
  followupRec?: string;
}

const CALL_STATUS_TAGS = [
  'Not Connected',
  'Callback Requested',
  'Call Confirmed',
  'Not Interested',
] as const;

export async function POST(request: Request) {
  try {
    const ctx = await requireRole('viewer');
    const body = (await request.json().catch(() => null)) as CallLogRequestBody | null;

    if (!body || !body.bookingId || !body.disposition) {
      return NextResponse.json(
        { error: 'bookingId and disposition are required' },
        { status: 400 }
      );
    }

    const { bookingId, disposition, agentName = 'Agent', followupRec } = body;
    const admin = supabaseAdmin();

    // 1. Fetch booking
    const { data: booking, error: bookingErr } = await admin
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .eq('account_id', ctx.accountId)
      .single();

    if (bookingErr || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // 2. Resolve contact_id if missing
    let contactId = booking.contact_id;
    if (!contactId && booking.phone) {
      const cleanPhone = booking.phone.replace(/\D/g, '');
      const last10 = cleanPhone.slice(-10);
      if (last10) {
        const { data: matchedContact } = await admin
          .from('contacts')
          .select('id')
          .eq('account_id', ctx.accountId)
          .ilike('phone', `%${last10}%`)
          .maybeSingle();

        if (matchedContact) {
          contactId = matchedContact.id;
          await admin.from('bookings').update({ contact_id: contactId }).eq('id', booking.id);
        }
      }
    }

    // 2b. Automatically trace official agent name from authenticated user profile
    let officialAgentName = agentName?.trim() || 'Staff';
    try {
      const { data: userProfile } = await admin
        .from('profiles')
        .select('full_name')
        .eq('id', ctx.userId)
        .maybeSingle();

      if (userProfile?.full_name?.trim()) {
        officialAgentName = userProfile.full_name.trim();
      } else {
        const { data: fallbackProfile } = await admin
          .from('profiles')
          .select('full_name')
          .eq('user_id', ctx.userId)
          .maybeSingle();
        if (fallbackProfile?.full_name?.trim()) {
          officialAgentName = fallbackProfile.full_name.trim();
        }
      }
    } catch (profileErr) {
      console.warn('[call-log] profile name trace notice:', profileErr);
    }

    // 3. Update bookings table updated_at (Leave visit_outcome strictly to manual staff updating!)
    await admin
      .from('bookings')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', booking.id);

    // 4. Tagging in Tags column (Who called, disposition selected, next follow-up call)
    if (contactId) {
      // Helper to find or create tag
      const getOrCreateTag = async (tagName: string, tagColor: string): Promise<string> => {
        const { data: existing } = await admin
          .from('tags')
          .select('id')
          .eq('account_id', ctx.accountId)
          .ilike('name', tagName.trim())
          .maybeSingle();

        if (existing) return existing.id;

        const { data: created, error: createErr } = await admin
          .from('tags')
          .insert({
            account_id: ctx.accountId,
            user_id: ctx.userId,
            name: tagName.trim(),
            color: tagColor,
          })
          .select('id')
          .single();

        if (createErr || !created) {
          throw new Error(createErr?.message || `Failed to create tag "${tagName}"`);
        }
        return created.id;
      };

      // Tag A: Agent Call Tag (Who called - automatically traced from official user profile)
      const agentTagName = `Call By ${officialAgentName}`;
      const agentTagId = await getOrCreateTag(agentTagName, '#8b5cf6'); // Purple

      // Tag B: Call Disposition Tag (What was selected)
      let dispositionTagName = '';
      let dispositionColor = '#f43f5e';
      if (disposition === 'not_connected') {
        dispositionTagName = 'Not Connected';
        dispositionColor = '#f43f5e'; // Rose / Red
      } else if (disposition === 'callback') {
        dispositionTagName = 'Callback Requested';
        dispositionColor = '#f59e0b'; // Amber
      } else if (disposition === 'confirmed') {
        dispositionTagName = 'Call Confirmed';
        dispositionColor = '#10b981'; // Emerald / Green
      } else if (disposition === 'not_interested') {
        dispositionTagName = 'Not Interested';
        dispositionColor = '#64748b'; // Slate
      }

      const dispositionTagId = await getOrCreateTag(dispositionTagName, dispositionColor);

      // Tag C: Follow-up schedule tag (When to follow up)
      let followupTagId: string | null = null;
      if (disposition === 'not_connected' || disposition === 'callback') {
        const fuLabel = followupRec?.trim() || 'Today 06:00 PM';
        // Clean any trailing Hindi parentheses for concise badge tag
        const cleanFu = fuLabel.replace(/\s*\([^)]*\)/g, '').trim();
        const followupTagName = `Follow-up: ${cleanFu}`;
        followupTagId = await getOrCreateTag(followupTagName, '#0284c7'); // Sky blue
      }

      // Fetch all currently assigned tags for this contact
      const { data: currentContactTags } = await admin
        .from('contact_tags')
        .select('id, tag_id, tags(id, name)')
        .eq('contact_id', contactId);

      const tagsToRemove: string[] = [];

      (currentContactTags || []).forEach((ct: any) => {
        const tName = ct.tags?.name || '';
        // Remove previous conflicting agent tag if different
        if (
          tName.toLowerCase().startsWith('call by ') &&
          tName.toLowerCase() !== agentTagName.toLowerCase()
        ) {
          tagsToRemove.push(ct.tag_id);
        }
        // Remove previous conflicting disposition tag
        if (
          CALL_STATUS_TAGS.some((st) => st.toLowerCase() === tName.toLowerCase()) &&
          tName.toLowerCase() !== dispositionTagName.toLowerCase()
        ) {
          tagsToRemove.push(ct.tag_id);
        }
        // Remove previous follow-up tag
        if (
          tName.toLowerCase().startsWith('follow-up:') ||
          tName.toLowerCase().startsWith('next call:')
        ) {
          if (!followupTagId || ct.tag_id !== followupTagId) {
            tagsToRemove.push(ct.tag_id);
          }
        }
      });

      // Execute removals
      if (tagsToRemove.length > 0) {
        await admin
          .from('contact_tags')
          .delete()
          .eq('contact_id', contactId)
          .in('tag_id', tagsToRemove);
      }

      // Assign target tags
      const tagsToAssign = [agentTagId, dispositionTagId];
      if (followupTagId) {
        tagsToAssign.push(followupTagId);
      }

      for (const tid of tagsToAssign) {
        await admin
          .from('contact_tags')
          .insert({ contact_id: contactId, tag_id: tid })
          .select('id')
          .maybeSingle(); // ignore duplicate key constraint if already exists
      }

      // Fetch refreshed assigned tag IDs for this contact
      const { data: refreshedCTags } = await admin
        .from('contact_tags')
        .select('tag_id')
        .eq('contact_id', contactId);

      const contactTagIds = refreshedCTags?.map((r) => r.tag_id) || [];

      // Fetch all tags in the account
      const { data: allTags } = await admin
        .from('tags')
        .select('*')
        .eq('account_id', ctx.accountId)
        .order('name');

      return NextResponse.json({
        ok: true,
        contactId,
        contactTagIds,
        allTags: allTags || [],
        officialAgentName,
      });
    }

    return NextResponse.json({
      ok: true,
      contactId: null,
      contactTagIds: [],
      allTags: [],
      officialAgentName,
    });
  } catch (error) {
    console.error('[call-log] error:', error);
    return toErrorResponse(error);
  }
}
