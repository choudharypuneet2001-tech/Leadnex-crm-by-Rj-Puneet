import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isSuperAdminEmail } from '@/lib/auth/roles';
import { supabaseAdmin } from '@/lib/ai/admin-client';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
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

    const body = await req.json().catch(() => ({}));
    const targetAccountId = body.targetAccountId;

    if (!targetAccountId || typeof targetAccountId !== 'string') {
      return NextResponse.json(
        { error: 'targetAccountId is required' },
        { status: 400 }
      );
    }

    const db = supabaseAdmin();

    // Verify target account exists
    const { data: targetAccount, error: accErr } = await db
      .from('accounts')
      .select('id, name, owner_user_id, status')
      .eq('id', targetAccountId)
      .maybeSingle();

    if (accErr || !targetAccount) {
      return NextResponse.json(
        { error: 'Target workspace not found' },
        { status: 404 }
      );
    }

    // Verify permission to switch
    const userEmail = (user.email || '').toLowerCase();
    const userDomain = userEmail.includes('@') ? userEmail.split('@')[1] : '';
    const isSuperAdmin = isSuperAdminEmail(userEmail);
    const { data: profile } = await db
      .from('profiles')
      .select('account_id, beta_features')
      .eq('user_id', user.id)
      .maybeSingle();

    const betaFeatures = profile?.beta_features || [];
    const isOwner = targetAccount.owner_user_id === user.id;
    const isGrantedInBeta = betaFeatures.includes(`workspace:${targetAccountId}`);

    // Check if target account shares the same owner as user's current account
    let isSameOrg = false;
    if (profile?.account_id) {
      const { data: currAcc } = await db
        .from('accounts')
        .select('owner_user_id')
        .eq('id', profile.account_id)
        .maybeSingle();
      if (currAcc && currAcc.owner_user_id && currAcc.owner_user_id === targetAccount.owner_user_id) {
        isSameOrg = true;
      }
    }

    const isLegacyGynocci =
      userEmail.includes('puneet') ||
      userEmail.includes('choudhary') ||
      userDomain === 'gynocci.com' ||
      userEmail === 'dr.komalchoudhary05@gmail.com';

    if (!isSuperAdmin && !isOwner && !isGrantedInBeta && !isSameOrg && !isLegacyGynocci) {
      console.warn(`[POST /api/account/switch] User ${userEmail} not permitted to switch to ${targetAccountId}`);
      return NextResponse.json(
        { error: 'You do not have permission to switch to this workspace' },
        { status: 403 }
      );
    }

    // Update caller's active tenancy
    const { error: updateErr } = await db
      .from('profiles')
      .update({
        account_id: targetAccount.id,
        account_role: 'owner',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (updateErr) {
      console.error('[POST /api/account/switch] update error:', updateErr);
      return NextResponse.json(
        { error: 'Failed to switch workspace: ' + updateErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      switchedTo: {
        id: targetAccount.id,
        name: targetAccount.name,
      },
    });
  } catch (error: any) {
    console.error('[POST /api/account/switch] error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

