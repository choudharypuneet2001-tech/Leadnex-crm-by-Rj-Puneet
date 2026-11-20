import { isLikelyFemaleName } from '@/lib/ai/query';
import { DEFAULT_CLINICS } from '@/lib/clinics/clinics-service';
import { analyzeLeadIntent } from './lead-intent-analyzer';
import type {
  AdPerformanceItem,
  AiAdCreativeHook,
  AiAdRecommendation,
  AnalyticsDateRangePreset,
  AnalyticsLeadItem,
  AnalyticsSummary,
  CityPerformanceItem,
  DateRangeFilter,
  GenderStats,
  HealthConcernItem,
} from './types';
import type { Booking, Contact } from '@/types';

// Clinical disease taxonomy for Gynocci Femtech
export interface HealthCategoryDef {
  category: string;
  label_hi: string;
  color: string;
  keywords: string[];
}

export const HEALTH_CATEGORIES: HealthCategoryDef[] = [
  {
    category: 'Tubal Blockage',
    label_hi: 'फेलोपियन ट्यूब ब्लॉकेज',
    color: '#8b5cf6', // Violet
    keywords: [
      'tube',
      'tubal',
      'blockage',
      'block',
      'hsg',
      'ट्यूब',
      'फेलोपियन',
      'बंद',
      'dono tube',
      'tubal block',
    ],
  },
  {
    category: 'PCOD / PCOS & Periods',
    label_hi: 'PCOD / अनियमित माहवारी',
    color: '#ec4899', // Pink
    keywords: [
      'pcod',
      'pcos',
      'period',
      'periods',
      'irregular',
      'माहवारी',
      'मासिक',
      'अनियमित',
      'ovary',
      'hormonal',
      'delay',
    ],
  },
  {
    category: 'Infertility & Conceiving',
    label_hi: 'गर्भधारण में समस्या / संतान प्राप्ति',
    color: '#f59e0b', // Amber
    keywords: [
      'conceive',
      'pregnant',
      'pregnancy',
      'bacche',
      'bache',
      'संतान',
      'गर्भधारण',
      'औलाद',
      'baby',
      'infertility',
      'बांझपन',
      'child',
      'planning',
    ],
  },
  {
    category: 'Low AMH & Egg Reserve',
    label_hi: 'लो AMH एवं अंडों की कमी',
    color: '#3b82f6', // Blue
    keywords: [
      'amh',
      'egg',
      'egg count',
      'poor reserve',
      'follicle',
      'अंडे',
      'अंडा',
      'कम amh',
      'low amh',
    ],
  },
  {
    category: 'Male Infertility & Low Sperm',
    label_hi: 'पुरुष शुक्राणु / इनफर्टिलिटी',
    color: '#06b6d4', // Cyan
    keywords: [
      'sperm',
      'semen',
      'motility',
      'shukranu',
      'शुक्राणु',
      'male',
      'azoospermia',
      'oligospermia',
      'count kam',
    ],
  },
  {
    category: 'White Discharge & Weakness',
    label_hi: 'सफेद पानी / ल्यूकोरिया',
    color: '#10b981', // Emerald
    keywords: [
      'white discharge',
      'safed pani',
      'likoria',
      'leucorrhea',
      'सफेद पानी',
      'ल्यूकोरिया',
      'कमजोरी',
      'discharge',
      'infection',
      'खुजली',
    ],
  },
  {
    category: 'Recurrent Miscarriage',
    label_hi: 'बार-बार गर्भपात / मिसकैरेज',
    color: '#ef4444', // Red
    keywords: [
      'miscarriage',
      'abortion',
      'dnc',
      'गर्भपात',
      'धड़कन',
      'mishap',
      'missed',
      'd&c',
    ],
  },
  {
    category: 'Fibroids & Ovarian Cysts',
    label_hi: 'रसौली एवं सिस्ट (Fibroids / Cysts)',
    color: '#f97316', // Orange
    keywords: [
      'cyst',
      'fibroid',
      'rasoli',
      'रसौली',
      'गांठ',
      'endometriosis',
      'adenomyosis',
      'polyp',
    ],
  },
];

export const GENERAL_CONCERN_CATEGORY = {
  category: 'General Gynaecological Care',
  label_hi: 'सामान्य परामर्श (General Care)',
  color: '#64748b', // Slate
};

/**
 * Classifies an incoming text or concern into a standardized health category.
 */
export function classifyHealthConcern(text?: string | null): {
  category: string;
  label_hi: string;
  color: string;
} {
  if (!text) return GENERAL_CONCERN_CATEGORY;
  const lower = text.toLowerCase();

  for (const cat of HEALTH_CATEGORIES) {
    for (const kw of cat.keywords) {
      if (lower.includes(kw)) {
        return {
          category: cat.category,
          label_hi: cat.label_hi,
          color: cat.color,
        };
      }
    }
  }

  return GENERAL_CONCERN_CATEGORY;
}

const KNOWN_MALE_TOKENS = new Set([
  'kumar',
  'singh',
  'sharma',
  'verma',
  'patel',
  'yadav',
  'ali',
  'khan',
  'bhai',
  'husband',
  'mr',
  'puneet',
  'rajesh',
  'rahul',
  'amit',
  'deepak',
  'ravi',
  'vikram',
  'suresh',
  'ramesh',
  'manoj',
  'sunil',
  'anil',
  'sanjay',
  'vijay',
  'ajay',
  'mohammad',
  'abaan',
  'sonu',
]);

/**
 * Detects whether a lead is female or male based on Indian names.
 */
export function detectLeadGender(name?: string | null): 'female' | 'male' | 'unknown' {
  if (!name || !name.trim()) return 'unknown';
  const clean = name.trim().toLowerCase();

  // If starts with female honorifics
  if (
    clean.startsWith('mrs') ||
    clean.startsWith('ms') ||
    clean.startsWith('smt') ||
    clean.startsWith('mrs.') ||
    clean.startsWith('smt.')
  ) {
    return 'female';
  }

  // If starts with male honorifics
  if (clean.startsWith('mr') || clean.startsWith('mr.') || clean.startsWith('shri')) {
    return 'male';
  }

  const parts = clean.split(/[\s,.-]+/);
  const firstName = parts[0];

  if (isLikelyFemaleName(firstName)) {
    return 'female';
  }

  // Check male tokens
  if (KNOWN_MALE_TOKENS.has(firstName)) {
    return 'male';
  }

  for (const p of parts) {
    if (KNOWN_MALE_TOKENS.has(p)) {
      return 'male';
    }
  }

  // Feminine phonetic suffixes common in Hindi/Indian names
  if (/(a|i|ee|ya|ka|na|ti|vi|ta|shi|ni)$/.test(firstName)) {
    return 'female';
  }

  return 'male';
}

/**
 * Resolves Date Range Filter into ISO start & end bounds.
 * Defaults to Indian Standard Time (IST, UTC+5:30) for daily calendar alignment.
 */
export function resolveDateRange(filter: DateRangeFilter): {
  from: Date | null;
  to: Date | null;
  label: string;
} {
  // 1. If explicit ISO bounds provided (e.g. from client browser)
  if (filter.from || filter.to) {
    const from = filter.from ? new Date(filter.from) : null;
    const to = filter.to ? new Date(filter.to) : new Date();
    const labelMap: Record<string, string> = {
      today: 'Today',
      yesterday: 'Yesterday',
      '7d': 'Last 7 Days',
      '30d': 'Last 30 Days',
      this_month: 'This Month',
      all: 'All Time',
    };
    return {
      from,
      to,
      label: labelMap[filter.preset] || 'Custom Range',
    };
  }

  // 2. IST (UTC+5:30) Calendar Day bounds
  const nowMs = Date.now();
  const istOffsetMs = 5.5 * 60 * 60 * 1000;

  switch (filter.preset) {
    case 'today': {
      const istDate = new Date(nowMs + istOffsetMs);
      const y = istDate.getUTCFullYear();
      const m = istDate.getUTCMonth();
      const d = istDate.getUTCDate();
      const from = new Date(Date.UTC(y, m, d, 0, 0, 0, 0) - istOffsetMs);
      const to = new Date(Date.UTC(y, m, d, 23, 59, 59, 999) - istOffsetMs);
      return { from, to, label: 'Today' };
    }
    case 'yesterday': {
      const istDate = new Date(nowMs + istOffsetMs - 24 * 60 * 60 * 1000);
      const y = istDate.getUTCFullYear();
      const m = istDate.getUTCMonth();
      const d = istDate.getUTCDate();
      const from = new Date(Date.UTC(y, m, d, 0, 0, 0, 0) - istOffsetMs);
      const to = new Date(Date.UTC(y, m, d, 23, 59, 59, 999) - istOffsetMs);
      return { from, to, label: 'Yesterday' };
    }
    case '7d': {
      const from = new Date(nowMs - 7 * 24 * 60 * 60 * 1000);
      return { from, to: new Date(nowMs), label: 'Last 7 Days' };
    }
    case '30d': {
      const from = new Date(nowMs - 30 * 24 * 60 * 60 * 1000);
      return { from, to: new Date(nowMs), label: 'Last 30 Days' };
    }
    case 'this_month': {
      const istDate = new Date(nowMs + istOffsetMs);
      const y = istDate.getUTCFullYear();
      const m = istDate.getUTCMonth();
      const from = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0) - istOffsetMs);
      return { from, to: new Date(nowMs), label: 'This Month' };
    }
    case 'all':
    default:
      return { from: null, to: null, label: 'All Time' };
  }
}

/**
 * Checks if a city has an active Gynocci clinic nearby.
 */
export function checkNearbyClinic(city?: string | null): {
  hasClinic: boolean;
  clinicName?: string;
} {
  if (!city || !city.trim()) return { hasClinic: false };
  const normalized = city.trim().toLowerCase();

  for (const clinic of DEFAULT_CLINICS) {
    if (!clinic.is_active) continue;
    const cCity = clinic.city.toLowerCase();
    const cName = clinic.name.toLowerCase();

    if (
      normalized.includes(cCity) ||
      cCity.includes(normalized) ||
      cName.includes(normalized)
    ) {
      return { hasClinic: true, clinicName: clinic.name };
    }
  }

  // Proximity aliases
  if (['noida', 'gurgaon', 'gurugram', 'faridabad', 'ghaziabad'].some((c) => normalized.includes(c))) {
    return { hasClinic: true, clinicName: 'Delhi (Rajouri Garden)' };
  }
  if (['mohali', 'panchkula'].some((c) => normalized.includes(c))) {
    return { hasClinic: true, clinicName: 'Chandigarh (Sector 35-C)' };
  }

  return { hasClinic: false };
}

/**
 * Core computation engine for Analytics.
 */
export function computeAnalytics(
  contacts: Contact[],
  bookings: Booking[],
  filter: DateRangeFilter,
  selectedAdFilter?: string | null,
  conversations?: {
    id: string;
    contact_id: string;
    created_at?: string;
    last_message_text?: string | null;
    last_message_at?: string | null;
  }[]
): AnalyticsSummary {
  const { from, to, label: date_range_label } = resolveDateRange(filter);

  // Map conversations by contact_id first so we can track first message date & time
  const convByContactId = new Map<
    string,
    {
      id: string;
      contact_id: string;
      created_at?: string;
      last_message_text?: string | null;
      last_message_at?: string | null;
    }
  >();
  if (conversations) {
    for (const conv of conversations) {
      if (conv.contact_id) {
        convByContactId.set(conv.contact_id, conv);
      }
    }
  }

  // Determine exact timestamp when lead first initiated contact / messaged
  const getLeadFirstMessageAt = (c: Contact): string => {
    const conv = convByContactId.get(c.id);
    if (conv?.created_at && c.created_at) {
      return new Date(conv.created_at) < new Date(c.created_at) ? conv.created_at : c.created_at;
    }
    return conv?.created_at || c.created_at;
  };

  // 1. Filter contacts & bookings by Date Range
  const isWithinRange = (dateStr: string) => {
    const d = new Date(dateStr);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  };

  const filteredContacts = contacts.filter((c) => isWithinRange(getLeadFirstMessageAt(c)));
  const filteredBookings = bookings.filter((b) => isWithinRange(b.created_at));

  // Map bookings by contact_id and by normalized phone
  const bookingByContactId = new Map<string, Booking>();
  const bookingByPhone = new Map<string, Booking>();

  // Also build all-time bookings map for cross-checking if contact booked later
  for (const b of bookings) {
    if (b.contact_id) bookingByContactId.set(b.contact_id, b);
    const digits = b.phone.replace(/\D/g, '');
    if (digits.length >= 10) {
      bookingByPhone.set(digits.slice(-10), b);
    }
  }

  // 2. Synthesize all leads in this date range
  // A lead is an inbound contact (or a booking if created directly)
  const leadsMap = new Map<string, AnalyticsLeadItem>();

  for (const c of filteredContacts) {
    const digits = c.phone.replace(/\D/g, '');
    const last10 = digits.length >= 10 ? digits.slice(-10) : digits;
    const matchingBooking = bookingByContactId.get(c.id) || (last10 ? bookingByPhone.get(last10) : undefined);
    const conv = convByContactId.get(c.id);

    const cAny = c as unknown as Record<string, unknown>;
    const effectiveName =
      c.name ||
      [cAny.first_name, cAny.last_name].filter(Boolean).join(' ') ||
      matchingBooking?.patient_name ||
      'Anonymous Lead';
    const effectiveCity = c.city || matchingBooking?.city || null;
    const effectiveAdName = c.ad_name || matchingBooking?.ad_name || null;
    const effectiveAdId = c.ad_id || matchingBooking?.ad_id || null;
    const effectiveConcern = matchingBooking?.health_concern || c.ad_body || c.ad_name || null;
    const classified = classifyHealthConcern(effectiveConcern);
    const gender = detectLeadGender(effectiveName);

    const ai_analysis = analyzeLeadIntent({
      name: effectiveName,
      phone: c.phone,
      city: effectiveCity,
      healthConcern: matchingBooking?.health_concern || c.ad_body || null,
      concernCategory: classified.category,
      adName: effectiveAdName,
      adBody: c.ad_body,
      hasBooking: !!matchingBooking,
      bookingStatus: matchingBooking?.status,
      lastMessageText: conv?.last_message_text || matchingBooking?.notes || null,
    });

    const firstMessageAt = getLeadFirstMessageAt(c);

    leadsMap.set(c.id, {
      id: c.id,
      created_at: firstMessageAt,
      first_message_at: firstMessageAt,
      name: effectiveName,
      phone: c.phone,
      city: effectiveCity,
      gender,
      ad_name: effectiveAdName,
      ad_id: effectiveAdId,
      health_concern: matchingBooking?.health_concern || null,
      concern_category: classified.category,
      has_booking: !!matchingBooking,
      booking_id: matchingBooking?.id || null,
      booking_query_id: matchingBooking?.booking_query_id || null,
      booking_status: matchingBooking?.status || null,
      consultation_type: matchingBooking?.consultation_type || null,
      clinic_location: matchingBooking?.clinic_location || null,
      conversation_id: conv?.id || matchingBooking?.conversation_id || null,
      notes: matchingBooking?.notes || null,
      ai_analysis,
    });
  }

  // If there are bookings in this range whose contact wasn't already included
  for (const b of filteredBookings) {
    if (b.contact_id && leadsMap.has(b.contact_id)) continue;

    const digits = b.phone.replace(/\D/g, '');
    const last10 = digits.length >= 10 ? digits.slice(-10) : digits;
    const existing = Array.from(leadsMap.values()).find((l) => {
      const lDigits = l.phone.replace(/\D/g, '');
      return lDigits.slice(-10) === last10;
    });

    if (existing) {
      existing.has_booking = true;
      existing.booking_id = b.id;
      existing.booking_query_id = b.booking_query_id;
      existing.booking_status = b.status;
      existing.consultation_type = b.consultation_type || null;
      existing.clinic_location = b.clinic_location || null;
      if (b.health_concern) {
        existing.health_concern = b.health_concern;
        existing.concern_category = classifyHealthConcern(b.health_concern).category;
      }
      existing.ai_analysis = analyzeLeadIntent({
        name: existing.name,
        phone: existing.phone,
        city: existing.city,
        healthConcern: existing.health_concern,
        concernCategory: existing.concern_category,
        adName: existing.ad_name,
        hasBooking: true,
        bookingStatus: b.status,
      });
    } else {
      const classified = classifyHealthConcern(b.health_concern || b.ad_name);
      const gender = detectLeadGender(b.patient_name);
      const ai_analysis = analyzeLeadIntent({
        name: b.patient_name,
        phone: b.phone,
        city: b.city,
        healthConcern: b.health_concern,
        concernCategory: classified.category,
        adName: b.ad_name,
        hasBooking: true,
        bookingStatus: b.status,
      });

      leadsMap.set(b.id, {
        id: b.id,
        created_at: b.created_at,
        first_message_at: b.created_at,
        name: b.patient_name,
        phone: b.phone,
        city: b.city || null,
        gender,
        ad_name: b.ad_name || null,
        ad_id: b.ad_id || null,
        health_concern: b.health_concern || null,
        concern_category: classified.category,
        has_booking: true,
        booking_id: b.id,
        booking_query_id: b.booking_query_id,
        booking_status: b.status,
        consultation_type: b.consultation_type || null,
        clinic_location: b.clinic_location || null,
        conversation_id: b.conversation_id || null,
        notes: b.notes || null,
        ai_analysis,
      });
    }
  }

  let allLeads = Array.from(leadsMap.values()).sort((a, b) => {
    const timeA = new Date(a.first_message_at || a.created_at).getTime();
    const timeB = new Date(b.first_message_at || b.created_at).getTime();
    return timeB - timeA;
  });

  // Optional Ad filter
  if (selectedAdFilter && selectedAdFilter !== 'all') {
    allLeads = allLeads.filter(
      (l) => l.ad_name === selectedAdFilter || l.ad_id === selectedAdFilter
    );
  }

  const total_leads = allLeads.length;
  const bookedLeads = allLeads.filter((l) => l.has_booking);
  const total_bookings = bookedLeads.length;
  const conversion_rate = total_leads > 0 ? Math.round((total_bookings / total_leads) * 1000) / 10 : 0;

  const clinic_visits = bookedLeads.filter((l) => l.consultation_type === 'clinic_visit').length;
  const video_consultations = bookedLeads.filter((l) => l.consultation_type !== 'clinic_visit').length;

  const meta_ad_leads = allLeads.filter((l) => Boolean(l.ad_name || l.ad_id)).length;
  const organic_leads = total_leads - meta_ad_leads;

  // 3. Ad Performance aggregation
  const adGroups = new Map<
    string,
    {
      ad_name: string;
      ad_id: string | null;
      leads_count: number;
      bookings_count: number;
      concerns: Record<string, number>;
      cities: Record<string, number>;
      clinic_visits: number;
      video_consultations: number;
    }
  >();

  for (const lead of allLeads) {
    const rawAdName = lead.ad_name?.trim();
    const adKey = rawAdName || (lead.ad_id ? `Ad ID: ${lead.ad_id}` : 'Direct / Organic WhatsApp');

    if (!adGroups.has(adKey)) {
      adGroups.set(adKey, {
        ad_name: rawAdName || (lead.ad_id ? `Meta Ad #${lead.ad_id}` : 'Direct / Organic WhatsApp'),
        ad_id: lead.ad_id,
        leads_count: 0,
        bookings_count: 0,
        concerns: {},
        cities: {},
        clinic_visits: 0,
        video_consultations: 0,
      });
    }

    const group = adGroups.get(adKey)!;
    group.leads_count++;

    if (lead.has_booking) {
      group.bookings_count++;
      if (lead.consultation_type === 'clinic_visit') {
        group.clinic_visits++;
      } else {
        group.video_consultations++;
      }
    }

    // Tally concerns
    const cCat = lead.concern_category || 'General';
    group.concerns[cCat] = (group.concerns[cCat] || 0) + 1;

    // Tally cities
    if (lead.city) {
      group.cities[lead.city] = (group.cities[lead.city] || 0) + 1;
    }
  }

  const ad_performance: AdPerformanceItem[] = Array.from(adGroups.values())
    .map((g) => {
      // Top concern
      let topConcern = 'General Care';
      let maxC = 0;
      for (const [k, v] of Object.entries(g.concerns)) {
        if (v > maxC) {
          maxC = v;
          topConcern = k;
        }
      }

      // Top city
      let topCity = 'Multiple Cities';
      let maxCityC = 0;
      for (const [k, v] of Object.entries(g.cities)) {
        if (v > maxCityC) {
          maxCityC = v;
          topCity = k;
        }
      }

      const conv = g.leads_count > 0 ? Math.round((g.bookings_count / g.leads_count) * 1000) / 10 : 0;

      return {
        ad_name: g.ad_name,
        ad_id: g.ad_id,
        leads_count: g.leads_count,
        bookings_count: g.bookings_count,
        conversion_rate: conv,
        top_concern: topConcern,
        top_city: topCity,
        clinic_visits: g.clinic_visits,
        video_consultations: g.video_consultations,
      };
    })
    .sort((a, b) => b.leads_count - a.leads_count);

  // 4. Disease / Health Concerns breakdown
  const concernCounts = new Map<
    string,
    { count: number; bookings_count: number; label_hi: string; color: string }
  >();

  for (const cat of HEALTH_CATEGORIES) {
    concernCounts.set(cat.category, {
      count: 0,
      bookings_count: 0,
      label_hi: cat.label_hi,
      color: cat.color,
    });
  }
  concernCounts.set(GENERAL_CONCERN_CATEGORY.category, {
    count: 0,
    bookings_count: 0,
    label_hi: GENERAL_CONCERN_CATEGORY.label_hi,
    color: GENERAL_CONCERN_CATEGORY.color,
  });

  for (const lead of allLeads) {
    const entry = concernCounts.get(lead.concern_category) || concernCounts.get(GENERAL_CONCERN_CATEGORY.category)!;
    entry.count++;
    if (lead.has_booking) {
      entry.bookings_count++;
    }
  }

  const health_concerns: HealthConcernItem[] = Array.from(concernCounts.entries())
    .map(([category, data]) => {
      const percentage = total_leads > 0 ? Math.round((data.count / total_leads) * 1000) / 10 : 0;
      const conv = data.count > 0 ? Math.round((data.bookings_count / data.count) * 1000) / 10 : 0;
      return {
        category,
        label_hi: data.label_hi,
        count: data.count,
        percentage,
        bookings_count: data.bookings_count,
        conversion_rate: conv,
        color: data.color,
      };
    })
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);

  // 5. Gender Ratio stats
  let female_count = 0;
  let male_count = 0;
  let unknown_count = 0;

  for (const lead of allLeads) {
    if (lead.gender === 'female') female_count++;
    else if (lead.gender === 'male') male_count++;
    else unknown_count++;
  }

  const gender_total = total_leads || 1;
  const gender_stats: GenderStats = {
    female_count,
    female_percentage: Math.round((female_count / gender_total) * 1000) / 10,
    male_count,
    male_percentage: Math.round((male_count / gender_total) * 1000) / 10,
    unknown_count,
    total: total_leads,
  };

  // 6. Top Cities breakdown
  const cityGroups = new Map<
    string,
    {
      city: string;
      leads_count: number;
      bookings_count: number;
      clinic_visits: number;
      video_consultations: number;
    }
  >();

  for (const lead of allLeads) {
    const c = lead.city?.trim() || 'Unspecified City';
    if (!cityGroups.has(c)) {
      cityGroups.set(c, {
        city: c,
        leads_count: 0,
        bookings_count: 0,
        clinic_visits: 0,
        video_consultations: 0,
      });
    }

    const cg = cityGroups.get(c)!;
    cg.leads_count++;
    if (lead.has_booking) {
      cg.bookings_count++;
      if (lead.consultation_type === 'clinic_visit') {
        cg.clinic_visits++;
      } else {
        cg.video_consultations++;
      }
    }
  }

  const top_cities: CityPerformanceItem[] = Array.from(cityGroups.values())
    .map((cg) => {
      const conv = cg.leads_count > 0 ? Math.round((cg.bookings_count / cg.leads_count) * 1000) / 10 : 0;
      const clinicCheck = checkNearbyClinic(cg.city);
      return {
        city: cg.city,
        leads_count: cg.leads_count,
        bookings_count: cg.bookings_count,
        conversion_rate: conv,
        clinic_visits: cg.clinic_visits,
        video_consultations: cg.video_consultations,
        has_clinic: clinicCheck.hasClinic,
        clinic_name: clinicCheck.clinicName,
      };
    })
    .sort((a, b) => b.leads_count - a.leads_count);

  // 7. AI Ad Campaign Recommendations Engine
  const ai_recommendations = generateAiAdRecommendations(
    health_concerns,
    top_cities,
    ad_performance,
    conversion_rate
  );

  const ready_to_convert_count = allLeads.filter(
    (l) => l.ai_analysis?.intent_stage === 'ready_to_convert'
  ).length;
  const fees_hesitation_count = allLeads.filter(
    (l) => l.ai_analysis?.intent_stage === 'fees_hesitation'
  ).length;
  const clinic_opportunity_count = allLeads.filter(
    (l) => l.ai_analysis?.intent_stage === 'clinic_opportunity'
  ).length;
  const awareness_only_count = allLeads.filter(
    (l) => l.ai_analysis?.intent_stage === 'awareness_only'
  ).length;

  return {
    total_leads,
    total_bookings,
    conversion_rate,
    clinic_visits,
    video_consultations,
    meta_ad_leads,
    organic_leads,
    ready_to_convert_count,
    fees_hesitation_count,
    clinic_opportunity_count,
    awareness_only_count,
    ad_performance,
    health_concerns,
    gender_stats,
    top_cities,
    ai_recommendations,
    leads: allLeads,
    date_range_label,
  };
}

/**
 * Generates tailored marketing intelligence and recommended Hindi Meta Ad hooks.
 */
export function generateAiAdRecommendations(
  concerns: HealthConcernItem[],
  topCities: CityPerformanceItem[],
  adPerformance: AdPerformanceItem[],
  overallConversionRate: number
): AiAdRecommendation {
  // Find highest converting condition with at least some inquiry volume
  const sortedByConv = [...concerns].sort((a, b) => b.conversion_rate - a.conversion_rate);
  const winning = sortedByConv[0] || {
    category: 'Tubal Blockage',
    conversion_rate: 42,
    label_hi: 'फेलोपियन ट्यूब ब्लॉकेज',
  };

  const highIntentCities = topCities
    .filter((c) => c.city !== 'Unspecified City')
    .slice(0, 5)
    .map((c) => c.city);

  const creative_hooks: AiAdCreativeHook[] = [
    {
      title: 'Hook 1: 5-Senior Doctors Panel Trust (High Intent & Tubal Blockage)',
      angle: 'इमोशनल कनेक्ट + 5 सीनियर डॉक्टर्स की डीप केस स्टडी + बिना सर्जरी आयुर्वेदिक समाधान',
      hook_hindi: 'क्या फेलोपियन ट्यूब ब्लॉकेज या PCOD के कारण गर्भधारण में रुकावट आ रही है?',
      body_hindi:
        'घबराइए नहीं, गायनोकी (Gynocci) के 5 सीनियर आयुर्वेदिक डॉक्टर्स का पैनल आपकी पुरानी रिपोर्ट्स और समस्या पर आपस में डीप स्टडी करता है। हमारे 9 क्लीनिक्स पर नाड़ी परीक्षण द्वारा या घर बैठे विस्तृत वीडियो कंसल्टेशन से जानें कि आपकी समस्या जड़ से कैसे ठीक हो सकती है।',
      recommended_cta: 'व्हाट्सएप पर अपनी रिपोर्ट भेजें और 5 सीनियर डॉक्टर्स से परामर्श लें',
      target_audience: 'महिलाएं (22-42 वर्ष), मैरिड कपल्स, इनफर्टिलिटी व कंसीविंग रिसर्च कर रहे लोग',
    },
    {
      title: 'Hook 2: 9 Clinics Nadi Parikshan & Zero Online Advance Fee',
      angle: 'क्लीनिक विज़िट ट्रस्ट + नाड़ी परीक्षण + क्लीनिक पर ही फीस देने की सुविधा',
      hook_hindi: 'बिना सर्जरी, बिना साइड इफेक्ट्स — जानिए शरीर का रूट कॉज नाड़ी परीक्षण से!',
      body_hindi:
        'जयपुर, दिल्ली, लखनऊ, अमृतसर, लुधियाना, चंडीगढ़, इंदौर, पटना और रेवाड़ी के गायनोकी क्लीनिक्स में नाड़ी परीक्षण करवाएं। क्लीनिक विज़िट के लिए ऑनलाइन कोई एडवांस फीस नहीं देनी है, क्लीनिक पहुंचकर ही फीस जमा करें। 5 सीनियर डॉक्टर्स की टीम से पाएं सच्चा समाधान।',
      recommended_cta: 'अपने नजदीकी गायनोकी क्लीनिक पर अपॉइंटमेंट स्लॉट बुक करें',
      target_audience: 'क्लीनिक शहरों (जयपुर, दिल्ली, लखनऊ, पंजाब, हरियाणा, बिहार, एमपी) के 25km दायरे में',
    },
    {
      title: 'Hook 3: Home Video Consultation & Jeebha Parikshan Offer',
      angle: 'घर बैठे सुविधा + जीभ परीक्षण + लाइफटाइम सपोर्ट रजिस्ट्रेशन ऑफर (₹499)',
      hook_hindi: 'घर बैठे पाएं 5 सीनियर गायनेकोलॉजी डॉक्टर्स का स्पेशल वीडियो कंसल्टेशन!',
      body_hindi:
        'अगर आप क्लीनिक नहीं आ सकते तो घर बैठे वीडियो कॉल पर हमारे सीनियर डॉक्टर्स से जीभ परीक्षण (Jeebha Parikshan) और पुरानी रिपोर्ट्स की विस्तृत चर्चा करें। स्पेशल ऑफर के तहत ₹499 में लाइफटाइम कंसल्टेशन की सुविधा — जब तक आपका इलाज चलेगा, डॉक्टर्स आपके साथ रहेंगे।',
      recommended_cta: 'व्हाट्सएप पर चैट शुरू करें और आज ही वीडियो अपॉइंटमेंट बुक करें',
      target_audience: 'ऑल इंडिया टियर-2 और टियर-3 शहर जहां क्लीनिक नहीं है',
    },
  ];

  const budget_advice =
    concerns.length > 0 && winning.count > 0
      ? `डेटा विश्लेषण के अनुसार "${winning.label_hi}" पर सबसे ज्यादा ${winning.conversion_rate}% कन्वर्शन देखा जा रहा है। अपने मेटा ऐड बजट का 50% से 60% "${winning.category}" और नजदीकी क्लीनिक वाले शहरों (${highIntentCities.slice(0, 3).join(', ')}) पर केंद्रित करें।`
      : 'मेटा ऐड्स में ट्यूब ब्लॉकेज और PCOD से संबंधित ऐड्स पर ज्यादा बजट लगाएं और डायरेक्ट व्हाट्सएप सीटीए रखें।';

  const summary = `वर्तमान में कुल कन्वर्शन रेट ${overallConversionRate}% है। ${
    highIntentCities.length > 0
      ? `सबसे ज्यादा रिस्पांस ${highIntentCities.join(', ')} से आ रहा है।`
      : ''
  } महिला पेशेंट्स की संख्या सर्वाधिक है। क्लीनिक विज़िट वाले पेशेंट्स को नाड़ी परीक्षण और वीडियो कंसल्टेशन वाले पेशेंट्स को जीभ परीक्षण व 5-डॉक्टर्स पैनल की डीप स्टडी पिच करने से कन्वर्शन अधिकतम हो रहा है।`;

  return {
    winning_concern: winning.category,
    winning_conversion_rate: winning.conversion_rate,
    high_intent_cities: highIntentCities,
    budget_advice,
    creative_hooks,
    summary,
  };
}
