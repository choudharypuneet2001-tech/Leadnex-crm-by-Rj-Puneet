export type AnalyticsDateRangePreset =
  | 'today'
  | 'yesterday'
  | '7d'
  | '30d'
  | 'this_month'
  | 'all'
  | 'custom';

export interface DateRangeFilter {
  preset: AnalyticsDateRangePreset;
  from?: string; // ISO string
  to?: string;   // ISO string
}

export interface AdPerformanceItem {
  ad_name: string;
  ad_id: string | null;
  leads_count: number;
  bookings_count: number;
  conversion_rate: number; // 0 to 100
  top_concern: string;
  top_city: string;
  clinic_visits: number;
  video_consultations: number;
}

export interface HealthConcernItem {
  category: string;
  label_hi: string;
  count: number;
  percentage: number; // 0 to 100
  bookings_count: number;
  conversion_rate: number; // 0 to 100
  color: string;
}

export interface GenderStats {
  female_count: number;
  female_percentage: number;
  male_count: number;
  male_percentage: number;
  unknown_count: number;
  total: number;
}

export interface CityPerformanceItem {
  city: string;
  leads_count: number;
  bookings_count: number;
  conversion_rate: number;
  clinic_visits: number;
  video_consultations: number;
  has_clinic: boolean;
  clinic_name?: string;
}

export interface AiAdCreativeHook {
  title: string;
  angle: string;
  hook_hindi: string;
  body_hindi: string;
  recommended_cta: string;
  target_audience: string;
}

export interface AiAdRecommendation {
  winning_concern: string;
  winning_conversion_rate: number;
  high_intent_cities: string[];
  budget_advice: string;
  creative_hooks: AiAdCreativeHook[];
  summary: string;
}

export interface AnalyticsLeadItem {
  id: string;
  created_at: string;
  name: string;
  phone: string;
  city: string | null;
  gender: 'female' | 'male' | 'unknown';
  ad_name: string | null;
  ad_id: string | null;
  health_concern: string | null;
  concern_category: string;
  has_booking: boolean;
  booking_id: string | null;
  booking_query_id: string | null;
  booking_status: string | null;
  consultation_type: string | null;
  clinic_location: string | null;
  conversation_id: string | null;
  notes: string | null;
}

export interface AnalyticsSummary {
  total_leads: number;
  total_bookings: number;
  conversion_rate: number;
  clinic_visits: number;
  video_consultations: number;
  meta_ad_leads: number;
  organic_leads: number;
  ad_performance: AdPerformanceItem[];
  health_concerns: HealthConcernItem[];
  gender_stats: GenderStats;
  top_cities: CityPerformanceItem[];
  ai_recommendations: AiAdRecommendation;
  leads: AnalyticsLeadItem[];
  date_range_label: string;
}
