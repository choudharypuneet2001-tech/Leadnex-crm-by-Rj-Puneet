import { NextResponse } from 'next/server';
import { getCurrentAccount, requireRole, toErrorResponse } from '@/lib/auth/account';
import {
  DEFAULT_CLINICS,
  getManagedClinics,
  saveManagedClinics,
  type ManagedClinic,
} from '@/lib/clinics/clinics-service';

export async function GET() {
  try {
    const { supabase, accountId } = await getCurrentAccount();
    const clinics = await getManagedClinics(supabase, accountId);
    return NextResponse.json({ clinics });
  } catch (err) {
    // If not authenticated or error, return default clinics safely
    return NextResponse.json({ clinics: DEFAULT_CLINICS });
  }
}

export async function POST(request: Request) {
  let ctx;
  try {
    ctx = await requireRole('agent');
  } catch (err) {
    return toErrorResponse(err);
  }

  try {
    const body = (await request.json().catch(() => null)) as {
      clinic?: Partial<ManagedClinic>;
    } | null;

    if (!body?.clinic) {
      return NextResponse.json({ error: 'clinic payload required' }, { status: 400 });
    }

    const input = body.clinic;
    const city = input.city?.trim() || '';
    const name = input.name?.trim() || city;

    if (!city) {
      return NextResponse.json({ error: 'City is required' }, { status: 400 });
    }

    const currentClinics = await getManagedClinics(ctx.supabase, ctx.accountId);

    let updatedList: ManagedClinic[];
    if (input.id) {
      // Update existing
      updatedList = currentClinics.map((c) =>
        c.id === input.id
          ? {
              ...c,
              city,
              name: name || c.name,
              address: input.address?.trim() ?? c.address,
              landmark: input.landmark?.trim() ?? c.landmark,
              google_maps_url: input.google_maps_url?.trim() ?? c.google_maps_url,
              helpline: input.helpline?.trim() ?? c.helpline,
              timings: input.timings?.trim() ?? c.timings,
              is_active: input.is_active !== undefined ? input.is_active : c.is_active,
              display_order: input.display_order !== undefined ? input.display_order : c.display_order,
            }
          : c
      );
    } else {
      // Add new clinic
      const newClinic: ManagedClinic = {
        id: `clinic-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        city,
        name: name || `${city} Clinic`,
        address: input.address?.trim() || '',
        landmark: input.landmark?.trim() || '',
        google_maps_url: input.google_maps_url?.trim() || `https://maps.google.com/?q=Gynocci+${encodeURIComponent(city)}`,
        helpline: input.helpline?.trim() || '+91 93524 93700',
        timings: input.timings?.trim() || '10:00 AM से 6:30 PM (सोमवार से रविवार - सातों दिन खुला)',
        is_active: input.is_active !== undefined ? input.is_active : true,
        display_order: currentClinics.length + 1,
      };
      updatedList = [...currentClinics, newClinic];
    }

    await saveManagedClinics(ctx.supabase, ctx.accountId, updatedList, ctx.userId);

    return NextResponse.json({ ok: true, clinics: updatedList });
  } catch (err: any) {
    console.error('[clinics api] POST error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to save clinic' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  let ctx;
  try {
    ctx = await requireRole('agent');
  } catch (err) {
    return toErrorResponse(err);
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Clinic id is required' }, { status: 400 });
    }

    const currentClinics = await getManagedClinics(ctx.supabase, ctx.accountId);
    const filtered = currentClinics.filter((c) => c.id !== id);

    await saveManagedClinics(ctx.supabase, ctx.accountId, filtered, ctx.userId);

    return NextResponse.json({ ok: true, clinics: filtered });
  } catch (err: any) {
    console.error('[clinics api] DELETE error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to delete clinic' }, { status: 500 });
  }
}
