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
  return formatLocationAndDoctorPitch(city, isEnglish)
}

export interface NearbyClinicMatch {
  clinic: ClinicDetails
  isExactCity: boolean
  patientCity: string
}

export const NEARBY_CLINIC_MAPPING: Record<string, string[]> = {
  delhi: [
    'noida', 'greater noida', 'ghaziabad', 'meerut', 'gurgaon', 'gurugram', 'faridabad',
    'sonipat', 'panipat', 'rohtak', 'karnal', 'muzaffarnagar', 'bulandshahr', 'hapur',
    'aligarh', 'mathura', 'moradabad', 'bareilly', 'ncr', 'delhi ncr', 'saharanpur',
    'shamli', 'baghpat', 'modinagar', 'dadri', 'palwal'
  ],
  jaipur: [
    'ajmer', 'sikar', 'alwar', 'dausa', 'tonk', 'kota', 'bhilwara', 'bikaner', 'jodhpur',
    'bharatpur', 'jhunjhunu', 'churu', 'sawai madhopur', 'nagaur', 'pali', 'udaipur',
    'rajasthan', 'kishangarh', 'beawar', 'sujangarh', 'chittorgarh', 'shahpura'
  ],
  rewari: [
    'bawal', 'dharuhera', 'narnaul', 'bhiwadi', 'neemrana', 'mahendragarh', 'manesar',
    'jhajjar', 'charkhi dadri', 'behror', 'kotputli', 'tijara', 'kosli', 'taoru', 'pataudi'
  ],
  hisar: [
    'sirsa', 'fatehabad', 'jind', 'bhiwani', 'hansi', 'tohana', 'narwana', 'kaithal',
    'barwala', 'mandi adampur', 'ellinabad', 'uchana'
  ],
  amritsar: [
    'tarn taran', 'gurdaspur', 'batala', 'pathankot', 'kapurthala', 'hoshiarpur',
    'firozpur', 'firozepur', 'fazilka', 'jammu', 'kathua'
  ],
  ludhiana: [
    'jalandhar', 'moga', 'khanna', 'phagwara', 'nawanshahr', 'fatehgarh sahib', 'patiala',
    'sangrur', 'barnala', 'bathinda', 'malerkotla', 'chandigarh', 'mohali', 'panchkula',
    'ambala', 'samrala', 'raikot', 'jagraon', 'mandi gobindgarh', 'sirhind'
  ],
  lucknow: [
    'kanpur', 'ayodhya', 'barabanki', 'unnao', 'rae bareli', 'sitapur', 'hardoi',
    'sultanpur', 'gonda', 'bahraich', 'prayagraj', 'allahabad', 'varanasi', 'gorakhpur',
    'jhansi', 'fatehpur', 'lakhimpur', 'amethi', 'faizabad', 'basti', 'azamgarh'
  ],
  patna: [
    'gaya', 'muzaffarpur', 'bhagalpur', 'darbhanga', 'bihar sharif', 'arrah', 'bhojpur',
    'chapra', 'saran', 'begusarai', 'samastipur', 'hajipur', 'vaishali', 'nalanda',
    'purnia', 'motihari', 'siwan', 'sasaram', 'buxar', 'madhubani'
  ],
  ranchi: [
    'jamshedpur', 'dhanbad', 'bokaro', 'hazaribagh', 'ramgarh', 'deoghar', 'giridih',
    'chaibasa', 'medininagar', 'daltonganj', 'purulia', 'rourkela', 'koderma', 'khunti',
    'lohardaga', 'gumla', 'simdega'
  ],
}

/**
 * Finds if a given patient city matches one of our 9 physical clinic cities directly,
 * or is in the immediate geographic proximity of one of our clinics.
 */
export function findNearbyClinic(cityName?: string | null): NearbyClinicMatch | null {
  if (!cityName) return null
  const cleaned = cityName.trim().toLowerCase()

  // 1. Direct match with official 9 clinic cities
  const direct = findClinicByCity(cityName)
  if (direct) {
    return {
      clinic: direct,
      isExactCity: true,
      patientCity: direct.city,
    }
  }

  // 2. Proximity check in nearby cities / regions
  for (const [clinicKey, nearbyList] of Object.entries(NEARBY_CLINIC_MAPPING)) {
    const isNearby = nearbyList.some(
      (nc) => cleaned === nc || cleaned.includes(nc) || nc.includes(cleaned),
    )
    if (isNearby) {
      const clinic = GYNOCCI_CLINICS[clinicKey]
      if (clinic) {
        return {
          clinic,
          isExactCity: false,
          patientCity: cityName.trim(),
        }
      }
    }
  }

  return null
}

/**
 * Formats a location acknowledgment that:
 * 1. Analyzes proximity to Gynocci's 9 clinics and highlights the nearest clinic (with Google Maps link).
 * 2. Contrasts in-person Nadi Parikshan with online Jeebha Parikshan + reports analysis.
 * 3. Highlights the Panel of 5 Senior Doctors deep study and discussion to establish deep patient trust.
 */
export function formatLocationAndDoctorPitch(cityName: string, isEnglish: boolean = false): string {
  const match = findNearbyClinic(cityName)

  if (isEnglish) {
    if (match?.isExactCity) {
      return (
        `🏥 **Gynocci Clinic - ${match.clinic.city}**\n` +
        `📍 Address: ${match.clinic.addressEnglish}\n` +
        `🗺️ Google Maps: ${match.clinic.googleMapsUrl}\n` +
        `⏰ Timings: 10:00 AM to 6:30 PM (All 7 Days Open)\n` +
        `---\n` +
        `🌿 **Consultation Options:**\n` +
        `• **Clinic Visit:** In-person **Nadi Parikshan (Pulse Examination)** by senior doctors to detect internal dosha imbalances without side-effects.\n` +
        `• **Online Video Consultation:** Dedicated 45-minute consultation including **Jeebha Parikshan (Tongue Examination)** and thorough review of all your previous medical reports.\n` +
        `• **5 Senior Doctors Panel:** Our dedicated board of 5 senior doctors deeply studies your case together before consultation so you get complete, unhurried guidance!\n` +
        `---\n` +
        `Would you like to book a Clinic Visit at ${match.clinic.city} or an Online Video Consultation?`
      )
    }

    if (match && !match.isExactCity) {
      return (
        `Nearest to your location (${match.patientCity}), our **${match.clinic.city} Clinic** is available:\n` +
        `📍 Address: ${match.clinic.addressEnglish}\n` +
        `🗺️ Google Maps: ${match.clinic.googleMapsUrl}\n` +
        `---\n` +
        `• If you wish to visit the clinic, you can come to our ${match.clinic.city} clinic for in-person **Nadi Parikshan (Pulse Examination)**.\n` +
        `• You can also take a detailed 45-minute **Online Video Consultation** from home where doctors perform **Jeebha Parikshan (Tongue Examination)** and report analysis.\n` +
        `• Our panel of 5 Senior Doctors reviews your case history so that your doubts are completely addressed.\n` +
        `---\n` +
        `Which option would you prefer: a Clinic Visit at ${match.clinic.city} or an Online Video Consultation?`
      )
    }

    return (
      `Gynocci currently does not have a physical clinic in ${cityName}. However, you can consult our senior doctors from the comfort of home via a dedicated 45-minute **Online Video Consultation**!\n` +
      `---\n` +
      `Our doctors perform **Jeebha Parikshan (Tongue Examination)**, facial analysis, and an extensive review of all your prior reports. Furthermore, our panel of 5 Senior Doctors deeply studies your case together.\n` +
      `---\n` +
      `Shall I book your Online Video Consultation appointment?`
    )
  }

  // Hindi (Default)
  if (match?.isExactCity) {
    return (
      `🏥 **${match.clinic.titleHindi}**\n` +
      `📍 पता: ${match.clinic.addressHindi}\n` +
      `🗺️ Google Maps: ${match.clinic.googleMapsUrl}\n` +
      `⏰ समय: ${match.clinic.timings}\n` +
      `---\n` +
      `🌿 **डॉक्टर परामर्श के दो बेहतरीन विकल्प:**\n` +
      `1. **क्लिनिक विज़िट (Clinic Visit):** क्लिनिक पर हमारे वरिष्ठ डॉक्टर्स आपका **नाड़ी परीक्षण (Nadi Parikshan)** करके शरीर के अंदरूनी दोषों (वात, पित्त, कफ) को समझते हैं और बिना किसी साइड-इफेक्ट के समस्या को जड़ (root cause) से ठीक करने की दिशा में कार्य करते हैं।\n` +
      `2. **ऑनलाइन वीडियो कंसल्टेशन:** यदि आप क्लिनिक नहीं आ सकते, तो घर बैठे 45 मिनट के वीडियो सत्र में डॉक्टर्स **जिह्वा परीक्षण (Jeebha Parikshan)** और आपकी पुरानी रिपोर्ट्स का गहराई से विश्लेषण करते हैं।\n` +
      `---\n` +
      `✨ सबसे खास बात: हमारी **5 सीनियर डॉक्टर्स की विशेषज्ञ पैनल टीम** आपकी केस हिस्ट्री का गहराई से अध्ययन करती है ताकि आपका कोई भी संदेह अधूरा न रहे और आप तसल्ली से अपनी समस्या समझ सकें।\n` +
      `क्या आप हमारे ${match.clinic.hindiCity} क्लीनिक में विज़िट करना चाहेंगे या घर बैठे ऑनलाइन वीडियो कंसल्टेशन लेना चाहेंगे?`
    )
  }

  if (match && !match.isExactCity) {
    return (
      `आपकी बताई लोकेशन **${match.patientCity}** के सबसे नजदीक हमारी **${match.clinic.titleHindi}** मौजूद है:\n` +
      `📍 पता: ${match.clinic.addressHindi}\n` +
      `🗺️ Google Maps: ${match.clinic.googleMapsUrl}\n` +
      `---\n` +
      `• **क्लिनिक विज़िट:** यदि आप क्लिनिक आना चाहें, तो आप ${match.clinic.hindiCity} क्लीनिक आ सकते हैं, जहाँ डॉक्टर्स आपका **नाड़ी परीक्षण (Nadi Parikshan)** करके समस्या को जड़ (root cause) से समझने का कार्य करेंगे।\n` +
      `• **ऑनलाइन वीडियो कंसल्टेशन:** या फिर आप घर बैठे ही हमारे सीनियर डॉक्टर्स के साथ 45 मिनट का विस्तृत वीडियो कंसल्टेशन ले सकते हैं, जिसमें डॉक्टर्स **जिह्वा परीक्षण (Jeebha Parikshan)** और आपकी पिछली रिपोर्ट्स का विश्लेषण करेंगे।\n` +
      `---\n` +
      `हमारी **5 सीनियर डॉक्टर्स की पैनल टीम** आपकी पूरी समस्या को गहराई से समझकर समाधान तैयार करती है। आप इनमें से किस विकल्प से अपॉइंटमेंट लेना पसंद करेंगे?`
    )
  }

  return (
    `चूंकि आपकी लोकेशन **${cityName}** में अभी हमारी कोई नजदीकी फिजिकल क्लीनिक नहीं है, इसलिए आप घर बैठे हमारे सीनियर डॉक्टर्स के साथ 45 मिनट का विस्तृत **ऑनलाइन वीडियो कंसल्टेशन (Online Video Consultation)** ले सकते हैं।\n` +
    `---\n` +
    `वीडियो कंसल्टेशन में डॉक्टर्स **जिह्वा परीक्षण (Jeebha Parikshan)** और आपकी पुरानी सभी रिपोर्ट्स का विस्तृत अध्ययन करते हैं। साथ ही हमारी **5 सीनियर डॉक्टर्स की पैनल टीम** मिलकर आपकी समस्या का जड़ से समाधान तय करती है।\n` +
    `---\n` +
    `क्या मैं आपका ऑनलाइन वीडियो कंसल्टेशन अपॉइंटमेंट दर्ज कर दूँ?`
  )
}
