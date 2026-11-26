import { NextResponse } from 'next/server';
import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account';
import {
  DEFAULT_DISEASE_VIDEOS,
  DISEASE_VIDEOS_CONFIG_KEY,
  getManagedDiseaseVideos,
  saveManagedDiseaseVideos,
  syncFromGoogleSheetsUrl,
  parseDiseaseVideoCsv,
  type DiseaseVideoEntry,
} from '@/lib/ai/disease-video-links';

/**
 * GET /api/settings/disease-videos
 * Returns currently active disease educational video links and sync status.
 */
export async function GET() {
  try {
    const { supabase, accountId } = await getCurrentAccount();

    const { data } = await supabase
      .from('custom_fields')
      .select('field_options')
      .eq('account_id', accountId)
      .eq('field_name', DISEASE_VIDEOS_CONFIG_KEY)
      .maybeSingle();

    const stored = data?.field_options;
    const videos: DiseaseVideoEntry[] =
      stored?.videos && Array.isArray(stored.videos) && stored.videos.length > 0
        ? stored.videos
        : DEFAULT_DISEASE_VIDEOS;

    return NextResponse.json({
      videos,
      googleSheetsUrl: stored?.googleSheetsUrl || '',
      updatedAt: stored?.updated_at || null,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * POST /api/settings/disease-videos
 * Handles:
 * 1. action: 'save' -> updates videos array and googleSheetsUrl
 * 2. action: 'sync_sheet' -> fetches live CSV from Google Sheets URL and updates
 * 3. action: 'import_csv' -> parses raw pasted CSV text and updates
 * 4. action: 'reset' -> restores DEFAULT_DISEASE_VIDEOS
 */
export async function POST(req: Request) {
  try {
    const { supabase, accountId, userId } = await getCurrentAccount();
    const body = await req.json();
    const action = body.action || 'save';

    if (action === 'reset') {
      await saveManagedDiseaseVideos(supabase, accountId, DEFAULT_DISEASE_VIDEOS, '', userId);
      return NextResponse.json({
        success: true,
        message: 'Reset to default educational videos successfully.',
        videos: DEFAULT_DISEASE_VIDEOS,
      });
    }

    if (action === 'sync_sheet') {
      const sheetsUrl = body.googleSheetsUrl?.trim();
      if (!sheetsUrl) {
        return NextResponse.json({ error: 'Google Sheets URL is required.' }, { status: 400 });
      }

      const syncedVideos = await syncFromGoogleSheetsUrl(sheetsUrl);
      await saveManagedDiseaseVideos(supabase, accountId, syncedVideos, sheetsUrl, userId);

      return NextResponse.json({
        success: true,
        message: `Google Sheets synced successfully! ${syncedVideos.length} disease links updated.`,
        videos: syncedVideos,
        googleSheetsUrl: sheetsUrl,
      });
    }

    if (action === 'import_csv') {
      const csvText = body.csvText?.trim();
      if (!csvText) {
        return NextResponse.json({ error: 'CSV text is required.' }, { status: 400 });
      }

      const importedVideos = parseDiseaseVideoCsv(csvText);
      await saveManagedDiseaseVideos(supabase, accountId, importedVideos, body.googleSheetsUrl, userId);

      return NextResponse.json({
        success: true,
        message: `CSV imported successfully! ${importedVideos.length} disease links updated.`,
        videos: importedVideos,
      });
    }

    // Default 'save' action
    const videos = Array.isArray(body.videos) ? body.videos : DEFAULT_DISEASE_VIDEOS;
    const googleSheetsUrl = typeof body.googleSheetsUrl === 'string' ? body.googleSheetsUrl : '';

    await saveManagedDiseaseVideos(supabase, accountId, videos, googleSheetsUrl, userId);

    return NextResponse.json({
      success: true,
      message: 'Educational video links saved successfully.',
      videos,
      googleSheetsUrl,
    });
  } catch (err: any) {
    console.error('[disease-videos POST error]:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to update disease video links.' },
      { status: 500 }
    );
  }
}
