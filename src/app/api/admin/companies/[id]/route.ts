import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isSuperAdminEmail } from '@/lib/auth/roles';
import { supabaseAdmin } from '@/lib/ai/admin-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/admin/companies/[id]
 *
 * Super Admin endpoint to hold/suspend or resume a company.
 * Body: { status: 'active' | 'suspended', reason?: string }
 */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user || !user.email) {
      return NextResponse.json({ error: 'Session expired. Please sign in again.' }, { status: 401 });
    }

    if (!isSuperAdminEmail(user.email)) {
      return NextResponse.json(
        { error: 'Super Admin access required to manage company status' },
        { status: 403 },
      );
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
        { error: 'Failed to update company status: ' + error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      account: updated,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/companies/[id]
 *
 * Super Admin endpoint to delete a company account.
 */
export async function DELETE(request: Request, { params }: Params) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user || !user.email) {
      return NextResponse.json({ error: 'Session expired. Please sign in again.' }, { status: 401 });
    }

    if (!isSuperAdminEmail(user.email)) {
      return NextResponse.json(
        { error: 'Super Admin access required to delete a company' },
        { status: 403 },
      );
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

    if (targetAccount.owner_user_id === user.id) {
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
    const msg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
