import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isSuperAdminEmail } from '@/lib/auth/roles';
import { supabaseAdmin } from '@/lib/ai/admin-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user || !user.email) {
      return NextResponse.json(
        { error: 'Session expired or not logged in. Please sign in again.' },
        { status: 401 }
      );
    }

    if (!isSuperAdminEmail(user.email)) {
      return NextResponse.json(
        { error: `Super Admin access required (${user.email} is not authorized)` },
        { status: 403 }
      );
    }

    const db = supabaseAdmin();

    const [
      accountsRes,
      profilesRes,
      whatsappRes,
      aiRes,
      contactsRes,
      conversationsRes,
    ] = await Promise.all([
      db.from('accounts').select('id, name, created_at, owner_user_id, status, suspension_reason').order('created_at', { ascending: false }),
      db.from('profiles').select('id, user_id, full_name, email, account_id, account_role'),
      db.from('whatsapp_config').select('account_id, phone_number_id, waba_id, created_at'),
      db.from('ai_configs').select('account_id, provider, model, is_active, auto_reply_enabled'),
      db.from('contacts').select('account_id'),
      db.from('conversations').select('account_id'),
    ]);

    if (accountsRes.error) {
      console.error('[admin/companies GET] accounts query error:', accountsRes.error);
      return NextResponse.json(
        { error: 'Failed to fetch accounts from database: ' + accountsRes.error.message },
        { status: 500 }
      );
    }

    const accounts = accountsRes.data || [];
    const profiles = profilesRes.data || [];
    const whatsappConfigs = whatsappRes.data || [];
    const aiConfigs = aiRes.data || [];
    const contacts = contactsRes.data || [];
    const conversations = conversationsRes.data || [];

    // Aggregates
    const contactCountMap: Record<string, number> = {};
    for (const c of contacts) {
      if (c.account_id) {
        contactCountMap[c.account_id] = (contactCountMap[c.account_id] || 0) + 1;
      }
    }

    const conversationCountMap: Record<string, number> = {};
    for (const cv of conversations) {
      if (cv.account_id) {
        conversationCountMap[cv.account_id] = (conversationCountMap[cv.account_id] || 0) + 1;
      }
    }

    const companies = accounts.map((acc) => {
      const owner =
        profiles.find((p) => p.account_id === acc.id && p.account_role === 'owner') ||
        profiles.find((p) => p.account_id === acc.id);
      const members = profiles.filter((p) => p.account_id === acc.id);
      const wa = whatsappConfigs.find((w) => w.account_id === acc.id);
      const ai = aiConfigs.find((a) => a.account_id === acc.id);

      return {
        id: acc.id,
        name: acc.name,
        createdAt: acc.created_at,
        status: acc.status || 'active',
        suspensionReason: acc.suspension_reason || null,
        owner: owner ? { name: owner.full_name, email: owner.email } : null,
        memberCount: members.length,
        contactsCount: contactCountMap[acc.id] || 0,
        conversationsCount: conversationCountMap[acc.id] || 0,
        whatsapp: wa
          ? {
              connected: true,
              phoneNumberId: wa.phone_number_id,
              wabaId: wa.waba_id,
            }
          : { connected: false },
        ai: ai
          ? {
              configured: true,
              provider: ai.provider,
              model: ai.model,
              isActive: ai.is_active,
              autoReply: ai.auto_reply_enabled,
            }
          : { configured: false },
      };
    });

    return NextResponse.json({
      success: true,
      companies,
      summary: {
        totalCompanies: companies.length,
        activeWhatsApp: companies.filter((c) => c.whatsapp.connected).length,
        activeAi: companies.filter((c) => c.ai.configured && c.ai.isActive).length,
        totalContacts: contacts.length,
        totalConversations: conversations.length,
      },
    });
  } catch (err) {
    console.error('[admin/companies GET] unexpected error:', err);
    const msg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
