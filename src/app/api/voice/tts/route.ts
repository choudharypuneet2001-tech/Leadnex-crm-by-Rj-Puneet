import { NextResponse } from 'next/server';
import { getCurrentAccount } from '@/lib/auth/account';
import { loadAiConfig } from '@/lib/ai/config';
import {
  synthesizeOpenAiSpeech,
  synthesizeElevenLabsSpeech,
  ELEVENLABS_INDIAN_FEMALE_VOICES,
  type VoicePersona,
  type VoiceProvider,
} from '@/lib/voice/voice-agent-service';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      text,
      provider = 'openai',
      voice = 'nova',
      voiceId,
      speed = 0.93,
      customApiKey,
      customElevenLabsApiKey,
    } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text is required for TTS synthesis.' }, { status: 400 });
    }

    // 1. ElevenLabs Speech Synthesis (Native Indian Hindi Voices)
    if (provider === 'elevenlabs' || voiceId) {
      const elevenKey =
        customElevenLabsApiKey?.trim() ||
        process.env.ELEVENLABS_API_KEY ||
        customApiKey?.trim() ||
        '';

      const targetVoiceId =
        voiceId ||
        ELEVENLABS_INDIAN_FEMALE_VOICES[voice]?.id ||
        ELEVENLABS_INDIAN_FEMALE_VOICES.monika_sogam.id;

      if (!elevenKey) {
        return NextResponse.json(
          {
            error:
              'ElevenLabs API Key नहीं मिली। कृपया सेटिंग्स में जाकर अपनी ElevenLabs Key दर्ज करें या .env.local में ELEVENLABS_API_KEY सेट करें।',
          },
          { status: 401 }
        );
      }

      try {
        const audioBuffer = await synthesizeElevenLabsSpeech({
          apiKey: elevenKey,
          text,
          voiceId: targetVoiceId,
        });

        const base64 = Buffer.from(audioBuffer).toString('base64');
        return NextResponse.json({
          success: true,
          provider: 'elevenlabs',
          voiceId: targetVoiceId,
          audioBase64: `data:audio/mp3;base64,${base64}`,
        });
      } catch (elevenErr: any) {
        console.warn('[voice/tts] ElevenLabs error, checking OpenAI fallback:', elevenErr?.message);
        // If caller explicitly requested ElevenLabs, bubble up informative error
        if (provider === 'elevenlabs' && !process.env.OPENAI_API_KEY && !customApiKey) {
          throw elevenErr;
        }
      }
    }

    // 2. OpenAI Speech Synthesis Fallback
    let openAiKey = customApiKey?.trim() || process.env.OPENAI_API_KEY || '';

    if (!openAiKey) {
      try {
        const { supabase, accountId } = await getCurrentAccount();
        const config = await loadAiConfig(supabase, accountId);
        if (config?.apiKey && config.provider === 'openai') {
          openAiKey = config.apiKey;
        }
      } catch {
        // Fallback
      }
    }

    if (!openAiKey) {
      return NextResponse.json(
        { error: 'TTS Synthesis के लिए API Key (ElevenLabs या OpenAI) आवश्यक है।' },
        { status: 401 }
      );
    }

    const audioBuffer = await synthesizeOpenAiSpeech({
      apiKey: openAiKey,
      text,
      voice: voice as VoicePersona,
      speed: Number(speed) || 1.0,
    });

    const base64 = Buffer.from(audioBuffer).toString('base64');
    return NextResponse.json({
      success: true,
      provider: 'openai',
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
