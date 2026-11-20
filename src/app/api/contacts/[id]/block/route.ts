import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/account';
import {
  blockContact,
  unblockContact,
  checkIfContactIsBlocked,
} from '@/lib/contacts/block-service';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase, accountId } = await requireRole('viewer');
    const { id: contactId } = await params;

    const isBlocked = await checkIfContactIsBlocked(supabase, contactId, accountId);
    return NextResponse.json({ is_blocked: isBlocked });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to check block status' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Requires at least agent role
    const { supabase, accountId, userId } = await requireRole('agent');
    const { id: contactId } = await params;

    const body = await request.json().catch(() => ({}));
    const action = body.action || 'block'; // 'block' or 'unblock'
    const reason = body.reason;

    if (action === 'unblock') {
      const result = await unblockContact({
        supabase,
        contactId,
        accountId,
        userId,
      });

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        is_blocked: false,
        message: 'Patient unblocked successfully',
      });
    }

    // Default: block
    const result = await blockContact({
      supabase,
      contactId,
      accountId,
      userId,
      reason,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      is_blocked: true,
      tag: result.tag,
      message: 'Patient blocked successfully. Inbound messages will be discarded.',
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to update block status' },
      { status: 500 }
    );
  }
}
