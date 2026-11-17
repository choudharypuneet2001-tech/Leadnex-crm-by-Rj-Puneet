import { checkNearbyClinic } from './analytics-service';
import type { LeadAiAnalysis, LeadIntentStage } from './types';

export interface LeadAnalysisInput {
  name?: string | null;
  phone?: string | null;
  city?: string | null;
  healthConcern?: string | null;
  concernCategory?: string | null;
  adName?: string | null;
  adBody?: string | null;
  hasBooking: boolean;
  bookingStatus?: string | null;
  lastMessageText?: string | null;
}

/**
 * Analyzes chat history and lead data to evaluate drop-off reason,
 * intent priority, and actionable telecalling pitch guidance.
 */
export function analyzeLeadIntent(input: LeadAnalysisInput): LeadAiAnalysis {
  // 1. If already booked
  if (input.hasBooking && input.bookingStatus !== 'cancelled') {
    return {
      intent_stage: 'booked',
      intent_label: '✅ Booking Confirmed',
      intent_badge_color: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
      dropout_reason: 'अपॉइंटमेंट सफलतापूर्वक बुक हो चुका है (#GYN Query ID जनरेटेड)',
      calling_pitch: 'मरीज की बुकिंग पहले से कन्फर्म है। डॉक्टर परामर्श से पूर्व केवल तारीख, समय और माध्यम (क्लीनिक विज़िट अथवा वीडियो कॉल) का री-कंफर्मेशन करें।',
      urgency: 'low',
    };
  }

  const concern = (input.healthConcern || input.concernCategory || '').toLowerCase();
  const lastMsg = (input.lastMessageText || '').toLowerCase();
  const adInfo = `${input.adName || ''} ${input.adBody || ''}`.toLowerCase();
  const allText = `${concern} ${lastMsg} ${adInfo}`.toLowerCase();

  const clinicCheck = checkNearbyClinic(input.city);
  const effectiveConcernName = input.concernCategory && input.concernCategory !== 'General Gynaecological Care'
    ? input.concernCategory
    : input.healthConcern || 'स्त्री रोग व इनफर्टिलिटी';

  // 2. Fees / Pricing Hesitation
  // Check if fees, ₹499, charges, cost, or registration was mentioned right before drop-off
  const isFeesDropoff =
    lastMsg.includes('499') ||
    lastMsg.includes('fees') ||
    lastMsg.includes('fee') ||
    lastMsg.includes('फीस') ||
    lastMsg.includes('रजिस्ट्रेशन') ||
    lastMsg.includes('charges') ||
    lastMsg.includes('cost') ||
    lastMsg.includes('पेमेंट') ||
    lastMsg.includes('rupaye') ||
    lastMsg.includes('rs.') ||
    lastMsg.includes('पैसे');

  if (isFeesDropoff) {
    return {
      intent_stage: 'fees_hesitation',
      intent_label: '⚠️ Fees Hesitation (High Opportunity)',
      intent_badge_color: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
      dropout_reason: 'मरीज ₹499 रजिस्ट्रेशन फीस का मैसेज देखकर झिझक गए और आगे रिप्लाई देना बंद कर दिया।',
      calling_pitch: `कॉल पर बताएं: "नमस्ते जी! मैं गायनोकी से बात कर रही हूँ। हमारी 5 सीनियर डॉक्टर्स की पैनल टीम आपकी पुरानी रिपोर्ट्स का गहराई से अध्ययन करेगी और ₹499 में लाइफटाइम फ्री कंसल्टेशन मिलेगा। साथ ही अगर आप चाहें तो हमारे ${clinicCheck.hasClinic ? clinicCheck.clinicName || 'नजदीकी क्लीनिक' : 'क्लीनिक'} पर आकर बिना किसी ऑनलाइन फीस के नाड़ी परीक्षण भी करा सकती हैं, फीस क्लीनिक पर ही देनी होगी।"`,
      urgency: 'high',
    };
  }

  // 3. Check for genuine serious health concern
  const hasSeriousConcern =
    concern.includes('tube') ||
    concern.includes('ट्यूब') ||
    concern.includes('block') ||
    concern.includes('pcod') ||
    concern.includes('pcos') ||
    concern.includes('period') ||
    concern.includes('माहवारी') ||
    concern.includes('conceive') ||
    concern.includes('संतान') ||
    concern.includes('गर्भधारण') ||
    concern.includes('infertility') ||
    concern.includes('amh') ||
    concern.includes('sperm') ||
    concern.includes('शुक्राणु') ||
    concern.includes('miscarriage') ||
    concern.includes('गर्भपात') ||
    concern.includes('discharge') ||
    concern.includes('सफेद पानी') ||
    concern.includes('cyst') ||
    concern.includes('रसौली');

  // 4. Clinic Branch Proximity Opportunity
  if (clinicCheck.hasClinic && hasSeriousConcern) {
    return {
      intent_stage: 'clinic_opportunity',
      intent_label: '🏥 Clinic Visit Pitch (Near Branch)',
      intent_badge_color: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20',
      dropout_reason: `मरीज ${effectiveConcernName} से परेशान हैं और क्लीनिक (${clinicCheck.clinicName || input.city}) के निकट हैं, लेकिन ऑनलाइन चैट में अपॉइंटमेंट पूरा नहीं किया।`,
      calling_pitch: `कॉल पर बताएं: "नमस्ते जी! आपने ${effectiveConcernName} के बारे में पूछा था। आपके निकट ${clinicCheck.clinicName || input.city} में हमारा स्पेशलिस्ट क्लीनिक मौजूद है जहाँ डॉक्टर्स नाड़ी परीक्षण द्वारा समस्या की जड़ समझते हैं। क्लीनिक विज़िट के लिए कोई ऑनलाइन फीस नहीं देनी है। क्या मैं आपके लिए कल का स्लॉट बुक कर दूँ?"`,
      urgency: 'high',
    };
  }

  // 5. High Intent - Ready to Convert with Telecaller Human Touch Call
  if (hasSeriousConcern) {
    return {
      intent_stage: 'ready_to_convert',
      intent_label: '🔥 Ready to Convert (Needs Human Touch Call)',
      intent_badge_color: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20',
      dropout_reason: `मरीज की समस्या वास्तविक और गंभीर है (${effectiveConcernName})। चैट में झिझक या व्यस्तता के कारण रुक गए, इन्हें सिर्फ एक भरोसेमंद फोन कॉल और डॉक्टर की सहानुभूति की ज़रूरत है।`,
      calling_pitch: `कॉल पर बताएं: "नमस्ते जी! आपने व्हाट्सएप पर ${effectiveConcernName} के बारे में चर्चा की थी। यह समस्या आयुर्वेद में बिना किसी साइड इफेक्ट के 100% जड़ से ठीक हो सकती है। हमारी 5 सीनियर डॉक्टर्स की टीम से 45 मिनट के वीडियो कंसल्टेशन व जीभ परीक्षण (Jeebha Parikshan) के लिए क्या मैं आपका समय शेड्यूल कर दूँ?"`,
      urgency: 'high',
    };
  }

  // 6. General Awareness Only (Low Priority)
  return {
    intent_stage: 'awareness_only',
    intent_label: '💡 Awareness Only (Low Priority)',
    intent_badge_color: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20',
    dropout_reason: 'मरीज सिर्फ सामान्य जानकारी या विज्ञापन देखकर आए थे, कोई व्यक्तिगत लक्षण या बीमारी साझा नहीं की।',
    calling_pitch: 'मरीज से विनम्रता से पूछें कि क्या परिवार में किसी को माहवारी, PCOD या संतान प्राप्ति में कोई समस्या है जिसके लिए वे सीनियर आयुर्वेदिक गायनेकोलॉजिस्ट से सलाह लेना चाहते हैं।',
    urgency: 'low',
  };
}
