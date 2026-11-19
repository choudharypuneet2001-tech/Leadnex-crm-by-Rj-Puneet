/**
 * Disease-wise Educational Video Links & Emotional Connect Messages for Gynocci
 * 
 * When a patient discusses a health concern on WhatsApp or during consultation,
 * the AI agent sends a deeply empathetic, emotionally connecting message along with
 * an educational video link from Gynocci's YouTube channel.
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

// Default curated repository of disease video links & emotional messaging
// Can be customized with user's specific Excel sheet YouTube links
export const DISEASE_VIDEO_DATABASE: DiseaseVideoEntry[] = [
  {
    category: 'tubal_blockage',
    keywords: ['tube', 'tubal', 'ट्यूब', 'फेलोपियन', 'fallopian', 'ब्लॉक', 'block', 'hsg', 'ह्सग'],
    diseaseNameHindi: 'फेलोपियन ट्यूब ब्लॉकेज',
    title: 'फेलोपियन ट्यूब ब्लॉकेज को बिना सर्जरी व बिना दर्द कैसे खोलें',
    youtubeUrl: 'https://www.youtube.com/watch?v=gynocci_tubal_blockage_treatment',
    emotionalHookHindi:
      'प्रिय बहन, ट्यूब ब्लॉक होने की रिपोर्ट देखकर घबराएं नहीं। लाखों महिलाओं को यह कहकर डराया जाता है कि बिना सर्जरी या IVF के बच्चा नहीं होगा, पर ऐसा बिल्कुल नहीं है। हजारों बहनों ने प्राकृतिक आयुर्वेदिक उत्तर बस्ती से दोनों ट्यूब्स खोलकर नेचुरल गर्भधारण किया है। 2 मिनट निकालकर हमारे सीनियर डॉक्टर का यह वीडियो जरूर देखें:',
    clinicalReasonHindi:
      'ट्यूब ब्लॉकेज अक्सर पेल्विक इन्फेक्शन, सूजन (PID) या म्यूकस प्लग की वजह से होता है जिससे अंडा और स्पर्म आपस में मिल नहीं पाते।',
    treatmentApproachHindi:
      'आयुर्वेद में बिना किसी चीरा-फाड़ी या सर्जरी के, उत्तर बस्ती और औषधीय हर्ब्स द्वारा ट्यूब्स के अंदर की सूजन व ब्लॉकेज को पूरी तरह साफ किया जाता है।',
  },
  {
    category: 'pcod_pcos',
    keywords: ['pcod', 'pcos', 'पीसीओडी', 'पीसीओएस', 'सिस्ट', 'cyst', 'अनियमित माहवारी', 'irregular period'],
    diseaseNameHindi: 'PCOD / PCOS एवं पीरियड्स की समस्या',
    title: 'PCOD / PCOS को बिना हार्मोनल पिल्स जड़ से कैसे ठीक करें',
    youtubeUrl: 'https://www.youtube.com/watch?v=gynocci_pcod_pcos_cure',
    emotionalHookHindi:
      'बहन, PCOD कोई लाइलाज बीमारी नहीं है, न ही इसके लिए आपको जिंदगी भर गर्भनिरोधक या हार्मोनल गोलियां खाने की जरूरत है। सही लाइफस्टाइल और ओवरी के डिटॉक्स से यह 100% रिवर्स हो सकता है। यह छोटा सा वीडियो देखकर समझें कि आपके शरीर में क्या हो रहा है और आप कैसे जल्दी स्वस्थ हो सकती हैं:',
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
    youtubeUrl: 'https://www.youtube.com/watch?v=gynocci_natural_conception_guide',
    emotionalHookHindi:
      'हम समझ सकते हैं कि हर महीने उम्मीद टूटने का दर्द और परिवार के सवालों का सामना करना कितना मुश्किल होता है। लेकिन निराश न हों, ईश्वर ने हर समस्या का समाधान दिया है। हमारे 5 सीनियर डॉक्टरों के पैनल द्वारा बनाया गया यह वीडियो आपको सही रास्ता और नई आशा देगा:',
    clinicalReasonHindi:
      'गर्भधारण में रुकावट के कई कारण हो सकते हैं जैसे अंडों की कमजोर क्वालिटी, एंडोमेट्रियम लाइनिंग का पतला होना, या हार्मोनल असंतुलन।',
    treatmentApproachHindi:
      'आयुर्वेद में बीज शुद्धि (ओवम और स्पर्म की गुणवत्ता सुधारना) और यूट्राइन टोनिंग द्वारा गर्भाशय को स्वस्थ गर्भधारण के लिए तैयार किया जाता है।',
  },
  {
    category: 'low_amh',
    keywords: ['amh', 'एएमएच', 'low amh', 'लो एएमएच', 'egg reserve', 'कम अंडे'],
    diseaseNameHindi: 'लो एएमएच (Low AMH - कम एग रिजर्व)',
    title: 'Low AMH में भी संभव है नेचुरल प्रेगनेंसी - पूरी सच्चाई जानें',
    youtubeUrl: 'https://www.youtube.com/watch?v=gynocci_low_amh_solution',
    emotionalHookHindi:
      'अगर किसी डॉक्टर ने लो AMH देखकर आपको डरा दिया है, तो हिम्मत मत हारिए। AMH सिर्फ अंडों की संख्या का संकेत देता है, कंसीव करने के लिए केवल 1 स्वस्थ और अच्छी क्वालिटी का अंडा चाहिए होता है। इस वीडियो को एक बार जरूर देखें और अपनी हिम्मत वापस पाएं:',
    clinicalReasonHindi:
      'उम्र, तनाव या पोषण की कमी से ओवेरियन रिजर्व कम हो जाता है, जिससे AMH का स्तर गिर जाता है।',
    treatmentApproachHindi:
      'ओवेरियन रिजुविनेशन और रसायन हर्ब्स के माध्यम से अंडों के पोषण (एग क्वालिटी) को बढ़ाकर लो AMH में भी प्राकृतिक प्रेगनेंसी संभव हो जाती है।',
  },
  {
    category: 'white_discharge',
    keywords: ['discharge', 'सफेद पानी', 'लिकोरिया', 'leucorrhoea', 'कमर दर्द', 'खुजली', 'itching'],
    diseaseNameHindi: 'सफेद पानी की समस्या (Leucorrhoea)',
    title: 'सफेद पानी (ल्यूकोरिया) से कमजोरी और कमर दर्द? जानें स्थायी इलाज',
    youtubeUrl: 'https://www.youtube.com/watch?v=gynocci_leucorrhoea_ayurveda',
    emotionalHookHindi:
      'सफेद पानी की वजह से होने वाली कमजोरी, चिड़चिड़ापन और कमर दर्द को नजरअंदाज न करें। यह शरीर को अंदर से खोखला कर देता है। हमारे डॉक्टरों ने इस पर बहुत ही सरल और असरदार घरेलू व आयुर्वेदिक सुझाव दिए हैं, इसे एक बार जरूर देखें:',
    clinicalReasonHindi:
      'पेल्विक कंजेशन, योनि में बैक्टीरियल/फंगल इन्फेक्शन या शरीर में पित्त और कफ दोष का बढ़ना सफेद पानी का मुख्य कारण होता है।',
    treatmentApproachHindi:
      'योनि प्रक्षालन और गर्भाशय को बल देने वाली आयुर्वेदिक औषधियों से इन्फेक्शन को जड़ से खत्म किया जाता है और शरीर की ऊर्जा लौटती है।',
  },
  {
    category: 'male_infertility',
    keywords: ['sperm', 'शुक्राणु', 'स्पर्म', 'motility', 'काउंट', 'semen', 'शुक्र'],
    diseaseNameHindi: 'शुक्राणु की कमी (Low Sperm Count & Motility)',
    title: 'पुरुषों में स्पर्म काउंट और गतिशीलता कैसे बढ़ाएं प्राकृतिक रूप से',
    youtubeUrl: 'https://www.youtube.com/watch?v=gynocci_male_fertility_boost',
    emotionalHookHindi:
      'संतान प्राप्ति केवल महिला की नहीं, दोनों की जिम्मेदारी होती है। संकोच या शर्म को छोड़कर समय पर सही इलाज लेना जरूरी है। हमारे सीनियर डॉक्टर्स का यह वीडियो आपको स्पर्म काउंट को तेजी से बढ़ाने का सही आयुर्वेदिक तरीका समझाएगा:',
    clinicalReasonHindi:
      'अत्यधिक तनाव, गर्मी (लैपटॉप/धूम्रपान) या शुक्र धातु के पोषण की कमी से स्पर्म काउंट व गतिशीलता कम हो जाती है।',
    treatmentApproachHindi:
      'आयुर्वेदिक वाजीकरण और शुक्र धातु पोषक रसायन से स्पर्म की संख्या, एक्टिव मोटिलिटी और मोर्फोलॉजी को 100% प्राकृतिक रूप से सुधारा जाता है।',
  },
];

/**
 * Finds matching video entry based on text (chat message, health concern, ad name)
 */
export function findDiseaseVideo(text?: string | null): DiseaseVideoEntry | null {
  if (!text) return null;
  const lower = text.toLowerCase();

  for (const entry of DISEASE_VIDEO_DATABASE) {
    for (const kw of entry.keywords) {
      if (lower.includes(kw)) {
        return entry;
      }
    }
  }

  return null;
}

/**
 * Formats a WhatsApp ready emotional video recommendation bubble
 */
export function formatDiseaseVideoMessage(entry: DiseaseVideoEntry): string {
  return (
    `🌸 *${entry.diseaseNameHindi} के लिए विशेष चिकित्सकीय मार्गदर्शन:*\n\n` +
    `${entry.emotionalHookHindi}\n\n` +
    `📺 *वीडियो देखें:* ${entry.youtubeUrl}\n\n` +
    `_यदि वीडियो देखने के बाद आपका कोई भी सवाल हो, तो आप बेझिझक हमसे यहाँ पूछ सकती हैं। हमारे डॉक्टर आपकी सहायता के लिए सदैव तत्पर हैं।_ 🙏`
  );
}
