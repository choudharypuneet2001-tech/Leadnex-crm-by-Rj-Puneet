export interface ClinicDetails {
  city: string
  hindiCity: string
  aliases: string[]
  titleHindi: string
  addressHindi: string
  addressEnglish: string
  landmarkHindi: string
  googleMapsUrl: string
  timings: string
  helpline: string
}

export const GYNOCCI_CLINICS: Record<string, ClinicDetails> = {
  jaipur: {
    city: 'Jaipur',
    hindiCity: 'जयपुर',
    aliases: ['jaipur', 'जयपुर', 'head office', 'rajasthan'],
    titleHindi: 'Gynocci Clinic - जयपुर (Head Office)',
    addressHindi: '45, हनुमान वाटिका, चित्रकूट मार्ग, टैगोर नगर, वैशाली नगर, जयपुर, राजस्थान 302021',
    addressEnglish: '45, Hanuman Vatika, Chitrakoot Marg, Tagore Nagar, Vaishali Nagar, Jaipur, Rajasthan 302021',
    landmarkHindi: 'चित्रकूट मार्ग, वैशाली नगर',
    googleMapsUrl: 'https://maps.google.com/?q=Gynocci+Tagore+Nagar+Vaishali+Nagar+Jaipur',
    timings: 'सुबह 10:00 बजे से शाम 6:30 बजे तक (सोमवार से रविवार - सातों दिन खुला)',
    helpline: '+91 8450000845',
  },
  delhi: {
    city: 'Delhi',
    hindiCity: 'दिल्ली',
    aliases: ['delhi', 'new delhi', 'दिल्ली', 'नई दिल्ली', 'rajouri garden'],
    titleHindi: 'Gynocci Clinic - नई दिल्ली (राजौरी गार्डन)',
    addressHindi: 'ग्राउंड फ्लोर, A-11, ब्लॉक A2, मेट्रो पिलर नंबर 388 के पास, राजौरी गार्डन, नई दिल्ली, दिल्ली 110027',
    addressEnglish: 'Ground Floor, A-11, Block A2, Near Metro Pillar No. 388, Rajouri Garden, New Delhi, Delhi 110027',
    landmarkHindi: 'मेट्रो पिलर नंबर 388 के पास, राजौरी गार्डन',
    googleMapsUrl: 'https://maps.google.com/?q=Gynocci+Rajouri+Garden+New+Delhi',
    timings: 'सुबह 10:00 बजे से शाम 6:30 बजे तक (सोमवार से रविवार - सातों दिन खुला)',
    helpline: '+91 8450000845',
  },
  lucknow: {
    city: 'Lucknow',
    hindiCity: 'लखनऊ',
    aliases: ['lucknow', 'लखनऊ', 'gomti nagar', 'up', 'uttar pradesh'],
    titleHindi: 'Gynocci Clinic - लखनऊ (गोमती नगर)',
    addressHindi: 'DLF MyPAD, प्रथम तल (Titan Eye+ के ऊपर), विभूति खंड, गोमती नगर, लखनऊ, उत्तर प्रदेश 226010',
    addressEnglish: 'DLF MyPAD, 1st Floor (Above Titan Eye+), Vibhuti Khand, Gomti Nagar, Lucknow, Uttar Pradesh 226010',
    landmarkHindi: 'टाइटन आई प्लस के ऊपर, विभूति खंड, गोमती नगर',
    googleMapsUrl: 'https://maps.google.com/?q=Gynocci+DLF+MyPAD+Gomti+Nagar+Lucknow',
    timings: 'सुबह 10:00 बजे से शाम 6:30 बजे तक (सोमवार से रविवार - सातों दिन खुला)',
    helpline: '+91 8450000845',
  },
  amritsar: {
    city: 'Amritsar',
    hindiCity: 'अमृतसर',
    aliases: ['amritsar', 'अमृतसर', 'ranjit avenue', 'punjab'],
    titleHindi: 'Gynocci Clinic - अमृतसर (रंजीत एवेन्यू)',
    addressHindi: 'SCO 138, द्वितीय तल, डी ब्लॉक, रंजीत एवेन्यू, अमृतसर, पंजाब 143001',
    addressEnglish: 'SCO 138, 2nd Floor, D Block, Ranjit Avenue, Amritsar, Punjab 143001',
    landmarkHindi: 'डी ब्लॉक, रंजीत एवेन्यू',
    googleMapsUrl: 'https://maps.google.com/?q=Gynocci+Ranjit+Avenue+Amritsar',
    timings: 'सुबह 10:00 बजे से शाम 6:30 बजे तक (सोमवार से रविवार - सातों दिन खुला)',
    helpline: '+91 8450000845',
  },
  ludhiana: {
    city: 'Ludhiana',
    hindiCity: 'लुधियाना',
    aliases: ['ludhiana', 'लुधियाना', 'circuit house', 'pau'],
    titleHindi: 'Gynocci Clinic - लुधियाना (सर्किट हाउस रोड)',
    addressHindi: '1905, सर्किट हाउस रोड, गोबिंद नगर, पीएयू (PAU) के पास, लुधियाना, पंजाब 141001',
    addressEnglish: '1905, Circuit House Road, Gobind Nagar, Near PAU, Ludhiana, Punjab 141001',
    landmarkHindi: 'सर्किट हाउस रोड, पीएयू (PAU) के पास, गोबिंद नगर',
    googleMapsUrl: 'https://maps.google.com/?q=Gynocci+Circuit+House+Road+Ludhiana',
    timings: 'सुबह 10:00 बजे से शाम 6:30 बजे तक (सोमवार से रविवार - सातों दिन खुला)',
    helpline: '+91 8450000845',
  },
  patna: {
    city: 'Patna',
    hindiCity: 'पटना',
    aliases: ['patna', 'पटना', 'kankarbagh', 'bihar'],
    titleHindi: 'Gynocci Clinic - पटना (कंकड़बाग)',
    addressHindi: 'साईं स्वर्णिका, तृतीय तल, कुम्हरार, कंकड़बाग मेन रोड (सदर ब्लॉक के सामने), पटना, बिहार 800026',
    addressEnglish: 'Sai Swarnika, 3rd Floor, Kumhrar, Kankarbagh Main Road (Opposite Sadar Block), Patna, Bihar 800026',
    landmarkHindi: 'सदर ब्लॉक के सामने, कंकड़बाग मेन रोड',
    googleMapsUrl: 'https://maps.google.com/?q=Gynocci+Kankarbagh+Main+Road+Patna',
    timings: 'सुबह 10:00 बजे से शाम 6:30 बजे तक (सोमवार से रविवार - सातों दिन खुला)',
    helpline: '+91 8450000845',
  },
  ranchi: {
    city: 'Ranchi',
    hindiCity: 'रांची',
    aliases: ['ranchi', 'रांची', 'kanke road', 'jharkhand'],
    titleHindi: 'Gynocci Clinic - रांची (कांके रोड)',
    addressHindi: 'मित्तल हाइट, प्रथम तल, कांके रोड (CMPDI गेट के पास), रांची, झारखंड 834008',
    addressEnglish: 'Mittal Height, 1st Floor, Kanke Road (Near CMPDI Gate), Ranchi, Jharkhand 834008',
    landmarkHindi: 'सीएमपीडीआई गेट के पास, मित्तल हाइट, कांके रोड',
    googleMapsUrl: 'https://maps.google.com/?q=Gynocci+Mittal+Height+Kanke+Road+Ranchi',
    timings: 'सुबह 10:00 बजे से शाम 6:30 बजे तक (सोमवार से रविवार - सातों दिन खुला)',
    helpline: '+91 8450000845',
  },
  hisar: {
    city: 'Hisar',
    hindiCity: 'हिसार',
    aliases: ['hisar', 'हिसार', 'sector 14', 'haryana'],
    titleHindi: 'Gynocci Clinic - हिसार (सेक्टर 14)',
    addressHindi: 'DSS 234P, प्रथम तल, पॉकेट-ए, सेक्टर 14, हिसार, हरियाणा 125001',
    addressEnglish: 'DSS 234P, 1st Floor, Pocket-A, Sector 14, Hisar, Haryana 125001',
    landmarkHindi: 'पॉकेट-ए, सेक्टर 14',
    googleMapsUrl: 'https://maps.google.com/?q=Gynocci+Sector+14+Hisar',
    timings: 'सुबह 10:00 बजे से शाम 6:30 बजे तक (सोमवार से रविवार - सातों दिन खुला)',
    helpline: '+91 8450000845',
  },
  rewari: {
    city: 'Rewari',
    hindiCity: 'रेवाड़ी',
    aliases: ['rewari', 'रेवाड़ी', 'model town'],
    titleHindi: 'Gynocci Clinic - रेवाड़ी (मॉडल टाउन)',
    addressHindi: '112 L, मॉडल टाउन, रेवाड़ी, हरियाणा 123401',
    addressEnglish: '112 L, Model Town, Rewari, Haryana 123401',
    landmarkHindi: 'मॉडल टाउन',
    googleMapsUrl: 'https://maps.google.com/?q=Gynocci+Model+Town+Rewari',
    timings: 'सुबह 10:00 बजे से शाम 6:30 बजे तक (सोमवार से रविवार - सातों दिन खुला)',
    helpline: '+91 8450000845',
  },
}

export function findClinicByCity(cityName?: string | null): ClinicDetails | null {
  if (!cityName) return null
  const cleaned = cityName.trim().toLowerCase()
  if (GYNOCCI_CLINICS[cleaned]) {
    return GYNOCCI_CLINICS[cleaned]
  }
  for (const clinic of Object.values(GYNOCCI_CLINICS)) {
    if (
      clinic.city.toLowerCase() === cleaned ||
      clinic.hindiCity === cityName.trim() ||
      clinic.aliases.some((alias) => alias.toLowerCase() === cleaned)
    ) {
      return clinic
    }
  }
  // Substring check (e.g. "new delhi", "delhi ncr")
  for (const clinic of Object.values(GYNOCCI_CLINICS)) {
    if (
      cleaned.includes(clinic.city.toLowerCase()) ||
      clinic.aliases.some((alias) => cleaned.includes(alias.toLowerCase()))
    ) {
      return clinic
    }
  }
  return null
}

export function formatClinicCard(clinicKeyOrCity: string, isEnglish: boolean = false): string {
  const clinic = findClinicByCity(clinicKeyOrCity)
  if (!clinic) return ''

  if (isEnglish) {
    return (
      `🏥 **${clinic.city} Clinic (Gynocci Femtech)**\n` +
      `📍 **Address:** ${clinic.addressEnglish}\n` +
      `🗺️ **Google Maps Location:** ${clinic.googleMapsUrl}\n` +
      `⏰ **Timings:** 10:00 AM to 6:30 PM (Monday to Sunday - Open all 7 days)\n` +
      `📞 **Helpline:** ${clinic.helpline}\n\n` +
      `Would you like to visit our ${clinic.city} clinic for an in-person consultation with our senior doctor, or would you prefer an online video consultation?`
    )
  }

  return (
    `🏥 **${clinic.titleHindi}**\n` +
    `📍 **पता:** ${clinic.addressHindi}\n` +
    `🗺️ **Google Maps लोकेशन:** ${clinic.googleMapsUrl}\n` +
    `⏰ **समय:** ${clinic.timings}\n` +
    `📞 **हेल्पलाइन:** ${clinic.helpline}\n\n` +
    `क्या आप हमारे ${clinic.hindiCity} क्लीनिक में विज़िट करके सीनियर डॉक्टर से परामर्श लेना चाहेंगे या ऑनलाइन वीडियो परामर्श लेना चाहेंगे?`
  )
}

export function formatAllClinicsList(isEnglish: boolean = false): string {
  if (isEnglish) {
    return (
      'Gynocci physical clinics are currently available in these 9 cities across India:\n' +
      '1. Jaipur (Head Office)\n' +
      '2. New Delhi (Rajouri Garden)\n' +
      '3. Lucknow (Gomti Nagar)\n' +
      '4. Amritsar (Ranjit Avenue)\n' +
      '5. Ludhiana (Circuit House Road)\n' +
      '6. Patna (Kankarbagh)\n' +
      '7. Ranchi (Kanke Road)\n' +
      '8. Hisar (Sector 14)\n' +
      '9. Rewari (Model Town)\n\n' +
      'All clinics are open all 7 days from 10:00 AM to 6:30 PM.\n\n' +
      'Which city\'s clinic would you like to visit? Please let us know, and we will share the full address and Google Maps location.'
    )
  }

  return (
    'Gynocci के फिजिकल क्लीनिक पूरे भारत में इन 9 शहरों में उपलब्ध हैं:\n' +
    '1. जयपुर (Jaipur) - Head Office\n' +
    '2. नई दिल्ली (New Delhi - राजौरी गार्डन)\n' +
    '3. लखनऊ (Lucknow - गोमती नगर)\n' +
    '4. अमृतसर (Amritsar - रंजीत एवेन्यू)\n' +
    '5. लुधियाना (Ludhiana - सर्किट हाउस रोड)\n' +
    '6. पटना (Patna - कंकड़बाग)\n' +
    '7. रांची (Ranchi - कांके रोड)\n' +
    '8. हिसार (Hisar - सेक्टर 14)\n' +
    '9. रेवाड़ी (Rewari - मॉडल टाउन)\n\n' +
    'सभी क्लीनिक सातों दिन (सुबह 10:00 से शाम 6:30 बजे) खुले रहते हैं।\n\n' +
    'आप इनमें से किस शहर के क्लीनिक में विज़िट करना चाहते हैं? कृपया बताएं, ताकि हम आपको वहां के क्लीनिक का पूरा पता और Google Maps लोकेशन भेज सकें।'
  )
}

export function formatNoClinicCityMessage(city: string, isEnglish: boolean = false): string {
  if (isEnglish) {
    return (
      `Gynocci currently does not have a physical clinic in ${city}. However, you can consult with our senior expert doctor from the comfort of your home via a dedicated 45-minute Online Video Consultation. The doctor will review your reports in depth and provide complete Ayurvedic root-cause guidance.\n\n` +
      `Would you like me to book your online video consultation appointment?`
    )
  }

  return (
    `Gynocci का फिजिकल क्लीनिक अभी आपके शहर ${city} में उपलब्ध नहीं है। लेकिन आप घर बैठे हमारे सीनियर एक्सपर्ट डॉक्टर के साथ 45 मिनट की ऑनलाइन वीडियो कंसल्टेशन (Online Video Consultation) ले सकते हैं जिसमें डॉक्टर आपकी रिपोर्ट्स और समस्या को गहराई से समझकर संपूर्ण प्राकृतिक आयुर्वेदिक मार्गदर्शन प्रदान करेंगे।\n\n` +
    `क्या मैं आपका वीडियो कंसल्टेशन अपॉइंटमेंट बुक कर दूँ?`
  )
}
