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
      dropout_reason: 'अपॉइंटमेंट सफलतापूर्वक बुक हो चुका है (#GYN Query ID जनरेटेड)',
      calling_pitch:
        'मरीज की बुकिंग पहले से कन्फर्म है। डॉक्टर परामर्श से पूर्व केवल तारीख, समय और माध्यम (क्लीनिक विज़िट अथवा वीडियो कॉल) का री-कंफर्मेशन करें एवं रिपोर्ट साथ रखने को कहें।',
      urgency: 'low',
    };
  }

  const concern = (input.healthConcern || input.concernCategory || '').toLowerCase();
  const lastMsg = (input.lastMessageText || '').toLowerCase();
  const adInfo = `${input.adName || ''} ${input.adBody || ''}`.toLowerCase();
  const allText = `${concern} ${lastMsg} ${adInfo}`.toLowerCase();

  const clinicCheck = checkNearbyClinic(input.city);
  const effectiveConcernName =
    input.concernCategory && input.concernCategory !== 'General Gynaecological Care'
      ? input.concernCategory
      : input.healthConcern || 'स्त्री रोग व इनफर्टिलिटी';

  // Check matching disease video
  const matchedVideo = findDiseaseVideo(allText);

  // Clinical explanation helper
  let diseaseCause = 'हार्मोनल असंतुलन, तनाव या जीवनशैली में गड़बड़ी के कारण यह समस्या उत्पन्न होती है।';
  let diseaseTreatment = 'आयुर्वेदिक त्रिदोष संतुलन, डिटॉक्सिफिकेशन और व्यक्तिगत डाइट प्लान से इसे प्राकृतिक रूप से ठीक किया जाता है।';

  if (allText.includes('tube') || allText.includes('ट्यूब') || allText.includes('block')) {
    diseaseCause =
      'फेलोपियन ट्यूब ब्लॉकेज पेल्विक सूजन (PID), इन्फेक्शन या म्यूकस प्लग की वजह से होता है जिससे अंडा और स्पर्म आपस में मिल नहीं पाते।';
    diseaseTreatment =
      'आयुर्वेद में बिना सर्जरी या लैप्रोस्कोपी के, प्राकृतिक उत्तर बस्ती और खास औषधियों द्वारा दोनों ट्यूब्स को नेचुरल तरीके से खोला जाता है।';
  } else if (allText.includes('pcod') || allText.includes('pcos') || allText.includes('सिस्ट') || allText.includes('माहवारी')) {
    diseaseCause =
      'PCOD में हार्मोनल असंतुलन और इंसुलिन रेजिस्टेंस के कारण ओवरी में अंडे समय पर नहीं पकते और सिस्ट का रूप ले लेते हैं, जिससे पीरियड्स रुक-रुक कर आते हैं।';
    diseaseTreatment =
      'बिना किसी नुकसानदेह हार्मोनल पिल्स के, ओवरी के डिटॉक्सिफिकेशन, सही डाइट प्लान और वजन नियंत्रण से अंडों की क्वालिटी सुधारकर पीरियड्स नियमित होते हैं।';
  } else if (allText.includes('conceive') || allText.includes('गर्भधारण') || allText.includes('infertility') || allText.includes('amh')) {
    diseaseCause =
      'गर्भधारण में रुकावट अक्सर लो एएमएच (कम एग रिजर्व), कमजोर गर्भाशय लाइनिंग या अंडों के कमजोर पोषण के कारण होती है।';
    diseaseTreatment =
      'आयुर्वेद में ओवेरियन रिजुविनेशन, बीज शुद्धि और यूट्राइन टोनिंग से प्राकृतिक गर्भधारण की संभावना को बहुत तेजी से बढ़ाया जाता है।';
  } else if (allText.includes('discharge') || allText.includes('सफेद पानी') || allText.includes('ल्यूकोरिया')) {
    diseaseCause =
      'सफेद पानी की समस्या पेल्विक कंजेशन, योनि में इन्फेक्शन या शरीर में पित्त और कफ दोष बढ़ने से होती है, जिससे अत्यधिक कमजोरी और कमर दर्द रहता है।';
    diseaseTreatment =
      'योनि प्रक्षालन और आयुर्वेदिक औषधियों से इन्फेक्शन को जड़ से खत्म किया जाता है और शरीर की खोई हुई ऊर्जा वापस लौटती है।';
  } else if (allText.includes('sperm') || allText.includes('शुक्राणु') || allText.includes('motility')) {
    diseaseCause =
      'पुरुषों में स्पर्म काउंट या गतिशीलता की कमी तनाव, गलत खानपान या शुक्र धातु की कमजोरी से होती है।';
    diseaseTreatment =
      'आयुर्वेदिक रसायन चिकित्सा और शुक्र धातु पोषक हर्ब्स से स्पर्म काउंट व एक्टिव मोटिलिटी को 100% प्राकृतिक रूप से सुधारा जाता है।';
  }

  // 2. Fees / Pricing Hesitation
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
    const feesPitch =
      `कॉल पर ऐसे समझाएं:\n` +
      `"नमस्ते जी! मैं Gynocci से बात कर रही हूँ। मैम/सर, जरूरी नहीं है कि आपको कोई महंगा ट्रीटमेंट या दवाइयां लेनी ही पड़ें। बहुत बार सिर्फ सही डाइट प्लान, खान-पान में छोटे बदलाव और लाइफस्टाइल गाइडेंस से ही आपकी समस्या ठीक हो जाती है।\n\n` +
      `इसलिए आप अभी इलाज या खर्च की बिल्कुल चिंता न करें—पहले हमारे 5 सीनियर डॉक्टरों के विशेषज्ञ पैनल से परामर्श लेकर अपनी रिपोर्ट्स को गहराई से समझें। अभी हमारा स्पेशल ऑफर चल रहा है जिसमें सिर्फ ₹499 में आपको लाइफटाइम फ्री कंसल्टेशन मिलेगा, जिसमें आप आगे भी जब चाहें डॉक्टरों से बात कर सकती हैं।\n\n` +
      `और अगर आप क्लिनिक आकर नाड़ी परीक्षण कराना चाहें तो ऑनलाइन कोई फीस नहीं देनी, सब क्लिनिक पर ही होगा। क्या मैं कल के लिए आपका समय शेड्यूल कर दूँ?"`;

    return {
      intent_stage: 'fees_hesitation',
      intent_label: '⚠️ Fees Hesitation (High Opportunity)',
      intent_badge_color: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
      dropout_reason: 'मरीज ₹499 रजिस्ट्रेशन फीस का मैसेज देखकर झिझक गए और आगे रिप्लाई देना बंद कर दिया।',
      calling_pitch: feesPitch,
      urgency: 'high',
      disease_cause: diseaseCause,
      disease_treatment: diseaseTreatment,
      video_recommendation: matchedVideo ? matchedVideo.youtubeUrl : undefined,
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
    const clinicPitch =
      `कॉल पर बताएं:\n` +
      `"नमस्ते जी! आपने ${effectiveConcernName} के बारे में पूछा था। यह समस्या ${diseaseCause.toLowerCase()}\n\n` +
      `अच्छी बात यह है कि आपके निकट ${clinicCheck.clinicName || input.city} में हमारा स्पेशलिस्ट क्लिनिक मौजूद है। क्लिनिक पर हमारे अनुभवी डॉक्टर नाड़ी परीक्षण करके आपकी समस्या की असली जड़ समझेंगे और ${diseaseTreatment.toLowerCase()}\n\n` +
      `क्लिनिक विज़िट के लिए आपको अभी ऑनलाइन ₹0 देना है, फीस क्लिनिक पर ही जमा होगी। क्या मैं कल के लिए आपका स्लॉट बुक कर दूँ?"`;

    return {
      intent_stage: 'clinic_opportunity',
      intent_label: '🏥 Clinic Visit Pitch (Near Branch)',
      intent_badge_color: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20',
      dropout_reason: `मरीज ${effectiveConcernName} से परेशान हैं और क्लीनिक (${clinicCheck.clinicName || input.city}) के निकट हैं, लेकिन ऑनलाइन चैट में अपॉइंटमेंट पूरा नहीं किया।`,
      calling_pitch: clinicPitch,
      urgency: 'high',
      disease_cause: diseaseCause,
      disease_treatment: diseaseTreatment,
      video_recommendation: matchedVideo ? matchedVideo.youtubeUrl : undefined,
    };
  }

  // 5. High Intent - Ready to Convert with Telecaller Human Touch Call
  if (hasSeriousConcern) {
    const convertPitch =
      `कॉल पर बताएं:\n` +
      `"नमस्ते जी! आपने WhatsApp पर ${effectiveConcernName} के बारे में पूछा था। हम समझ सकते हैं कि आप काफी समय से परेशान हैं। दरअसल, ${diseaseCause}\n\n` +
      `घबराइए नहीं, ${diseaseTreatment} कई बार सिर्फ सही डाइट प्लान और खानपान में सुधार से भी समस्या हल हो जाती है।\n\n` +
      `हमारी 5 सीनियर डॉक्टर्स की टीम आपकी पुरानी रिपोर्ट्स का अध्ययन करके आपको सही मार्गदर्शन देगी। सिर्फ ₹499 में लाइफटाइम कंसल्टेशन उपलब्ध है। क्या मैं कल के लिए आपकी वीडियो कंसल्टेशन या क्लिनिक विज़िट बुक कर दूँ?"`;

    return {
      intent_stage: 'ready_to_convert',
      intent_label: '🔥 Ready to Convert (Needs Human Touch Call)',
      intent_badge_color: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20',
      dropout_reason: `मरीज की समस्या वास्तविक और गंभीर है (${effectiveConcernName})। चैट में झिझक या व्यस्तता के कारण रुक गए, इन्हें सिर्फ एक भरोसेमंद फोन कॉल और डॉक्टर की सहानुभूति की ज़रूरत है।`,
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
    dropout_reason: 'मरीज सिर्फ सामान्य जानकारी या विज्ञापन देखकर आए थे, कोई व्यक्तिगत लक्षण या बीमारी साझा नहीं की।',
    calling_pitch:
      'मरीज से विनम्रता से पूछें कि क्या परिवार में किसी को माहवारी, PCOD या संतान प्राप्ति में कोई समस्या है जिसके लिए वे सीनियर आयुर्वेदिक गायनेकोलॉजिस्ट से सलाह लेना चाहते हैं।',
    urgency: 'low',
    disease_cause: diseaseCause,
    disease_treatment: diseaseTreatment,
    video_recommendation: matchedVideo ? matchedVideo.youtubeUrl : undefined,
  };
}
