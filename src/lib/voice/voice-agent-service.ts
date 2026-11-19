import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/ai/admin-client';
import { loadAiConfig } from '@/lib/ai/config';
import { findDiseaseVideo, DEFAULT_DISEASE_VIDEOS } from '@/lib/ai/disease-video-links';

export type VoiceGender = 'female' | 'male';
export type VoicePersona = 'shimmer' | 'nova' | 'sage' | 'coral' | 'alloy';

export interface VoiceCallOptions {
  patientName?: string | null;
  phone?: string | null;
  concern?: string | null;
  city?: string | null;
  adName?: string | null;
  voice?: VoicePersona;
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

[महत्वपूर्ण कॉलिंग नियम - VOICE CONVERSATION GUIDELINES]:
1. बातचीत बिल्कुल स्वाभाविक, विनम्र, हमदर्दी भरी और बोलचाल की हिंदी में होनी चाहिए।
2. बहुत बड़े पैराग्राफ नहीं बोलने हैं! एक बार में सिर्फ 1 या 2 छोटे वाक्य ही बोलें, ताकि सामने वाला अपनी बात कह सके।
3. आवाज का टोन: बेहद शांत, सकारात्मक और हिम्मत देने वाला (Empathic & Reassuring)।
4. संस्थान की विशेषता:
   - Gynocci में 100% प्राकृतिक आयुर्वेदिक इलाज होता है बिना किसी सर्जरी या साइड-इफेक्ट के।
   - हमारे पास 5 सीनियर डॉक्टरों का विशेषज्ञ पैनल है जो हर मरीज की केस हिस्ट्री और रिपोर्ट्स की गहराई से जांच करता है।
5. फीस पर हिचकिचाहट का भरोसा:
   - "मैम/सर, आप बिल्कुल निश्चिंत रहिये। जरूरी नहीं है कि आपको कोई महंगा इलाज या भारी दवाइयां लेनी ही पड़ें। कई बार सिर्फ सही डाइट प्लान और लाइफस्टाइल में छोटे बदलाव से ही समस्या सही हो जाती है। आप पहले हमारे 5 सीनियर डॉक्टरों के पैनल से केवल ₹499 में अपनी रिपोर्ट्स समझ लीजिये।"
6. क्लिनिक शहर (सिर्फ 9 शहरों में फिजिकल क्लिनिक हैं):
   - जयपुर, दिल्ली, लखनऊ, अमृतसर, लुधियाना, पटना, रांची, हिसार, रेवाड़ी।
   - बाकी सभी शहरों के लिए: 45 मिनट का ऑनलाइन वीडियो कंसल्टेशन।
7. बातचीत का लक्ष्य:
   - मरीज की समस्या और तकलीफ को ध्यान से सुनना।
   - उन्हें नई उम्मीद और सही दिशा देना।
   - उनकी कंसल्टेशन या क्लिनिक विज़िट बुक करने में मदद करना।
`.trim();
}

/**
 * Synthesizes speech using OpenAI TTS API with natural female voices ('shimmer' or 'nova').
 * Returns audio as an ArrayBuffer or base64 data string.
 */
export async function synthesizeOpenAiSpeech(args: {
  apiKey: string;
  text: string;
  voice?: VoicePersona;
  speed?: number;
}): Promise<ArrayBuffer> {
  const { apiKey, text, voice = 'shimmer', speed = 1.0 } = args;

  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1',
      input: text,
      voice,
      response_format: 'mp3',
      speed,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => '');
    throw new Error(`OpenAI TTS Error (${res.status}): ${errorBody || res.statusText}`);
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
