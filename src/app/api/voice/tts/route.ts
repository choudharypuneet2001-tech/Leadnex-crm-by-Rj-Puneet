import { NextResponse } from 'next/server';
import { getCurrentAccount } from '@/lib/auth/account';
import { loadAiConfig } from '@/lib/ai/config';
import { synthesizeOpenAiSpeech, type VoicePersona } from '@/lib/voice/voice-agent-service';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { text, voice = 'shimmer', speed = 1.0, customApiKey } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text is required for TTS synthesis.' }, { status: 400 });
    }

    // Resolve OpenAI API key
    let apiKey = customApiKey?.trim() || process.env.OPENAI_API_KEY || '';

    if (!apiKey) {
      try {
        const { supabase, accountId } = await getCurrentAccount();
        const config = await loadAiConfig(supabase, accountId);
        if (config?.apiKey && config.provider === 'openai') {
          apiKey = config.apiKey;
        }
      } catch {
        // Fallback
      }
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API Key is required for TTS synthesis.' },
        { status: 401 }
      );
    }

    const audioBuffer = await synthesizeOpenAiSpeech({
      apiKey,
      text,
      voice: voice as VoicePersona,
      speed: Number(speed) || 1.0,
    });

    const base64 = Buffer.from(audioBuffer).toString('base64');
    return NextResponse.json({
      success: true,
      audioBase64: `data:audio/mp3;base64,${base64}`,
    });
  } catch (err: any) {
    console.error('[voice/tts API error]:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to synthesize speech audio.' },
      { status: 500 }
    );
  }
}
