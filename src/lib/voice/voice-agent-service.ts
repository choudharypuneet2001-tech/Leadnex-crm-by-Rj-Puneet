import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/ai/admin-client';
import { loadAiConfig } from '@/lib/ai/config';
import { findDiseaseVideo, DEFAULT_DISEASE_VIDEOS } from '@/lib/ai/disease-video-links';

export type VoiceGender = 'female' | 'male';
export type VoicePersona = 'nova' | 'shimmer' | 'sage' | 'alloy' | 'coral';
export type VoiceProvider = 'openai' | 'elevenlabs';

/**
 * Normalizes Hindi text specifically for TTS to eliminate robotic pronunciation.
 * When TTS engines receive raw numbers (₹499, 5, 9), medical acronyms (IVF, PCOD),
 * or English brand names (Gynocci), they stutter with an awkward American robot accent.
 *
 * This normalizer converts numbers to Hindi words, maps medical terms phonetically,
 * and adds soft breathing pauses for a warm, human-like Indian female cadence.
 */
export function normalizeHindiForSpeech(rawText: string): string {
  if (!rawText) return '';

  let text = rawText;

  // 1. Brand & Clinic Names
  text = text.replace(/gynocci\s*femtech/gi, 'गायनोसी फेमटेक');
  text = text.replace(/gynocci/gi, 'गायनोसी');

  // 2. Fees & Currency (Crucial: prevents robot "four-nine-nine rupees")
  text = text.replace(/₹\s*499|499\s*(रुपये|रु|rs|inr)?/gi, 'चार सौ निन्यानवे रुपये');
  text = text.replace(/₹\s*(\d+)/g, '$1 रुपये');

  // 3. Numbers to Hindi words
  text = text.replace(/100%/g, 'सौ प्रतिशत');
  text = text.replace(/\b45\s*(मिनट|min)/gi, 'पैंतालीस मिनट');
  text = text.replace(/\b5\s*(सीनियर|डॉक्टर|doctors)/gi, 'पाँच सीनियर डॉक्टर');
  text = text.replace(/\b9\s*(शहर|क्लिनिक|cities)/gi, 'नौ शहरों');

  // 4. Medical acronyms to phonetic Hindi
  text = text.replace(/\bIVF\b/gi, 'आई.वी.एफ.');
  text = text.replace(/\bPCOD\b/gi, 'पी.सी.ओ.डी.');
  text = text.replace(/\bPCOS\b/gi, 'पी.सी.ओ.एस.');
  text = text.replace(/\bAMH\b/gi, 'ए.एम.एच.');
  text = text.replace(/\bHSG\b/gi, 'एच.एस.जी.');
  text = text.replace(/\bIUI\b/gi, 'आई.यू.आई.');
  text = text.replace(/\bDr\.?\s*/gi, 'डॉक्टर ');

  // 5. Conversational breath marks (commas after natural discourse markers)
  text = text.replace(/^(नमस्ते|हेलो|हाँजी|जी)\s+/i, '$1, ');
  text = text.replace(/\s+(बिल्कुल निश्चिंत रहिये|चिंता मत कीजिये)/g, ', $1');

  // 6. Clean markdown formatting
  text = text.replace(/[#*_~`]/g, '');

  return text.trim();
}

export interface ElevenLabsVoiceConfig {
  id: string;
  name: string;
  tone: string;
}

export const ELEVENLABS_INDIAN_FEMALE_VOICES: Record<string, ElevenLabsVoiceConfig> = {
  monika_sogam: {
    id: '1qEiC6qsybMkmnNdVMbK',
    name: 'Monika Sogam (Hindi Natural Doctor)',
    tone: 'बेहद शांत, स्वाभाविक और हमदर्द भारतीय हिंदी महिला स्वर (Best for Gynocci Healthcare)',
  },
  kanishka: {
    id: '1qEiC6qsybMkmnNdVMbK', // Default mapped to Monika Sogam, overridable by custom ID
    name: 'कनिष्का / Monika (Natural Hindi Female)',
    tone: 'प्राकृतिक बोलचाल की हिंदी टोन — बिना किसी बनावटीपन या अंग्रेजी लहजे के',
  },
  db_indian: {
    id: '2F1KINpxsttim2WfMbVs',
    name: 'DB Indian (Expressive Hindi)',
    tone: 'मधुर, स्पष्ट व दोस्ताना भारतीय महिला टोन',
  },
};

export interface VoiceCallOptions {
  patientName?: string | null;
  phone?: string | null;
  concern?: string | null;
  city?: string | null;
  adName?: string | null;
  voice?: VoicePersona;
  voiceProvider?: VoiceProvider;
  elevenLabsVoiceId?: string;
  speed?: number;
}

export interface VoiceMessageItem {
  role: 'system' | 'assistant' | 'user';
  content: string;
}

/**
 * Builds the voice-specialized clinical system prompt.
 * Spoken conversations are different from text chat:
 * 1. Short, concise, bite-sized spoken responses (1 to 2 sentences per turn).
 * 2. Natural spoken Hindi with empathetic verbal cues ("जी मैम", "बिल्कुल निश्चिंत रहिये", "मैं समझ सकती हूँ").
 * 3. Never monologue or overwhelm the listener.
 * 4. Empathetic fees reassurance (diet plan vs expensive treatment).
 */
export function buildVoiceAgentPrompt(options: VoiceCallOptions): string {
  const name = options.patientName && options.patientName !== 'Unknown' ? `${options.patientName} जी` : 'जी';
  const concern = options.concern || options.adName || 'महिला स्वास्थ्य व इनफर्टिलिटी समस्या';
  const city = options.city || 'भारत';

  return `
आप Gynocci Femtech (गायनोसी फेमटेक) की ओर से सीनियर मेडिकल कोऑर्डिनेटर 'डॉ. शिखा' बोल रही हैं। 
आप अभी मरीज (${name}) से फोन कॉल पर लाइव बात कर रही हैं।

[मरीज का विवरण]:
- नाम: ${options.patientName || 'मरीज'}
- फोन: ${options.phone || 'उपलब्ध नहीं'}
- समस्या/पूछताछ: ${concern}
- शहर: ${city}

[महत्वपूर्ण कॉलिंग नियम - NATURAL VOICE & HUMAN CADENCE]:
1. बातचीत बिल्कुल स्वाभाविक, विनम्र, हमदर्दी भरी और बोलचाल की हिंदी में होनी चाहिए।
2. बहुत बड़े पैराग्राफ नहीं बोलने हैं! एक बार में सिर्फ 1 या 2 छोटे वाक्य ही बोलें, ताकि बातचीत असली फोन कॉल जैसी लगे।
3. आवाज का टोन: एक अनुभवी, हमदर्द भारतीय सीनियर महिला डॉक्टर जैसा — शांत, सकारात्मक और हिम्मत देने वाला।
4. उच्चारण व वर्तनी नियम (Speech Normalization):
   - किसी भी संख्या को अंकों में न लिखें, हमेशा हिंदी शब्दों में लिखें (उदा. 'चार सौ निन्यानवे रुपये' लिखें, '499' या '₹499' न लिखें; 'पाँच डॉक्टर' लिखें, '5' न लिखें)।
   - अंग्रेजी शब्दों या शॉर्टफॉर्म्स से बचें (उदा. 'गायनोसी' लिखें, 'आई.वी.एफ.' लिखें, 'पी.सी.ओ.डी.' लिखें)।
5. संस्थान की विशेषता:
   - गायनोसी में शत-प्रतिशत प्राकृतिक आयुर्वेदिक इलाज होता है बिना किसी सर्जरी या साइड-इफेक्ट के।
   - हमारे पास पाँच सीनियर डॉक्टरों का विशेषज्ञ पैनल है जो हर मरीज की केस हिस्ट्री और रिपोर्ट्स की गहराई से जांच करता है।
6. फीस पर हिचकिचाहट का भरोसा:
   - "मैम, आप बिल्कुल निश्चिंत रहिये। जरूरी नहीं है कि आपको कोई महंगा इलाज या भारी दवाइयां लेनी ही पड़ें। कई बार सिर्फ सही डाइट प्लान और जीवनशैली में छोटे बदलाव से ही समस्या सही हो जाती है। आप पहले हमारे पाँच सीनियर डॉक्टरों के पैनल से केवल चार सौ निन्यानवे रुपये में अपनी रिपोर्ट्स समझ लीजिये।"
7. क्लिनिक शहर (सिर्फ नौ शहरों में फिजिकल क्लिनिक हैं):
   - जयपुर, दिल्ली, लखनऊ, अमृतसर, लुधियाना, पटना, रांची, हिसार, रेवाड़ी।
   - बाकी सभी शहरों के लिए: पैंतालीस मिनट का ऑनलाइन वीडियो कंसल्टेशन।
8. बातचीत का लक्ष्य:
   - मरीज की समस्या और तकलीफ को ध्यान से सुनना।
   - उन्हें नई उम्मीद और सही दिशा देना।
   - उनकी कंसल्टेशन या क्लिनिक विज़िट बुक करने में मदद करना।
`.trim();
}

/**
 * Synthesizes studio-quality speech using OpenAI TTS API with natural female voices ('nova' or 'shimmer').
 * Uses `tts-1-hd` (High Definition) and `normalizeHindiForSpeech` to eliminate robotic cadence.
 * Returns audio as an ArrayBuffer.
 */
export async function synthesizeOpenAiSpeech(args: {
  apiKey: string;
  text: string;
  voice?: VoicePersona;
  speed?: number;
}): Promise<ArrayBuffer> {
  const { apiKey, text, voice = 'nova', speed = 0.93 } = args;

  // Normalize phonetic Hindi to remove robotic cadence and awkward pronunciation
  const normalizedText = normalizeHindiForSpeech(text);

  // Try High-Definition studio model first (vastly more natural than tts-1)
  try {
    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1-hd',
        input: normalizedText,
        voice,
        response_format: 'mp3',
        speed: Math.max(0.85, Math.min(1.05, speed || 0.93)),
      }),
    });

    if (res.ok) {
      return await res.arrayBuffer();
    }
  } catch {
    // fallback to standard tts-1 below
  }

  // Fallback to standard tts-1 if tts-1-hd fails
  const fallbackRes = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1',
      input: normalizedText,
      voice,
      response_format: 'mp3',
      speed: speed || 0.93,
    }),
  });

  if (!fallbackRes.ok) {
    const errorBody = await fallbackRes.text().catch(() => '');
    throw new Error(`OpenAI TTS Error (${fallbackRes.status}): ${errorBody || fallbackRes.statusText}`);
  }

  return await fallbackRes.arrayBuffer();
}

/**
 * Synthesizes ultra-natural Indian Hindi speech using ElevenLabs API.
 * Supports native Hindi female voices (e.g. Monika Sogam, Kanishka clone, etc.)
 * with authentic Indian accent, emotional warmth, and zero robotic cadence.
 */
export async function synthesizeElevenLabsSpeech(args: {
  apiKey: string;
  text: string;
  voiceId: string;
  modelId?: string;
}): Promise<ArrayBuffer> {
  const { apiKey, text, voiceId, modelId = 'eleven_multilingual_v2' } = args;

  if (!voiceId) {
    throw new Error('ElevenLabs Voice ID is required for speech synthesis.');
  }

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.8,
        style: 0.25,
        use_speaker_boost: true,
      },
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => '');
    throw new Error(`ElevenLabs TTS Error (${res.status}): ${errorBody || res.statusText}`);
  }

  return await res.arrayBuffer();
}

/**
 * Generates an LLM conversational reply for the voice call turn
 */
export async function generateVoiceReply(args: {
  apiKey: string;
  systemPrompt: string;
  conversationHistory: VoiceMessageItem[];
  userSpeechText: string;
}): Promise<string> {
  const { apiKey, systemPrompt, conversationHistory, userSpeechText } = args;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-10), // Keep last 10 turns for quick context
    { role: 'user', content: userSpeechText },
  ];

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_completion_tokens: 180, // Keep voice responses brief and punchy
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => '');
    throw new Error(`OpenAI Chat Error (${res.status}): ${errorBody || res.statusText}`);
  }

  const data = await res.json();
  const replyText = data?.choices?.[0]?.message?.content?.trim();
  if (!replyText) {
    return 'जी, मैं आपकी बात समझ रही हूँ। कृपया थोड़ा और बताएं ताकि हमारे डॉक्टर आपकी सही सहायता कर सकें।';
  }

  return replyText;
}

/**
 * Detects call disposition / outcome from accumulated transcript
 */
export function detectCallDisposition(transcriptText: string): {
  disposition: 'Interested' | 'Fees Hesitation' | 'Callback' | 'Clinic Visit' | 'Booked' | 'Awareness';
  tagColor: string;
} {
  const lower = transcriptText.toLowerCase();

  if (lower.includes('बुक') || lower.includes('booking') || lower.includes('अपॉइंटमेंट कन्फर्म') || lower.includes('कंसल्टेशन ले लूंगी')) {
    return { disposition: 'Booked', tagColor: '#10b981' };
  }
  if (lower.includes('क्लिनिक') || lower.includes('clinic') || lower.includes('आकर मिलूंगी') || lower.includes('विज़िट')) {
    return { disposition: 'Clinic Visit', tagColor: '#059669' };
  }
  if (lower.includes('फीस') || lower.includes('fees') || lower.includes('महंगा') || lower.includes('पैसे')) {
    return { disposition: 'Fees Hesitation', tagColor: '#d97706' };
  }
  if (lower.includes('बाद में') || lower.includes('कॉल करना') || lower.includes('callback') || lower.includes('सोचकर')) {
    return { disposition: 'Callback', tagColor: '#3b82f6' };
  }
  if (lower.includes('हाँ') || lower.includes('इलाज') || lower.includes('जानकारी') || lower.includes('ठीक होना')) {
    return { disposition: 'Interested', tagColor: '#8b5cf6' };
  }

  return { disposition: 'Awareness', tagColor: '#64748b' };
}
