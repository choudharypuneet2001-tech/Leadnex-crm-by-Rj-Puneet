import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/flows/admin-client';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { accountId } = await requireRole('viewer');
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof body.status === 'string' && ['open', 'pending', 'closed'].includes(body.status)) {
      update.status = body.status;
    }
    if ('assigned_agent_id' in body) {
      update.assigned_agent_id = body.assigned_agent_id || null;
    }
    if (typeof body.unread_count === 'number') {
      update.unread_count = body.unread_count;
    }

    const { data, error } = await supabaseAdmin()
      .from('conversations')
      .update(update)
      .eq('id', id)
      .eq('account_id', accountId)
      .select()
      .maybeSingle();

    if (error) {
      console.error('[PATCH /api/conversations/[id]] error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, conversation: data });
  } catch (err) {
    return toErrorResponse(err);
  }
}
