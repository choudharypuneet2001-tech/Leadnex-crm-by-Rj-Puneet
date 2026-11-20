import { checkNearbyClinic } from './analytics-service';
import type { LeadAiAnalysis, LeadIntentStage } from './types';
import { findDiseaseVideo } from '../ai/disease-video-links';

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

const GREETING_WORDS = new Set([
  'hi',
  'hii',
  'hiii',
  'hello',
  'hey',
  'heyy',
  'hlo',
  'hlw',
  'helo',
  'namaste',
  'namaskar',
  'pranam',
  'radhe',
  'ram',
  'jai',
  'shree',
  'krishna',
  'sir',
  'mam',
  'maam',
  'madam',
  'bhai',
  'ji',
  'good',
  'morning',
  'evening',
  'afternoon',
  'gm',
  'ge',
  'ga',
  'ok',
  'okay',
  'ha',
  'haan',
  'han',
  'yes',
  'kya',
  'haal',
  'hai',
  'kese',
  'ho',
  'kaise',
]);

export function isPureGreeting(text?: string | null): boolean {
  if (!text || !text.trim()) return true;
  const cleaned = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();
  if (!cleaned) return true;
  const words = cleaned.split(/\s+/).filter(Boolean);
  return words.every((w) => GREETING_WORDS.has(w));
}

const HEALTH_SYMPTOM_KEYWORDS = [
  'tube',
  'tubes',
  'tubal',
  'fallopian',
  'block',
  'blockage',
  'hsg',
  'laparoscopy',
  'uttarbasti',
  'उत्तर बस्ती',
  'ट्यूब',
  'pcod',
  'pcos',
  'period',
  'periods',
  'mahvari',
  'mahwari',
  'माहवारी',
  'irregular',
  'delay',
  'menses',
  'cramps',
  'bleeding',
  'conceive',
  'bacha',
  'baccha',
  'pregnancy',
  'pregnant',
  'santan',
  'संतान',
  'garbhdharan',
  'गर्भधारण',
  'infertility',
  'बांझपन',
  'amh',
  'low amh',
  'egg',
  'fertility',
  'aulad',
  'shadi ko',
  'discharge',
  'safed pani',
  'safed paani',
  'सफेद पानी',
  'leucorrhea',
  'likoriya',
  'yoni',
  'pelvic',
  'sperm',
  'motility',
  'semen',
  'shukranu',
  'शुक्राणु',
  'nil sperm',
  'azoospermia',
  'report',
  'reports',
  'ultrasound',
  'usg',
  'dawa',
  'dawai',
  'medicine',
  'treatment',
  'ilaj',
  'doctor',
  'consultation',
  'appointment',
  'cyst',
  'rasoli',
  'रसौली',
  'fibroid',
  'endometriosis',
  'infection',
  'dard',
  'pain',
  'pareshan',
  'dikkat',
  'takleef',
  'problem',
  'bimari',
];

/**
 * Checks if patient actually shared medical symptoms or serious interest,
 * rather than just clicking an ad or saying "Hi/Hello".
 */
export function hasPatientSharedHealthDetails(
  healthConcern?: string | null,
  lastMsgText?: string | null,
  adName?: string | null,
  adBody?: string | null
): boolean {
  const lastMsg = (lastMsgText || '').toLowerCase().trim();

  // If patient message has health keywords, they shared symptoms
  if (HEALTH_SYMPTOM_KEYWORDS.some((kw) => lastMsg.includes(kw))) {
    return true;
  }

  // If healthConcern is present and is not merely the ad title or ad body copy
  if (healthConcern && healthConcern.trim()) {
    const hcLower = healthConcern.trim().toLowerCase();
    const adLower = (adName || '').trim().toLowerCase();
    const bodyLower = (adBody || '').trim().toLowerCase();

    // Must not be identical to the ad name/body
    if (hcLower !== adLower && hcLower !== bodyLower) {
      if (HEALTH_SYMPTOM_KEYWORDS.some((kw) => hcLower.includes(kw))) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Analyzes chat history and lead data to evaluate drop-off reason,
 * intent priority, clinical root-cause insight, and actionable telecalling pitch guidance.
 */
export function analyzeLeadIntent(input: LeadAnalysisInput): LeadAiAnalysis {
  // 1. If already booked
  if (input.hasBooking && input.bookingStatus !== 'cancelled') {
    return {
      intent_stage: 'booked',
      intent_label: '✅ Booking Confirmed',
      intent_badge_color: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
      dropout_reason: 'Appointment pehle se book ho chuka hai (#GYN Query ID generated).',
      calling_pitch:
        'Patient ki booking already confirmed hai. Doctor consultation se pehle date, time aur mode (Clinic visit ya Video call) confirm karein aur reports ready rakhne ko kahein.',
      urgency: 'low',
    };
  }

  const concern = (input.healthConcern || input.concernCategory || '').toLowerCase();
  const lastMsg = (input.lastMessageText || '').toLowerCase().trim();
  const adInfo = `${input.adName || ''} ${input.adBody || ''}`.toLowerCase();
  const allText = `${concern} ${lastMsg} ${adInfo}`.toLowerCase();

  const clinicCheck = checkNearbyClinic(input.city);
  const effectiveConcernName =
    input.concernCategory && input.concernCategory !== 'General Gynaecological Care'
      ? input.concernCategory
      : input.healthConcern || 'Gynaecological & Infertility';

  // Check matching disease video
  const matchedVideo = findDiseaseVideo(allText);

  // Clinical root-cause helper in friendly Hinglish
  let diseaseCause = 'Hormonal imbalance, stress ya lifestyle disturbances ki wajah se yeh issue develop hota hai.';
  let diseaseTreatment = 'Ayurvedic tridosha balance, natural detoxification aur customized diet plan se yeh naturally theek ho jata hai.';

  if (allText.includes('tube') || allText.includes('ट्यूब') || allText.includes('block')) {
    diseaseCause =
      'Fallopian tube blockage pelvic inflammation (PID), infection ya mucus plug ki wajah se hota hai jisse egg aur sperm mil nahi paate.';
    diseaseTreatment =
      'Ayurveda mein bina surgery ke, natural Uttar Basti aur herbal medicines se dono tubes ko naturally open kiya jata hai.';
  } else if (allText.includes('pcod') || allText.includes('pcos') || allText.includes('सिस्ट') || allText.includes('माहवारी') || allText.includes('period')) {
    diseaseCause =
      'PCOD/PCOS mein hormonal imbalance aur insulin resistance ki wajah se eggs timely mature nahi hote aur cysts ban jaate hain.';
    diseaseTreatment =
      'Bina harmful hormonal pills ke, ovarian detox, targeted diet plan aur weight management se periods regular ho jaate hain.';
  } else if (allText.includes('conceive') || allText.includes('गर्भधारण') || allText.includes('infertility') || allText.includes('amh')) {
    diseaseCause =
      'Conceiving mein delay aksar low AMH, weak uterine lining ya poor egg quality ki wajah se hota hai.';
    diseaseTreatment =
      'Ayurveda mein ovarian rejuvenation, beej shuddhi aur uterine toning se natural conception ke chances rapidly improve hote hain.';
  } else if (allText.includes('discharge') || allText.includes('सफेद पानी') || allText.includes('ल्यूकोरिया')) {
    diseaseCause =
      'White discharge pelvic congestion, vaginal infection ya body mein pitta/kapha dosha badhne se hota hai.';
    diseaseTreatment =
      'Herbal yoni prakshalan aur Ayurvedic medicines se infection root cause se theek hota hai aur weakness door hoti hai.';
  } else if (allText.includes('sperm') || allText.includes('शुक्राणु') || allText.includes('motility')) {
    diseaseCause =
      'Men mein sperm count ya motility ki kami stress, faulty diet ya shukra dhatu weakness se hoti hai.';
    diseaseTreatment =
      'Ayurvedic rasayana therapy aur shukra dhatu herbs se sperm count aur active motility naturally improve hoti hai.';
  }

  // 2. Fees / Pricing Hesitation
  const isFeesDropoff =
    lastMsg.includes('499') ||
    lastMsg.includes('fees') ||
    lastMsg.includes('fee') ||
    lastMsg.includes('फीस') ||
    lastMsg.includes('charges') ||
    lastMsg.includes('cost') ||
    lastMsg.includes('payment') ||
    lastMsg.includes('rupaye') ||
    lastMsg.includes('rs.') ||
    lastMsg.includes('paise') ||
    lastMsg.includes('पैसे');

  if (isFeesDropoff) {
    const feesPitch =
      `Call par politely samjhayein:\n` +
      `"Namaste ji! Main Gynocci doctor panel se baat kar rahi hoon. Sir/Ma'am, zaroori nahi hai ki aapko koi mehenga treatment ya medicine leni pade. Bahut baar sirf right diet plan aur lifestyle correction se hi issue solve ho jata hai.\n\n` +
      `Isliye aap treatment ya cost ki chinta na karein—pehle hamare senior doctors se consult karke apni reports discuss karein. Hamare yahan doctor consultation bilkul free hai! Sirf ₹499 mein one-time registration karwake aap lifetime free consultation offer ka fayda utha sakte hain, jisme aage bhi sabhi follow-ups bilkul free rahenge.\n\n` +
      `Aur agar aap clinic aakar doctor se milna chahein toh online koi fee nahi deni, sab clinic par hi hoga. Kya main aapka appointment schedule kar doon?"`;

    return {
      intent_stage: 'fees_hesitation',
      intent_label: '⚠️ Fees Hesitation (High Opportunity)',
      intent_badge_color: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
      dropout_reason: 'Patient ₹499 consultation fees dekh kar ruk gaye aur aage reply band kar diya.',
      calling_pitch: feesPitch,
      urgency: 'high',
      disease_cause: diseaseCause,
      disease_treatment: diseaseTreatment,
      video_recommendation: matchedVideo ? matchedVideo.youtubeUrl : undefined,
    };
  }

  // 3. Check if patient has ACTUALLY shared a disease/symptom or genuine intent
  const hasSharedSymptoms = hasPatientSharedHealthDetails(
    input.healthConcern,
    input.lastMessageText,
    input.adName,
    input.adBody
  );

  const greetingOnly = isPureGreeting(lastMsg);

  // If patient only said "Hi/Hello" or just clicked ad without sharing any symptom
  if (greetingOnly && !hasSharedSymptoms) {
    return {
      intent_stage: 'awareness_only',
      intent_label: '💡 Just Hi-Hello / Awareness Only',
      intent_badge_color: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20',
      dropout_reason: 'Lead ne sirf Hi/Hello kiya hai ya ad click kiya hai, abhi tak koi bimari ya takleef share nahi ki hai.',
      calling_pitch:
        `Call par friendly greeting karein:\n` +
        `"Namaste ji! Main Gynocci Ayurvedic Health Center se baat kar rahi hoon. Aapne hamare ad par message kiya tha. Kya aapko ya family mein kisi ko periods, PCOD ya conceiving mein koi problem hai jisme hamare senior Ayurvedic doctor help kar sakte hain?"`,
      urgency: 'low',
      disease_cause: diseaseCause,
      disease_treatment: diseaseTreatment,
      video_recommendation: matchedVideo ? matchedVideo.youtubeUrl : undefined,
    };
  }

  // 4. Clinic Branch Proximity Opportunity (Patient shared serious symptoms + nearby branch)
  if (clinicCheck.hasClinic && hasSharedSymptoms) {
    const clinicPitch =
      `Call par batayein:\n` +
      `"Namaste ji! Aapne ${effectiveConcernName} ke baare mein pucha tha. Yeh problem ${diseaseCause.toLowerCase()}\n\n` +
      `Achi baat yeh hai ki aapke paas ${clinicCheck.clinicName || input.city} mein hamara specialist clinic available hai. Clinic par senior doctor naadi parikshan karke root cause check karenge aur ${diseaseTreatment.toLowerCase()}\n\n` +
      `Clinic visit ke liye online ₹0 pay karna hai, consultation fee clinic par hi jama hogi. Kya main kal ke liye aapka time book kar doon?"`;

    return {
      intent_stage: 'clinic_opportunity',
      intent_label: '🏥 Clinic Pitch (Near Branch)',
      intent_badge_color: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20',
      dropout_reason: `Patient ${effectiveConcernName} se pareshan hain aur clinic (${clinicCheck.clinicName || input.city}) ke paas hain, par chat mein booking complete nahi hui.`,
      calling_pitch: clinicPitch,
      urgency: 'high',
      disease_cause: diseaseCause,
      disease_treatment: diseaseTreatment,
      video_recommendation: matchedVideo ? matchedVideo.youtubeUrl : undefined,
    };
  }

  // 5. High Intent - Ready to Convert (Patient actively shared symptoms/problem)
  if (hasSharedSymptoms) {
    const convertPitch =
      `Call par empathy ke saath batayein:\n` +
      `"Namaste ji! Aapne WhatsApp par ${effectiveConcernName} ke baare mein bataya tha. Hum samajh sakte hain ki aap pareshan hain. Actually, ${diseaseCause}\n\n` +
      `Ghabraiye nahi, ${diseaseTreatment} Kai baar sirf right diet plan se bhi problem solve ho jati hai.\n\n` +
      `Hamari senior doctors ki team aapki reports study karke personalized guidance degi. Hamare yahan doctor consultation bilkul free hai, sirf ₹499 mein lifetime consultation offer available hai. Kya main kal ke liye aapki video call ya clinic appointment book kar doon?"`;

    return {
      intent_stage: 'ready_to_convert',
      intent_label: '🔥 Ready to Convert (High Intent Lead)',
      intent_badge_color: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20',
      dropout_reason: `Patient ki problem genuine hai (${effectiveConcernName}) aur unhone symptoms share kiye hain. Inko bas ek caring telecalling call ki zaroorat hai.`,
      calling_pitch: convertPitch,
      urgency: 'high',
      disease_cause: diseaseCause,
      disease_treatment: diseaseTreatment,
      video_recommendation: matchedVideo ? matchedVideo.youtubeUrl : undefined,
    };
  }

  // 6. General Awareness Only (Low Priority)
  return {
    intent_stage: 'awareness_only',
    intent_label: '💡 Awareness Only (Low Priority)',
    intent_badge_color: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20',
    dropout_reason: 'Lead sirf general enquiry ya ad dekh kar aayi thi, koi specific symptom share nahi kiya.',
    calling_pitch:
      'Politely puchein ki kya family mein kisi ko periods, PCOD ya pregnancy related guidance ki zaroorat hai.',
    urgency: 'low',
    disease_cause: diseaseCause,
    disease_treatment: diseaseTreatment,
    video_recommendation: matchedVideo ? matchedVideo.youtubeUrl : undefined,
  };
}
