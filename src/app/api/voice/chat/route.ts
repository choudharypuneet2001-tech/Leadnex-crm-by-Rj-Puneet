import { NextResponse } from 'next/server';
import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account';
import { loadAiConfig } from '@/lib/ai/config';
import {
  buildVoiceAgentPrompt,
  generateVoiceReply,
  synthesizeOpenAiSpeech,
  detectCallDisposition,
  type VoicePersona,
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
      voice = 'shimmer',
      speed = 1.0,
      customApiKey,
    } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message text is required.' }, { status: 400 });
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
        // Fallback or unauthenticated testing
      }
    }

    if (!apiKey) {
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

    // 1. Generate Voice Conversation Reply
    const replyText = await generateVoiceReply({
      apiKey,
      systemPrompt,
      conversationHistory: history,
      userSpeechText: message,
    });

    // 2. Synthesize High-Quality Female Voice Speech (OpenAI TTS)
    let audioBase64: string | null = null;
    try {
      const audioBuffer = await synthesizeOpenAiSpeech({
        apiKey,
        text: replyText,
        voice: voice as VoicePersona,
        speed: Number(speed) || 1.0,
      });

      audioBase64 = Buffer.from(audioBuffer).toString('base64');
    } catch (ttsErr: any) {
      console.warn('[voice/chat] TTS synthesis warning:', ttsErr?.message);
      // Even if TTS audio fails due to network, text reply is returned safely
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
