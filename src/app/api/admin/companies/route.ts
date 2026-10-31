import { NextResponse } from 'next/server';
import { getCurrentAccount, ForbiddenError, toErrorResponse } from '@/lib/auth/account';
import { isSuperAdminEmail } from '@/lib/auth/roles';
import { supabaseAdmin } from '@/lib/ai/admin-client';

export async function GET() {
  try {
    const { supabase, userId } = await getCurrentAccount();

    const { data: userProfile } = await supabase
      .from('profiles')
      .select('email')
      .eq('user_id', userId)
      .maybeSingle();

    if (!isSuperAdminEmail(userProfile?.email)) {
      throw new ForbiddenError('Super Admin access required to view all companies');
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

    if (accountsRes.error) throw accountsRes.error;

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
    return toErrorResponse(err);
  }
}
