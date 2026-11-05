import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isSuperAdminEmail } from '@/lib/auth/roles';
import { supabaseAdmin } from '@/lib/ai/admin-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export interface WorkspaceSummary {
  id: string;
  name: string;
  isCurrent: boolean;
  status: string;
  whatsappConnected: boolean;
  aiActive: boolean;
  category: 'marketing' | 'billing' | 'admin' | 'general';
  description: string;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user || !user.email) {
      return NextResponse.json(
        { error: 'Session expired or not logged in' },
        { status: 401 }
      );
    }

    const db = supabaseAdmin();

    const [profileRes, accountsRes, waRes, aiRes] = await Promise.all([
      db
        .from('profiles')
        .select('account_id, account_role, beta_features, email')
        .eq('user_id', user.id)
        .maybeSingle(),
      db
        .from('accounts')
        .select('id, name, default_currency, status, owner_user_id')
        .order('created_at', { ascending: true }),
      db
        .from('whatsapp_config')
        .select('account_id, phone_number_id'),
      db
        .from('ai_configs')
        .select('account_id, is_active, auto_reply_enabled'),
    ]);

    const profile = profileRes.data;
    const currentAccountId = profile?.account_id;
    const betaFeatures = profile?.beta_features || [];
    const isSuperAdmin = isSuperAdminEmail(user.email);

    const allAccounts = accountsRes.data || [];
    const waConfigs = waRes.data || [];
    const aiConfigs = aiRes.data || [];

    // Filter accounts accessible by this user
    const userEmail = (user.email || '').toLowerCase();
    const userDomain = userEmail.includes('@') ? userEmail.split('@')[1] : '';

    const currentAcc = allAccounts.find((a) => a.id === currentAccountId);

    const accessibleAccounts = allAccounts.filter((acc) => {
      // 1. Super Admin has universal access
      if (isSuperAdmin) return true;
      // 2. Currently active workspace
      if (acc.id === currentAccountId) return true;
      // 3. User owns this workspace
      if (acc.owner_user_id === user.id) return true;
      // 4. Workspace explicitly granted in beta_features
      if (betaFeatures.includes(`workspace:${acc.id}`)) return true;
      // 5. Workspaces belonging to the same organization/owner
      if (currentAcc && currentAcc.owner_user_id && currentAcc.owner_user_id === acc.owner_user_id) {
        return true;
      }
      // 6. Gynocci team member fallback
      if (
        userEmail.includes('puneet') ||
        userEmail.includes('choudhary') ||
        userDomain === 'gynocci.com' ||
        userEmail === 'dr.komalchoudhary05@gmail.com'
      ) {
        if (acc.name.toLowerCase().includes('gynocci') || acc.name.toLowerCase().includes('leadnex')) {
          return true;
        }
      }
      return false;
    });

    const workspaces: WorkspaceSummary[] = accessibleAccounts.map((acc) => {
      const isCurrent = acc.id === currentAccountId;
      const wa = waConfigs.find((w) => w.account_id === acc.id);
      const ai = aiConfigs.find((a) => a.account_id === acc.id);
      const isAiActive = !!(ai && ai.is_active && ai.auto_reply_enabled);

      const nameLower = acc.name.toLowerCase();
      let category: WorkspaceSummary['category'] = isAiActive ? 'marketing' : 'billing';
      let description = '';

      if (nameLower.includes('super admin') || nameLower.includes('leadnex admin')) {
        category = 'admin';
        description = 'Administration & System Overview';
      } else if (nameLower.includes('billing') || nameLower.includes('clinic') || nameLower.includes('support') || !isAiActive) {
        category = 'billing';
        description = isAiActive 
          ? 'Billing & Support (AI Active)'
          : 'Billing, Operations & Broadcasts (AI Off)';
      } else {
        category = 'marketing';
        description = isAiActive
          ? 'Marketing & Inbound Leads (AI Active)'
          : 'Marketing & Campaigns (Manual Chat)';
      }

      return {
        id: acc.id,
        name: acc.name,
        isCurrent,
        status: acc.status || 'active',
        whatsappConnected: !!wa?.phone_number_id,
        aiActive: isAiActive,
        category,
        description,
      };
    });

    return NextResponse.json({
      workspaces,
      currentAccountId,
    });
  } catch (error: any) {
    console.error('[GET /api/account/workspaces] error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

