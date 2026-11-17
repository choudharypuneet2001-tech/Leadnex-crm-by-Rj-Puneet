import { NextResponse } from 'next/server';
import { getCurrentAccount } from '@/lib/auth/account';
import { computeAnalytics } from '@/lib/analytics/analytics-service';
import type { AnalyticsDateRangePreset, DateRangeFilter } from '@/lib/analytics/types';
import type { Booking, Contact } from '@/types';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const preset = (searchParams.get('range') || 'all') as AnalyticsDateRangePreset;
    const from = searchParams.get('from') || undefined;
    const to = searchParams.get('to') || undefined;
    const adFilter = searchParams.get('ad_name') || undefined;

    const filter: DateRangeFilter = {
      preset,
      from,
      to,
    };

    let ctx: Awaited<ReturnType<typeof getCurrentAccount>> | null = null;
    try {
      ctx = await getCurrentAccount();
    } catch (authErr) {
      console.warn('[analytics API] getCurrentAccount warning (proceeding with fallback):', authErr);
    }

    let contactsData: any[] = [];
    let bookingsData: any[] = [];
    let convData: any[] = [];

    if (ctx?.supabase) {
      // 1. Fetch contacts
      try {
        let contactsQuery = ctx.supabase
          .from('contacts')
          .select('*')
          .order('created_at', { ascending: false });

        if (ctx.accountId) {
          contactsQuery = contactsQuery.eq('account_id', ctx.accountId);
        }

        const res = await contactsQuery;
        if (!res.error && res.data) {
          contactsData = res.data;
        } else {
          // Retry without account_id filter in case RLS scopes it
          const retryRes = await ctx.supabase
            .from('contacts')
            .select('*')
            .order('created_at', { ascending: false });
          if (retryRes.data) contactsData = retryRes.data;
        }
      } catch (err) {
        console.warn('[analytics API] contacts fetch suppressed error:', err);
      }

      // 2. Fetch bookings
      try {
        let bookingsQuery = ctx.supabase
          .from('bookings')
          .select('*')
          .order('created_at', { ascending: false });

        if (ctx.accountId) {
          bookingsQuery = bookingsQuery.eq('account_id', ctx.accountId);
        }

        const res = await bookingsQuery;
        if (!res.error && res.data) {
          bookingsData = res.data;
        } else {
          const retryRes = await ctx.supabase
            .from('bookings')
            .select('*')
            .order('created_at', { ascending: false });
          if (retryRes.data) bookingsData = retryRes.data;
        }
      } catch (err) {
        console.warn('[analytics API] bookings fetch suppressed error:', err);
      }

      // 3. Fetch conversations
      try {
        let convQuery = ctx.supabase
          .from('conversations')
          .select('id, contact_id, last_message_text, last_message_at')
          .order('last_message_at', { ascending: false });

        if (ctx.accountId) {
          convQuery = convQuery.eq('account_id', ctx.accountId);
        }

        const res = await convQuery;
        if (!res.error && res.data) {
          convData = res.data;
        } else {
          const retryRes = await ctx.supabase
            .from('conversations')
            .select('id, contact_id, last_message_text, last_message_at')
            .order('last_message_at', { ascending: false });
          if (retryRes.data) convData = retryRes.data;
        }
      } catch (err) {
        console.warn('[analytics API] conversations fetch suppressed error:', err);
      }
    }

    const contacts = (contactsData || []) as unknown as Contact[];
    const bookings = (bookingsData || []) as unknown as Booking[];
    const conversations = (convData || []) as {
      id: string;
      contact_id: string;
      last_message_text?: string | null;
      last_message_at?: string | null;
    }[];

    const summary = computeAnalytics(contacts, bookings, filter, adFilter, conversations);

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (err) {
    console.error('[analytics API] unexpected error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown analytics error' },
      { status: 500 }
    );
  }
}
