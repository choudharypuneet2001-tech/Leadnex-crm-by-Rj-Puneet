import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/ai/admin-client';

export interface ManagedClinic {
  id: string;
  city: string;
  name: string;
  address: string;
  landmark?: string;
  google_maps_url: string;
  helpline: string;
  timings: string;
  is_active: boolean;
  display_order: number;
}

export const DEFAULT_CLINICS: ManagedClinic[] = [
  {
    id: 'clinic-jaipur',
    city: 'Jaipur',
    name: 'Jaipur (Head Office, Vaishali Nagar)',
    address: '45, हनुमान वाटिका, चित्रकूट मार्ग, टैगोर नगर, वैशाली नगर, जयपुर, राजस्थान 302021',
    landmark: 'चित्रकूट मार्ग, वैशाली नगर',
    google_maps_url: 'https://maps.google.com/?q=Gynocci+Tagore+Nagar+Vaishali+Nagar+Jaipur',
    helpline: '+91 93524 93700',
    timings: '10:00 AM से 6:30 PM (सोमवार से रविवार - सातों दिन खुला)',
    is_active: true,
    display_order: 1,
  },
  {
    id: 'clinic-delhi',
    city: 'Delhi',
    name: 'Delhi (Rajouri Garden)',
    address: 'ग्राउंड फ्लोर, A-11, ब्लॉक A2, मेट्रो पिलर नंबर 388 के पास, राजौरी गार्डन, नई दिल्ली, दिल्ली 110027',
    landmark: 'मेट्रो पिलर नंबर 388 के पास, राजौरी गार्डन',
    google_maps_url: 'https://maps.google.com/?q=Gynocci+Rajouri+Garden+New+Delhi',
    helpline: '+91 93524 93700',
    timings: '10:00 AM से 6:30 PM (सोमवार से रविवार - सातों दिन खुला)',
    is_active: true,
    display_order: 2,
  },
  {
    id: 'clinic-lucknow',
    city: 'Lucknow',
    name: 'Lucknow (Gomti Nagar)',
    address: 'DLF MyPAD, प्रथम तल (Titan Eye+ के ऊपर), विभूति खंड, गोमती नगर, लखनऊ, उत्तर प्रदेश 226010',
    landmark: 'टाइटन आई प्लस के ऊपर, विभूति खंड, गोमती नगर',
    google_maps_url: 'https://maps.google.com/?q=Gynocci+DLF+MyPAD+Gomti+Nagar+Lucknow',
    helpline: '+91 93524 93700',
    timings: '10:00 AM से 6:30 PM (सोमवार से रविवार - सातों दिन खुला)',
    is_active: true,
    display_order: 3,
  },
  {
    id: 'clinic-amritsar',
    city: 'Amritsar',
    name: 'Amritsar (Ranjit Avenue)',
    address: 'SCO 138, द्वितीय तल, डी ब्लॉक, रंजीत एवेन्यू, अमृतसर, पंजाब 143001',
    landmark: 'डी ब्लॉक, रंजीत एवेन्यू',
    google_maps_url: 'https://maps.google.com/?q=Gynocci+Ranjit+Avenue+Amritsar',
    helpline: '+91 93524 93700',
    timings: '10:00 AM से 6:30 PM (सोमवार से रविवार - सातों दिन खुला)',
    is_active: true,
    display_order: 4,
  },
  {
    id: 'clinic-ludhiana',
    city: 'Ludhiana',
    name: 'Ludhiana (Ferozepur Road)',
    address: 'फर्स्ट फ्लोर, SCO 18, फ़िरोज़ गांधी मार्केट / फ़िरोज़पुर रोड, लुधियाना, पंजाब 141001',
    landmark: 'फ़िरोज़ गांधी मार्केट, फ़िरोज़पुर रोड',
    google_maps_url: 'https://maps.google.com/?q=Gynocci+Ferozepur+Road+Ludhiana',
    helpline: '+91 93524 93700',
    timings: '10:00 AM से 6:30 PM (सोमवार से रविवार - सातों दिन खुला)',
    is_active: true,
    display_order: 5,
  },
  {
    id: 'clinic-chandigarh',
    city: 'Chandigarh',
    name: 'Chandigarh (Sector 35-C)',
    address: 'SCO 441-442, प्रथम तल, सेक्टर 35-C, चंडीगढ़ 160022',
    landmark: 'सेक्टर 35-C कमर्शियल कॉम्प्लेक्स',
    google_maps_url: 'https://maps.google.com/?q=Gynocci+Sector+35C+Chandigarh',
    helpline: '+91 93524 93700',
    timings: '10:00 AM से 6:30 PM (सोमवार से रविवार - सातों दिन खुला)',
    is_active: true,
    display_order: 6,
  },
  {
    id: 'clinic-indore',
    city: 'Indore',
    name: 'Indore (Vijay Nagar)',
    address: 'दुकान नंबर 204, द्वितीय तल, मंगल सिटी मॉल के सामने, विजय नगर, इंदौर, मध्य प्रदेश 452010',
    landmark: 'मंगल सिटी मॉल के सामने, विजय नगर',
    google_maps_url: 'https://maps.google.com/?q=Gynocci+Vijay+Nagar+Indore',
    helpline: '+91 93524 93700',
    timings: '10:00 AM से 6:30 PM (सोमवार से रविवार - सातों दिन खुला)',
    is_active: true,
    display_order: 7,
  },
  {
    id: 'clinic-patna',
    city: 'Patna',
    name: 'Patna (Kankarbagh)',
    address: 'प्लॉट संख्या B-14, शिवाजी पार्क के निकट, मुख्य कंकड़बाग रोड, पटना, बिहार 800020',
    landmark: 'शिवाजी पार्क के पास, मुख्य कंकड़बाग रोड',
    google_maps_url: 'https://maps.google.com/?q=Gynocci+Kankarbagh+Patna',
    helpline: '+91 93524 93700',
    timings: '10:00 AM से 6:30 PM (सोमवार से रविवार - सातों दिन खुला)',
    is_active: true,
    display_order: 8,
  },
  {
    id: 'clinic-rewari',
    city: 'Rewari',
    name: 'Rewari (Model Town)',
    address: 'शॉप नंबर 12, प्रथम तल, ब्रास मार्केट / मॉडल टाउन, सर्कुलर रोड के पास, रेवाड़ी, हरियाणा 123401',
    landmark: 'ब्रास मार्केट / मॉडल टाउन',
    google_maps_url: 'https://maps.google.com/?q=Gynocci+Model+Town+Rewari',
    helpline: '+91 93524 93700',
    timings: '10:00 AM से 6:30 PM (सोमवार से रविवार - सातों दिन खुला)',
    is_active: true,
    display_order: 9,
  },
];

const CLINICS_CONFIG_KEY = '__gynocci_clinics_config__';

/**
 * Loads managed clinics for an account.
 * Checks dedicated clinics table first; falls back to custom_fields storage,
 * and seeds DEFAULT_CLINICS if uninitialized.
 */
export async function getManagedClinics(
  db: SupabaseClient,
  accountId: string
): Promise<ManagedClinic[]> {
  if (!accountId) return DEFAULT_CLINICS;

  try {
    // 1. Try querying dedicated 'clinics' table
    const { data: tableData, error: tableError } = await db
      .from('clinics')
      .select('*')
      .eq('account_id', accountId)
      .order('display_order', { ascending: true });

    if (!tableError && tableData && tableData.length > 0) {
      return tableData as ManagedClinic[];
    }

    // 2. Fall back to custom_fields storage
    const { data: configData, error: configError } = await db
      .from('custom_fields')
      .select('id, field_options')
      .eq('account_id', accountId)
      .eq('field_name', CLINICS_CONFIG_KEY)
      .maybeSingle();

    if (!configError && configData?.field_options?.clinics) {
      const stored = configData.field_options.clinics as ManagedClinic[];
      if (Array.isArray(stored) && stored.length > 0) {
        return stored.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
      }
    }

    // 3. Uninitialized: seed DEFAULT_CLINICS into custom_fields storage
    try {
      await saveManagedClinics(db, accountId, DEFAULT_CLINICS);
    } catch (seedErr) {
      console.warn('[clinics-service] seed fallback notice:', seedErr);
    }

    return DEFAULT_CLINICS;
  } catch (err) {
    console.warn('[clinics-service] getManagedClinics notice:', err);
    return DEFAULT_CLINICS;
  }
}

/**
 * Saves the full list of clinics for an account.
 */
export async function saveManagedClinics(
  db: SupabaseClient,
  accountId: string,
  clinics: ManagedClinic[],
  userId?: string
): Promise<void> {
  if (!accountId) return;

  // Try saving into dedicated clinics table if present
  try {
    const { error: tableTestError } = await db.from('clinics').select('id').limit(1);
    if (!tableTestError) {
      // Upsert clinics rows
      for (const clinic of clinics) {
        await db.from('clinics').upsert({
          id: clinic.id.includes('-') && !clinic.id.startsWith('clinic-') ? clinic.id : undefined,
          account_id: accountId,
          city: clinic.city,
          name: clinic.name,
          address: clinic.address,
          landmark: clinic.landmark || null,
          google_maps_url: clinic.google_maps_url,
          helpline: clinic.helpline,
          timings: clinic.timings,
          is_active: clinic.is_active,
          display_order: clinic.display_order,
          updated_at: new Date().toISOString(),
        });
      }
    }
  } catch {
    // ignore if table doesn't exist
  }

  // Always sync into custom_fields storage for universal durability
  let client = db;
  try {
    const admin = supabaseAdmin();
    if (admin) client = admin;
  } catch {
    // fallback
  }

  const { data: existing } = await client
    .from('custom_fields')
    .select('id')
    .eq('account_id', accountId)
    .eq('field_name', CLINICS_CONFIG_KEY)
    .maybeSingle();

  if (existing?.id) {
    const { error: updateErr } = await client
      .from('custom_fields')
      .update({
        field_options: { clinics },
      })
      .eq('id', existing.id);
    if (updateErr) throw updateErr;
  } else {
    let validUserId: string | null = null;
    if (userId) {
      const { data: check } = await client
        .from('profiles')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle();
      if (check?.user_id) validUserId = check.user_id;
    }

    if (!validUserId) {
      const { data: ownerProf } = await client
        .from('profiles')
        .select('user_id')
        .eq('account_id', accountId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      validUserId = ownerProf?.user_id || null;
    }

    if (!validUserId) {
      const { data: anyProf } = await client
        .from('profiles')
        .select('user_id')
        .limit(1)
        .maybeSingle();
      validUserId = anyProf?.user_id || null;
    }

    const insertPayload: Record<string, any> = {
      account_id: accountId,
      field_name: CLINICS_CONFIG_KEY,
      field_type: 'json',
      field_options: { clinics },
    };
    if (validUserId) {
      insertPayload.user_id = validUserId;
    }

    const { error: insertErr } = await client
      .from('custom_fields')
      .insert(insertPayload);
    if (insertErr) throw insertErr;
  }
}
