import { NextResponse } from 'next/server';
import { getCurrentAccount, ForbiddenError, toErrorResponse } from '@/lib/auth/account';
import { isSuperAdminEmail } from '@/lib/auth/roles';
import { supabaseAdmin } from '@/lib/ai/admin-client';

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/admin/companies/[id]
 *
 * Super Admin endpoint to hold/suspend or resume a company.
 * Body: { status: 'active' | 'suspended', reason?: string }
 */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { supabase, userId } = await getCurrentAccount();

    const { data: userProfile } = await supabase
      .from('profiles')
      .select('email')
      .eq('user_id', userId)
      .maybeSingle();

    if (!isSuperAdminEmail(userProfile?.email)) {
      throw new ForbiddenError('Super Admin access required to manage company status');
    }

    const { id: targetAccountId } = await params;
    const body = await request.json().catch(() => null);

    if (!body || !['active', 'suspended'].includes(body.status)) {
      return NextResponse.json(
        { error: "status must be either 'active' or 'suspended'" },
        { status: 400 },
      );
    }

    const db = supabaseAdmin();

    const { data: updated, error } = await db
      .from('accounts')
      .update({
        status: body.status,
        suspension_reason: body.reason || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetAccountId)
      .select()
      .single();

    if (error) {
      console.error('[admin/companies PATCH] update error:', error);
      return NextResponse.json(
        { error: 'Failed to update company status' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      account: updated,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * DELETE /api/admin/companies/[id]
 *
 * Super Admin endpoint to delete a company account.
 */
export async function DELETE(request: Request, { params }: Params) {
  try {
    const { supabase, userId } = await getCurrentAccount();

    const { data: userProfile } = await supabase
      .from('profiles')
      .select('email')
      .eq('user_id', userId)
      .maybeSingle();

    if (!isSuperAdminEmail(userProfile?.email)) {
      throw new ForbiddenError('Super Admin access required to delete a company');
    }

    const { id: targetAccountId } = await params;
    const db = supabaseAdmin();

    // Prevent deleting Puneet's own master account
    const { data: targetAccount } = await db
      .from('accounts')
      .select('id, name, owner_user_id')
      .eq('id', targetAccountId)
      .maybeSingle();

    if (!targetAccount) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    if (targetAccount.owner_user_id === userId) {
      return NextResponse.json(
        { error: 'You cannot delete your own master account' },
        { status: 400 },
      );
    }

    // Delete the account (cascades to all child tables with ON DELETE CASCADE)
    const { error: deleteErr } = await db
      .from('accounts')
      .delete()
      .eq('id', targetAccountId);

    if (deleteErr) {
      console.error('[admin/companies DELETE] error:', deleteErr);
      return NextResponse.json(
        { error: 'Failed to delete company: ' + deleteErr.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Company deleted successfully',
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
