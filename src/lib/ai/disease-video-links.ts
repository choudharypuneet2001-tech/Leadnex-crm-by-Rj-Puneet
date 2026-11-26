import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Disease-wise Educational Video Links & Emotional Connect Messages for Gynocci
 * 
 * When a patient discusses a health concern on WhatsApp or during telecalling,
 * the AI agent sends a deeply empathetic, emotionally connecting message along with
 * an educational video link from Gynocci's official channel (YouTube / Instagram).
 * 
 * In addition to hardcoded defaults, this module supports:
 * 1. Dynamic sync from Google Sheets (CSV export).
 * 2. Custom CSV import (paste directly from Excel).
 * 3. Supabase persistence via custom_fields storage so any updates take effect instantly.
 */

export interface DiseaseVideoEntry {
  category: string;
  keywords: string[];
  diseaseNameHindi: string;
  title: string;
  youtubeUrl: string;
  emotionalHookHindi: string;
  clinicalReasonHindi: string;
  treatmentApproachHindi: string;
}

export const DISEASE_VIDEOS_CONFIG_KEY = '__gynocci_disease_videos_config__';

export const DEFAULT_DISEASE_VIDEOS: DiseaseVideoEntry[] = [
  {
    category: 'pcod_pcos',
    keywords: ['pcod', 'pcos', 'पीसीओडी', 'पीसीओएस', 'सिस्ट', 'cyst', 'अनियमित माहवारी', 'irregular period'],
    diseaseNameHindi: 'PCOD / PCOS एवं हार्मोनल असंतुलन',
    title: 'PCOD / PCOS को बिना हार्मोनल पिल्स जड़ से कैसे ठीक करें',
    youtubeUrl: 'https://www.youtube.com/watch?v=SIwdLPiapGk',
    emotionalHookHindi:
      'बहन, PCOD कोई लाइलाज बीमारी नहीं है, न ही इसके लिए जिंदगी भर गर्भनिरोधक या हार्मोनल गोलियां खाने की जरूरत है। सही लाइफस्टाइल और ओवरी के डिटॉक्स से यह 100% रिवर्स हो सकता है। यह छोटा सा वीडियो देखकर समझें कि आपके शरीर में क्या हो रहा है और आप कैसे जल्दी स्वस्थ हो सकती हैं:',
    clinicalReasonHindi:
      'हार्मोनल असंतुलन और इंसुलिन रेजिस्टेंस की वजह से ओवरी में अंडे समय पर मैच्योर नहीं हो पाते और छोटे-छोटे सिस्ट का रूप ले लेते हैं।',
    treatmentApproachHindi:
      'आयुर्वेद में ओवेरियन डिटॉक्सिफिकेशन, इंसुलिन सेंसिटिविटी सुधारने और डाइट करेक्शन से अंडों की क्वालिटी बेहतर करके पीरियड्स को प्राकृतिक रूप से नियमित किया जाता है।',
  },
  {
    category: 'infertility_conceive',
    keywords: ['conceive', 'गर्भधारण', 'संतान', 'प्रेग्नेंट', 'pregnant', 'baby', 'बच्चा', 'infertility', 'निःसंतानता', 'बांझपन', 'औलाद'],
    diseaseNameHindi: 'नेचुरल गर्भधारण (कंसीव करने में रुकावट)',
    title: 'सालों से कंसीव नहीं हो रहा? जानें सही आयुर्वेदिक तरीका व कारण',
    youtubeUrl: 'https://youtu.be/Ff7-H4rdh34?si=CITpPFdi14bDEp_l',
    emotionalHookHindi:
      'हम समझ सकते हैं कि हर महीने उम्मीद टूटने का दर्द और परिवार के सवालों का सामना करना कितना भारी होता है। पर निराश न हों, लाखों महिलाओं ने प्राकृतिक आयुर्वेद से मातृत्व का सुख पाया है। हमारे 5 सीनियर डॉक्टरों के पैनल का यह वीडियो आपको सही दिशा और नई उम्मीद देगा:',
    clinicalReasonHindi:
      'अंडों की कमजोर क्वालिटी, गर्भाशय की एंडोमेट्रियम परत का पतला होना, या हार्मोनल असंतुलन कंसीव करने में मुख्य बाधा बनते हैं।',
    treatmentApproachHindi:
      'आयुर्वेद में बीज शुद्धि और गर्भाशय पोषण द्वारा यूट्रस को नेचुरल प्रेगनेंसी के लिए पूरी तरह सक्षम बनाया जाता है।',
  },
  {
    category: 'male_infertility',
    keywords: ['sperm', 'शुक्राणु', 'स्पर्म', 'motility', 'काउंट', 'semen', 'शुक्र', 'male infertility', 'पुरुष'],
    diseaseNameHindi: 'पुरुष शुक्राणु समस्या (Low Sperm Count & Motility)',
    title: 'पुरुषों में स्पर्म काउंट और गतिशीलता कैसे बढ़ाएं प्राकृतिक रूप से',
    youtubeUrl: 'https://www.youtube.com/shorts/VGrD6z4djQk',
    emotionalHookHindi:
      'संतान प्राप्ति केवल महिला की नहीं, दोनों की जिम्मेदारी होती है। संकोच छोड़कर समय पर सही समाधान लेना ही समझदारी है। हमारे सीनियर डॉक्टर्स का यह छोटा वीडियो आपको स्पर्म काउंट और गतिशीलता बढ़ाने का सही आयुर्वेदिक तरीका समझाएगा:',
    clinicalReasonHindi:
      'तनाव, शरीर में अत्यधिक गर्मी, खान-पान या शुक्र धातु की कमजोरी से स्पर्म काउंट और सक्रियता कम हो जाती है।',
    treatmentApproachHindi:
      'आयुर्वेदिक वाजीकरण और शुक्र धातु पोषक रसायन से स्पर्म की संख्या, एक्टिव मोटिलिटी और मोर्फोलॉजी को 100% प्राकृतिक रूप से सुधारा जाता है।',
  },
  {
    category: 'tubal_blockage',
    keywords: ['tube', 'tubal', 'ट्यूब', 'फेलोपियन', 'fallopian', 'ब्लॉक', 'block', 'hsg', 'ह्सग'],
    diseaseNameHindi: 'फेलोपियन ट्यूब ब्लॉकेज',
    title: 'फेलोपियन ट्यूब ब्लॉकेज को बिना सर्जरी व बिना दर्द कैसे खोलें',
    youtubeUrl: 'https://www.youtube.com/watch?v=DaGu2ZeSuBg',
    emotionalHookHindi:
      'प्रिय बहन, ट्यूब ब्लॉक होने की रिपोर्ट देखकर घबराएं नहीं। लाखों महिलाओं को यह कहकर डराया जाता है कि बिना सर्जरी या IVF के बच्चा नहीं होगा, पर ऐसा नहीं है। हजारों बहनों ने प्राकृतिक उत्तर बस्ती से दोनों ट्यूब्स खोलकर नेचुरल गर्भधारण किया है। 2 मिनट निकालकर हमारे सीनियर डॉक्टर का यह वीडियो जरूर देखें:',
    clinicalReasonHindi:
      'ट्यूब ब्लॉकेज अक्सर पेल्विक इन्फेक्शन, सूजन (PID) या म्यूकस प्लग की वजह से होता है जिससे अंडा और स्पर्म आपस में मिल नहीं पाते।',
    treatmentApproachHindi:
      'आयुर्वेद में बिना किसी चीरा-फाड़ी या सर्जरी के, उत्तर बस्ती और औषधीय हर्ब्स द्वारा ट्यूब्स के अंदर की सूजन व ब्लॉकेज को पूरी तरह साफ किया जाता है।',
  },
  {
    category: 'white_discharge',
    keywords: ['discharge', 'सफेद पानी', 'लिकोरिया', 'leucorrhoea', 'कमर दर्द', 'खुजली', 'itching', 'safed pani'],
    diseaseNameHindi: 'सफेद पानी की समस्या (Leucorrhoea)',
    title: 'सफेद पानी (ल्यूकोरिया) से कमजोरी और कमर दर्द? जानें स्थायी इलाज',
    youtubeUrl: 'https://www.youtube.com/shorts/IDx6reRUI_o',
    emotionalHookHindi:
      'सफेद पानी की वजह से होने वाली कमजोरी, चिड़चिड़ापन और कमर दर्द को नजरअंदाज न करें। यह शरीर को अंदर से खोखला कर देता है। हमारे डॉक्टरों ने इस पर बहुत ही सरल और असरदार सुझाव दिए हैं, इसे एक बार जरूर देखें:',
    clinicalReasonHindi:
      'पेल्विक कंजेशन, योनि में बैक्टीरियल/फंगल इन्फेक्शन या शरीर में पित्त और कफ दोष का बढ़ना सफेद पानी का मुख्य कारण होता है।',
    treatmentApproachHindi:
      'योनि प्रक्षालन और गर्भाशय को बल देने वाली आयुर्वेदिक औषधियों से इन्फेक्शन को जड़ से खत्म किया जाता है और शरीर की ऊर्जा लौटती है।',
  },
  {
    category: 'fibroids',
    keywords: ['fibroid', 'fibroids', 'रसौली', 'गांठ', 'फाइब्रॉएड', 'uterus fibroid', 'बच्चेदानी में गांठ'],
    diseaseNameHindi: 'यूट्रस फाइब्रॉएड (गर्भाशय में गांठ / रसौली)',
    title: 'गर्भाशय की रसौली (Fibroids) का बिना ऑपरेशन आयुर्वेदिक इलाज',
    youtubeUrl: 'https://www.youtube.com/shorts/JIpdhitZqCk',
    emotionalHookHindi:
      'यूट्रस में गांठ या रसौली सुनकर तुरंत बच्चेदानी निकालने (ऑपरेशन) की सलाह से डरें नहीं। आयुर्वेद में गांठ को सुखाकर और पिघलाकर खत्म करने के बेहद असरदार उपाय हैं। हमारे सीनियर डॉक्टर का यह वीडियो जरूर देखें:',
    clinicalReasonHindi:
      'एस्ट्रोजन हार्मोन की अधिकता और गर्भाशय में रक्त का सही संचार न होने से मांसपेशियों में गांठें (फाइब्रॉएड) बनने लगती हैं।',
    treatmentApproachHindi:
      'कफ-मेद पाचक औषधियों और लेखन द्रव्यों से फाइब्रॉएड के साइज को धीरे-धीरे सिकोड़कर बिना सर्जरी खत्म किया जाता है।',
  },
  {
    category: 'low_amh',
    keywords: ['amh', 'एएमएच', 'low amh', 'लो एएमएच', 'egg reserve', 'कम अंडे'],
    diseaseNameHindi: 'लो एएमएच (Low AMH - कम एग रिजर्व)',
    title: 'Low AMH में भी संभव है नेचुरल प्रेगनेंसी - पूरी सच्चाई जानें',
    youtubeUrl: 'https://www.youtube.com/watch?v=-OnxJRJReQ8',
    emotionalHookHindi:
      'अगर किसी डॉक्टर ने लो AMH देखकर आपको डरा दिया है, तो हिम्मत मत हारिए। AMH सिर्फ अंडों की संख्या का संकेत देता है, कंसीव करने के लिए केवल 1 स्वस्थ और अच्छी क्वालिटी का अंडा चाहिए होता है। इस वीडियो को एक बार जरूर देखें और अपनी हिम्मत वापस पाएं:',
    clinicalReasonHindi:
      'उम्र, तनाव या पोषण की कमी से ओवेरियन रिजर्व कम हो जाता है, जिससे AMH का स्तर गिर जाता है।',
    treatmentApproachHindi:
      'ओवेरियन रिजुविनेशन और रसायन हर्ब्स के माध्यम से अंडों के पोषण (एग क्वालिटी) को बढ़ाकर लो AMH में भी प्राकृतिक प्रेगनेंसी संभव हो जाती है।',
  },
  {
    category: 'periods',
    keywords: ['period', 'periods', 'माहवारी', 'मासिक धर्म', 'रक्तस्राव', 'heavy flow', 'painful periods', 'दर्द', 'period problem'],
    diseaseNameHindi: 'अनियमित पीरियड्स, अत्यधिक रक्तस्राव व दर्द',
    title: 'पीरियड्स खुलकर न आना या असहनीय दर्द? जानें सही समाधान',
    youtubeUrl: 'https://www.youtube.com/watch?v=dMkrUxILiqQ',
    emotionalHookHindi:
      'पीरियड्स के असहनीय दर्द या अनियमितता को नॉर्मल मानकर पेनकिलर खाकर न टालें। आपका मासिक चक्र आपके संपूर्ण स्वास्थ्य का आईना है। हमारे डॉक्टरों का यह सरल और स्पष्ट वीडियो जरूर देखें:',
    clinicalReasonHindi:
      'अपान वायु की विकृति और गर्भाशय में रक्त संचार की रुकावट से पीरियड्स में दर्द, थक्के और अनियमितता आती है।',
    treatmentApproachHindi:
      'वात अनुलोमन और गर्भाशय शोधक हर्ब्स से मासिक चक्र को समय पर, बिना दर्द और सामान्य प्रवाह के साथ नियमित किया जाता है।',
  },
  {
    category: 'endometriosis',
    keywords: ['endometriosis', 'endimetriosis', 'एंडोमेट्रियोसिस', 'एंडोमेट्रिओसिस', 'चॉकलेट सिस्ट', 'chocolate cyst'],
    diseaseNameHindi: 'एंडोमेट्रिओसिस एवं चॉकलेट सिस्ट',
    title: 'Endometriosis और असहनीय दर्द का स्थायी आयुर्वेदिक इलाज',
    youtubeUrl: 'https://www.youtube.com/watch?v=w5VIHXn02JY',
    emotionalHookHindi:
      'एंडोमेट्रिओसिस का दर्द शारीरिक और मानसिक रूप से बहुत थका देता है। सर्जरी के बाद भी इसके दोबारा होने का डर रहता है, परंतु आयुर्वेद में इसे अंदरूनी सूजन शांत करके ठीक किया जा सकता है। यह वीडियो एक बार जरूर देखें:',
    clinicalReasonHindi:
      'गर्भाशय की अंदरूनी परत के टिशू जब ओवरी या फैलोपियन ट्यूब पर उगने लगते हैं, तो सूजन, चिपकन और चॉकलेट सिस्ट बन जाती है।',
    treatmentApproachHindi:
      'वात-पित्त शामक और सूजन रोधी आयुर्वेदिक औषधियों से अतिरिक्त टिशूज को शांत करके दर्द और इनफर्टिलिटी को रिवर्स किया जाता है।',
  },
  {
    category: 'unexplained_infertility',
    keywords: ['unexplained', 'सब नॉर्मल', 'रिपोर्ट नॉर्मल', 'कारण नहीं पता', 'unknown reason', 'reports normal', 'unexplained infertility'],
    diseaseNameHindi: 'अनएक्सप्लेंड इनफर्टिलिटी (सब नॉर्मल फिर भी कंसीव नहीं)',
    title: 'सब रिपोर्ट नॉर्मल हैं फिर भी बच्चा क्यों नहीं ठहर रहा? जानें कारण',
    youtubeUrl: 'https://www.youtube.com/watch?v=JeDkcmN5SBI',
    emotionalHookHindi:
      'जब पति और पत्नी दोनों की सभी रिपोर्ट नॉर्मल आएं फिर भी सालों से कंसीव न हो, तो मन बहुत परेशान होता है। आधुनिक विज्ञान कई सूक्ष्म कारणों को नहीं पकड़ पाता, जिन्हें आयुर्वेद आसानी से सुलझाता है। यह वीडियो आपकी आंखें खोल देगा:',
    clinicalReasonHindi:
      'सूक्ष्म हार्मोनल असंतुलन, यूट्रस का गर्म स्वभाव (पित्त अधिकता), या भ्रूण का आरोपण (Implantation) न हो पाना इसका कारण होता है।',
    treatmentApproachHindi:
      'गर्भसंस्कार व गर्भाशय शोधन से शरीर का वातावरण भ्रूण को स्वीकार करने और गर्भ ठहराने के अनुकूल बनाया जाता है।',
  },
  {
    category: 'menopause',
    keywords: ['menopause', 'रजोनिवृत्ति', 'हॉट फ्लैश', 'hot flashes', 'periods band', 'मेनोपॉज'],
    diseaseNameHindi: 'मेनोपॉज (रजोनिवृत्ति) देखभाल व राहत',
    title: 'मेनोपॉज के दौरान मूड स्विंग्स, हॉट फ्लैश और कमजोरी से पाएं राहत',
    youtubeUrl: '',
    emotionalHookHindi:
      '45-50 की उम्र में पीरियड्स बंद होने के साथ मूड स्विंग्स, चिड़चिड़ापन और अचानक गर्मी लगना स्वाभाविक है। आयुर्वेद में इसका बहुत ही शांत और सुखद समाधान है:',
    clinicalReasonHindi:
      'शरीर में एस्ट्रोजन का स्तर तेजी से गिरने और वात दोष बढ़ने से मेनोपॉज के लक्षण प्रकट होते हैं।',
    treatmentApproachHindi:
      'रसायन हर्ब्स (जैसे शतावरी, अश्वगंधा) से हार्मोन्स को प्राकृतिक रूप से संतुलित करके शरीर और मन को शांति दी जाती है।',
  },
  {
    category: 'intro',
    keywords: ['intro', 'gynocci kya hai', 'kya karte ho', 'about', 'परिचय', 'clinic video', 'संस्थान'],
    diseaseNameHindi: 'Gynocci Femtech संस्थान व डॉक्टर्स पैनल परिचय',
    title: 'Gynocci Femtech - भारत का अग्रणी प्राकृतिक महिला स्वास्थ्य संस्थान',
    youtubeUrl: 'https://www.instagram.com/p/DfbeKSXqOhN/',
    emotionalHookHindi:
      'Gynocci Femtech महिलाओं और दंपतियों को प्राकृतिक रूप से स्वस्थ बनाने और मातृत्व का सुख देने के लिए 9 शहरों में क्लीनिक और 5 वरिष्ठ डॉक्टरों का पैनल संचालित करता है। हमारी एक छोटी झलक देखें:',
    clinicalReasonHindi:
      'प्राकृतिक आयुर्वेदिक सिद्धांतों, आधुनिक डायग्नोस्टिक्स और 5 वरिष्ठ डॉक्टरों की समर्पित टीम का अनूठा समन्वय।',
    treatmentApproachHindi:
      'प्रत्येक मरीज का व्यक्तिगत केस अध्ययन, नाड़ी व जिह्वा परीक्षण, और 100% शुद्ध प्राकृतिक उपचार।',
  },
];

// In-memory runtime cache per account
const managedVideosCache = new Map<string, { videos: DiseaseVideoEntry[]; timestamp: number }>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache

/**
 * Normalizes input name for category matching
 */
export function normalizeCategoryName(raw: string): string {
  const clean = raw.trim().toLowerCase();
  if (clean.includes('pcod') || clean.includes('pcos')) return 'pcod_pcos';
  if (clean.includes('unexplained')) return 'unexplained_infertility';
  if (clean.includes('infertility') || clean.includes('conceive') || clean.includes('गर्भधारण') || clean.includes('बांझपन')) return 'infertility_conceive';
  if (clean.includes('sperm') || clean.includes('शुक्राणु') || clean.includes('पुरुष')) return 'male_infertility';
  if (clean.includes('tube') || clean.includes('tubal') || clean.includes('ट्यूब')) return 'tubal_blockage';
  if (clean.includes('discharge') || clean.includes('white') || clean.includes('सफेद पानी') || clean.includes('ल्यूकोरिया')) return 'white_discharge';
  if (clean.includes('fibroid') || clean.includes('रसौली') || clean.includes('गांठ')) return 'fibroids';
  if (clean.includes('amh')) return 'low_amh';
  if (clean.includes('period') || clean.includes('माहवारी')) return 'periods';
  if (clean.includes('endimetriosis') || clean.includes('endometriosis') || clean.includes('चॉकलेट सिस्ट')) return 'endometriosis';
  if (clean.includes('menopause') || clean.includes('रजोनिवृत्ति')) return 'menopause';
  if (clean.includes('intro') || clean.includes('about')) return 'intro';

  return clean.replace(/[^a-z0-9_]/g, '_');
}

/**
 * Parses raw CSV rows (from Excel or Google Sheets) into DiseaseVideoEntry list
 * Supports:
 * Format 1: Disease Name, URL (e.g. "PCOD/PCOS,https://www.youtube.com/watch?v=...")
 * Format 2: Disease Name, Title, URL
 */
export function parseDiseaseVideoCsv(csvText: string): DiseaseVideoEntry[] {
  if (!csvText || !csvText.trim()) return [...DEFAULT_DISEASE_VIDEOS];

  const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const result: DiseaseVideoEntry[] = JSON.parse(JSON.stringify(DEFAULT_DISEASE_VIDEOS));

  for (const line of lines) {
    // Skip common header row
    if (/^(disease|name|category|topic|heading|title)/i.test(line)) continue;

    // Split by comma or tab
    const parts = line.includes('\t') ? line.split('\t') : line.split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/);
    if (parts.length < 1) continue;

    const rawName = parts[0]?.replace(/^["']|["']$/g, '').trim();
    if (!rawName) continue;

    const rawUrl = (parts.length >= 2 ? parts[parts.length - 1] : '')
      ?.replace(/^["']|["']$/g, '')
      .trim();

    const catKey = normalizeCategoryName(rawName);
    const existingIndex = result.findIndex((e) => e.category === catKey);

    if (existingIndex >= 0) {
      if (rawUrl && (rawUrl.startsWith('http') || rawUrl.includes('youtu') || rawUrl.includes('instagram'))) {
        result[existingIndex].youtubeUrl = rawUrl;
      }
    } else {
      // Add as custom disease video entry
      result.push({
        category: catKey,
        keywords: [rawName.toLowerCase()],
        diseaseNameHindi: rawName,
        title: rawName,
        youtubeUrl: rawUrl || '',
        emotionalHookHindi: `हमारे विशेषज्ञ डॉक्टर का यह महत्वपूर्ण वीडियो आपकी समस्या के सही समाधान के लिए जरूर देखें:`,
        clinicalReasonHindi: `विस्तृत केस हिस्ट्री एवं रिपोर्ट्स के आधार पर विशेषज्ञ द्वारा मूल्यांकन आवश्यक है।`,
        treatmentApproachHindi: `आयुर्वेद में प्राकृतिक व सुरक्षित उपचार से शरीर के त्रिदोषों को संतुलित किया जाता है।`,
      });
    }
  }

  return result;
}

/**
 * Fetches managed disease videos for an account from Supabase, or falls back to defaults.
 */
export async function getManagedDiseaseVideos(
  db: SupabaseClient | null | undefined,
  accountId?: string | null
): Promise<DiseaseVideoEntry[]> {
  if (!accountId || !db) return DEFAULT_DISEASE_VIDEOS;

  const cached = managedVideosCache.get(accountId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.videos;
  }

  try {
    const builder = db.from('custom_fields').select('field_options');
    if (typeof (builder as any)?.eq !== 'function') return DEFAULT_DISEASE_VIDEOS;
    let query = (builder as any).eq('account_id', accountId);
    if (typeof query?.eq === 'function') {
      query = query.eq('field_name', DISEASE_VIDEOS_CONFIG_KEY);
    }
    if (typeof query?.maybeSingle !== 'function') return DEFAULT_DISEASE_VIDEOS;

    const { data, error } = await query.maybeSingle();

    if (!error && data?.field_options?.videos && Array.isArray(data.field_options.videos)) {
      const stored = data.field_options.videos as DiseaseVideoEntry[];
      if (stored.length > 0) {
        managedVideosCache.set(accountId, { videos: stored, timestamp: Date.now() });
        return stored;
      }
    }
  } catch (err) {
    // Graceful fallback to default videos
  }

  return DEFAULT_DISEASE_VIDEOS;
}

/**
 * Saves managed disease videos for an account to Supabase.
 */
export async function saveManagedDiseaseVideos(
  db: SupabaseClient,
  accountId: string,
  videos: DiseaseVideoEntry[],
  googleSheetsUrl?: string,
  userId?: string
): Promise<void> {
  if (!accountId) return;

  const payload = {
    videos,
    googleSheetsUrl: googleSheetsUrl?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await db
    .from('custom_fields')
    .select('id')
    .eq('account_id', accountId)
    .eq('field_name', DISEASE_VIDEOS_CONFIG_KEY)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await db
      .from('custom_fields')
      .update({
        field_options: payload,
      })
      .eq('id', existing.id);
    if (error) throw error;
  } else {
    // Resolve a valid user_id from auth.users (via profiles or caller's userId)
    let effectiveUserId = userId;
    if (!effectiveUserId) {
      const { data: prof } = await db
        .from('profiles')
        .select('user_id')
        .eq('account_id', accountId)
        .limit(1)
        .maybeSingle();
      effectiveUserId = prof?.user_id;
    }

    if (!effectiveUserId) {
      try {
        const { data: authUser } = await db.auth.getUser();
        effectiveUserId = authUser?.user?.id;
      } catch {
        // fallback
      }
    }

    const insertPayload: Record<string, any> = {
      account_id: accountId,
      field_name: DISEASE_VIDEOS_CONFIG_KEY,
      field_type: 'json',
      field_options: payload,
    };
    if (effectiveUserId) {
      insertPayload.user_id = effectiveUserId;
    }

    const { error } = await db.from('custom_fields').insert(insertPayload);
    if (error) throw error;
  }

  // Invalidate cache
  managedVideosCache.set(accountId, { videos, timestamp: Date.now() });
}

/**
 * Syncs disease videos directly from a Google Sheets URL
 * Converts normal Google Sheets URL (edit#gid=0) to export CSV URL automatically.
 */
export async function syncFromGoogleSheetsUrl(rawUrl: string): Promise<DiseaseVideoEntry[]> {
  if (!rawUrl || !rawUrl.trim()) {
    throw new Error('Google Sheets URL is required.');
  }

  let fetchUrl = rawUrl.trim();

  // If standard edit link, convert to CSV export format
  if (fetchUrl.includes('docs.google.com/spreadsheets/d/')) {
    if (!fetchUrl.includes('export?format=csv') && !fetchUrl.includes('pub?output=csv')) {
      fetchUrl = fetchUrl.replace(/\/edit(#gid=\d+)?(\?.*)?$/, '/export?format=csv');
      if (!fetchUrl.includes('/export?format=csv')) {
        fetchUrl = fetchUrl.replace(/\/$/, '') + '/export?format=csv';
      }
    }
  }

  const res = await fetch(fetchUrl, {
    headers: {
      Accept: 'text/csv, text/plain, */*',
    },
  });

  if (!res.ok) {
    throw new Error(`Google Sheets fetch failed with status ${res.status} (${res.statusText}). Please check that the sheet is shared as "Anyone with the link can view".`);
  }

  const csvText = await res.text();
  return parseDiseaseVideoCsv(csvText);
}

/**
 * Finds matching video entry based on text (chat message, health concern, ad name)
 */
const CATEGORY_SPECIFICITY_BONUS: Record<string, number> = {
  pcod_pcos: 10,
  tubal_blockage: 10,
  endometriosis: 10,
  fibroids: 10,
  low_amh: 10,
  male_infertility: 10,
  unexplained_infertility: 10,
  infertility_conceive: 5,
};

/**
 * Finds matching video entry based on text (chat message, health concern, ad name)
 * Uses specificity ranking so primary clinical diagnoses (PCOD, Tubal, AMH, Fibroids)
 * take precedence over generic symptoms (periods, discharge).
 */
export function findDiseaseVideo(
  text?: string | null,
  customDatabase: DiseaseVideoEntry[] = DEFAULT_DISEASE_VIDEOS
): DiseaseVideoEntry | null {
  if (!text) return null;
  const lower = text.toLowerCase();

  let bestMatch: DiseaseVideoEntry | null = null;
  let bestScore = 0;

  for (const entry of customDatabase) {
    if (!entry.youtubeUrl || entry.youtubeUrl.trim() === '') continue;
    const bonus = CATEGORY_SPECIFICITY_BONUS[entry.category] || 0;

    for (const kw of entry.keywords) {
      const kwLower = kw.toLowerCase();
      if (lower.includes(kwLower)) {
        const score = kwLower.length + bonus;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = entry;
        }
      }
    }
  }

  return bestMatch;
}

/**
 * Formats a WhatsApp ready emotional video recommendation bubble
 */
export function formatDiseaseVideoMessage(entry: DiseaseVideoEntry): string {
  if (!entry.youtubeUrl) return '';

  return (
    `🌸 *${entry.diseaseNameHindi} के लिए विशेष चिकित्सकीय मार्गदर्शन:*\n\n` +
    `${entry.emotionalHookHindi}\n\n` +
    `📺 *वीडियो देखें:* ${entry.youtubeUrl}\n\n` +
    `_यदि वीडियो देखने के बाद आपका कोई भी सवाल हो, तो आप बेझिझक हमसे यहाँ पूछ सकती हैं। हमारे डॉक्टर आपकी सहायता के लिए सदैव तत्पर हैं।_ 🙏`
  );
}

/**
 * Formats the disease videos knowledge block to inject into the AI agent's system prompt
 */
export function formatDiseaseVideosForPrompt(videos: DiseaseVideoEntry[] = DEFAULT_DISEASE_VIDEOS): string {
  const activeEntries = videos.filter((v) => v.youtubeUrl && v.youtubeUrl.trim().length > 0);
  if (activeEntries.length === 0) return '';

  const rows = activeEntries.map(
    (v, i) =>
      `  ${i + 1}. ${v.diseaseNameHindi} (${v.category}):\n` +
      `     - YouTube Link: ${v.youtubeUrl}\n` +
      `     - Key Message: ${v.emotionalHookHindi.slice(0, 100)}...`
  );

  return (
    '• OFFICIAL EDUCATIONAL VIDEO LINKS & HEARTFELT REASSURANCE SCRIPT:\n' +
    '  - When a patient describes their health concern (such as PCOD, Tubal Blockage, Conceive/Infertility, Sperm Issues, White Discharge, Fibroids, Low AMH, Periods, Endometriosis) OR asks for videos/information/doctor guidance:\n' +
    '    Warmly include the matching official educational video link in one of your reply bubbles, encouraging them to watch it with deep empathy.\n' +
    '  - CRITICAL CONSTRAINT: DO NOT repeatedly send the video link on every subsequent turn if a video link has already been sent earlier in the conversation history! Send it once when the topic is discussed or when explicitly requested.\n' +
    '  - EXACT VERIFIED OFFICIAL LINKS REPOSITORY:\n' +
    rows.join('\n')
  );
}
