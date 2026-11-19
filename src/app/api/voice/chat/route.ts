import { NextResponse } from 'next/server';
import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account';
import { loadAiConfig } from '@/lib/ai/config';
import {
  buildVoiceAgentPrompt,
  generateVoiceReply,
  synthesizeOpenAiSpeech,
  synthesizeElevenLabsSpeech,
  detectCallDisposition,
  ELEVENLABS_INDIAN_FEMALE_VOICES,
  type VoicePersona,
  type VoiceProvider,
} from '@/lib/voice/voice-agent-service';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      message,
      history = [],
      patientName,
      phone,
      concern,
      city,
      adName,
      voice = 'monika_sogam',
      voiceProvider = 'elevenlabs',
      voiceId,
      speed = 1.0,
      customApiKey,
      customElevenLabsApiKey,
    } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message text is required.' }, { status: 400 });
    }

    // Resolve OpenAI API key for conversational intelligence (GPT-4o-mini)
    let openAiKey = customApiKey?.trim() || process.env.OPENAI_API_KEY || '';

    if (!openAiKey) {
      try {
        const { supabase, accountId } = await getCurrentAccount();
        const config = await loadAiConfig(supabase, accountId);
        if (config?.apiKey && config.provider === 'openai') {
          openAiKey = config.apiKey;
        }
      } catch {
        // Fallback or unauthenticated testing
      }
    }

    if (!openAiKey) {
      return NextResponse.json(
        {
          error:
            'OpenAI API Key नहीं मिली। कृपया सेटिंग्स में जाकर अपनी OpenAI Key दर्ज करें या .env.local में OPENAI_API_KEY सेट करें।',
        },
        { status: 401 }
      );
    }

    // Build the clinical spoken prompt
    const systemPrompt = buildVoiceAgentPrompt({
      patientName,
      phone,
      concern,
      city,
      adName,
    });

    // 1. Generate Voice Conversation Reply via fast LLM
    const replyText = await generateVoiceReply({
      apiKey: openAiKey,
      systemPrompt,
      conversationHistory: history,
      userSpeechText: message,
    });

    // 2. Synthesize High-Quality Female Voice Speech
    let audioBase64: string | null = null;
    let actualProviderUsed: string = 'browser';

    // A. Check ElevenLabs (Natural Indian Hindi Female Voice: Monika Sogam / Kanishka)
    const elevenKey =
      customElevenLabsApiKey?.trim() ||
      process.env.ELEVENLABS_API_KEY ||
      '';

    const targetVoiceId =
      voiceId ||
      ELEVENLABS_INDIAN_FEMALE_VOICES[voice]?.id ||
      ELEVENLABS_INDIAN_FEMALE_VOICES.monika_sogam.id;

    if ((voiceProvider === 'elevenlabs' || !voiceProvider) && elevenKey) {
      try {
        const audioBuffer = await synthesizeElevenLabsSpeech({
          apiKey: elevenKey,
          text: replyText,
          voiceId: targetVoiceId,
        });

        audioBase64 = Buffer.from(audioBuffer).toString('base64');
        actualProviderUsed = 'elevenlabs';
      } catch (elevenErr: any) {
        console.warn('[voice/chat] ElevenLabs TTS warning, falling back to OpenAI:', elevenErr?.message);
      }
    }

    // B. Fallback to OpenAI TTS if ElevenLabs was not used or failed
    if (!audioBase64 && openAiKey) {
      try {
        const audioBuffer = await synthesizeOpenAiSpeech({
          apiKey: openAiKey,
          text: replyText,
          voice: (voice as VoicePersona) || 'shimmer',
          speed: Number(speed) || 1.0,
        });

        audioBase64 = Buffer.from(audioBuffer).toString('base64');
        actualProviderUsed = 'openai';
      } catch (ttsErr: any) {
        console.warn('[voice/chat] OpenAI TTS synthesis warning:', ttsErr?.message);
      }
    }

    // 3. Detect Call Outcome / Disposition
    const accumulatedText = [
      ...history.map((h: any) => h.content),
      message,
      replyText,
    ].join(' ');
    const disposition = detectCallDisposition(accumulatedText);

    return NextResponse.json({
      success: true,
      text: replyText,
      audioBase64: audioBase64 ? `data:audio/mp3;base64,${audioBase64}` : null,
      provider: actualProviderUsed,
      disposition: disposition.disposition,
      tagColor: disposition.tagColor,
    });
  } catch (err: any) {
    console.error('[voice/chat API error]:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to process voice conversation.' },
      { status: 500 }
    );
  }
}
