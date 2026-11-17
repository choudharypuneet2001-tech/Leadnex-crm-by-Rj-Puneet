import { NextResponse } from 'next/server';
import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account';
import { computeAnalytics } from '@/lib/analytics/analytics-service';
import type { AnalyticsDateRangePreset, DateRangeFilter } from '@/lib/analytics/types';
import type { Booking, Contact } from '@/types';

export async function GET(request: Request) {
  let ctx;
  try {
    ctx = await getCurrentAccount();
  } catch (err) {
    return toErrorResponse(err);
  }

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

    // Fetch contacts for this account
    const { data: contactsData, error: contactsErr } = await ctx.supabase
      .from('contacts')
      .select('id, name, first_name, last_name, phone, city, ad_id, ad_name, ad_source, ad_source_url, ad_body, ad_media_url, created_at, updated_at')
      .eq('account_id', ctx.accountId)
      .order('created_at', { ascending: false });

    if (contactsErr) {
      console.error('[analytics API] contacts fetch error:', contactsErr);
      return NextResponse.json({ error: 'Failed to fetch contacts' }, { status: 500 });
    }

    // Fetch bookings for this account
    const { data: bookingsData, error: bookingsErr } = await ctx.supabase
      .from('bookings')
      .select('*')
      .eq('account_id', ctx.accountId)
      .order('created_at', { ascending: false });

    if (bookingsErr) {
      console.error('[analytics API] bookings fetch error:', bookingsErr);
      return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 });
    }

    const contacts = (contactsData || []) as unknown as Contact[];
    const bookings = (bookingsData || []) as unknown as Booking[];

    const summary = computeAnalytics(contacts, bookings, filter, adFilter);

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
