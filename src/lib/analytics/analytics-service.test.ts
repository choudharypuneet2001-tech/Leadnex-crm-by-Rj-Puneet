import { describe, it, expect } from 'vitest';
import {
  classifyHealthConcern,
  detectLeadGender,
  resolveDateRange,
  checkNearbyClinic,
  computeAnalytics,
  generateAiAdRecommendations,
} from './analytics-service';
import type { Booking, Contact } from '@/types';

describe('analytics-service', () => {
  describe('classifyHealthConcern', () => {
    it('classifies tubal blockage', () => {
      expect(classifyHealthConcern('Dono fallopian tube block hai').category).toBe('Tubal Blockage');
      expect(classifyHealthConcern('HSG test karwaya tha tube band aayi').category).toBe('Tubal Blockage');
    });

    it('classifies PCOD and irregular periods', () => {
      expect(classifyHealthConcern('PCOD ki problem hai aur periods late aate hain').category).toBe(
        'PCOD / PCOS & Periods'
      );
      expect(classifyHealthConcern('अनियमित माहवारी की समस्या').category).toBe(
        'PCOD / PCOS & Periods'
      );
    });

    it('classifies conceiving / infertility', () => {
      expect(classifyHealthConcern('Shadi ko 4 saal ho gaye conceive nahi ho raha').category).toBe(
        'Infertility & Conceiving'
      );
      expect(classifyHealthConcern('संतान प्राप्ति में समस्या').category).toBe(
        'Infertility & Conceiving'
      );
    });

    it('classifies low AMH', () => {
      expect(classifyHealthConcern('Doctor ne low AMH bataya hai 0.5').category).toBe(
        'Low AMH & Egg Reserve'
      );
    });

    it('classifies male sperm issues', () => {
      expect(classifyHealthConcern('Husband ka sperm count low hai motility problem').category).toBe(
        'Male Infertility & Low Sperm'
      );
    });

    it('classifies white discharge', () => {
      expect(classifyHealthConcern('White discharge aur bahut kamzori rehti hai').category).toBe(
        'White Discharge & Weakness'
      );
    });

    it('classifies recurrent miscarriage', () => {
      expect(classifyHealthConcern('Do bar miscarriage ho gaya heartbeat aakar band ho gayi').category).toBe(
        'Recurrent Miscarriage'
      );
    });

    it('defaults to general care when unspecified', () => {
      expect(classifyHealthConcern(null).category).toBe('General Gynaecological Care');
      expect(classifyHealthConcern('kuch advice chahiye').category).toBe('General Gynaecological Care');
    });
  });

  describe('detectLeadGender', () => {
    it('detects female names correctly', () => {
      expect(detectLeadGender('Priya Sharma')).toBe('female');
      expect(detectLeadGender('Pooja Devi')).toBe('female');
      expect(detectLeadGender('Mrs. Anjali')).toBe('female');
      expect(detectLeadGender('Sunita Kumari')).toBe('female');
      expect(detectLeadGender('Komal')).toBe('female');
    });

    it('detects male names correctly', () => {
      expect(detectLeadGender('Rahul Sharma')).toBe('male');
      expect(detectLeadGender('Deepak Kumar')).toBe('male');
      expect(detectLeadGender('Mr. Rajesh Singh')).toBe('male');
      expect(detectLeadGender('Amit Patel')).toBe('male');
    });

    it('handles unknown/empty', () => {
      expect(detectLeadGender('')).toBe('unknown');
      expect(detectLeadGender(null)).toBe('unknown');
    });
  });

  describe('checkNearbyClinic', () => {
    it('identifies clinic cities', () => {
      expect(checkNearbyClinic('Jaipur').hasClinic).toBe(true);
      expect(checkNearbyClinic('New Delhi').hasClinic).toBe(true);
      expect(checkNearbyClinic('Lucknow').hasClinic).toBe(true);
      expect(checkNearbyClinic('Amritsar').hasClinic).toBe(true);
      expect(checkNearbyClinic('Gurgaon').hasClinic).toBe(true);
    });

    it('returns false for distant cities without clinic', () => {
      expect(checkNearbyClinic('Mumbai').hasClinic).toBe(false);
      expect(checkNearbyClinic('Bengaluru').hasClinic).toBe(false);
    });
  });

  describe('computeAnalytics', () => {
    const mockContacts: Contact[] = [
      {
        id: 'c1',
        user_id: 'u1',
        account_id: 'a1',
        phone: '+919876543210',
        name: 'Sunita Sharma',
        city: 'Jaipur',
        ad_name: 'Jaipur Clinic Special Ad',
        ad_id: 'ad-101',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'c2',
        user_id: 'u1',
        account_id: 'a1',
        phone: '+919876543211',
        name: 'Pooja Verma',
        city: 'Delhi',
        ad_name: 'Tubal Blockage Ayurvedic Care',
        ad_id: 'ad-102',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'c3',
        user_id: 'u1',
        account_id: 'a1',
        phone: '+919876543212',
        name: 'Rajesh Kumar',
        city: 'Mumbai',
        ad_name: 'Direct WhatsApp Organic',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const mockBookings: Booking[] = [
      {
        id: 'b1',
        account_id: 'a1',
        contact_id: 'c1',
        booking_query_id: '#GYN-101',
        patient_name: 'Sunita Sharma',
        phone: '+919876543210',
        city: 'Jaipur',
        health_concern: 'Dono fallopian tube block hai',
        consultation_type: 'clinic_visit',
        clinic_location: 'Jaipur (Head Office, Vaishali Nagar)',
        ad_name: 'Jaipur Clinic Special Ad',
        ad_id: 'ad-101',
        status: 'confirmed',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'b2',
        account_id: 'a1',
        contact_id: 'c2',
        booking_query_id: '#GYN-102',
        patient_name: 'Pooja Verma',
        phone: '+919876543211',
        city: 'Delhi',
        health_concern: 'PCOD and periods delay',
        consultation_type: 'video_consultation',
        ad_name: 'Tubal Blockage Ayurvedic Care',
        ad_id: 'ad-102',
        status: 'confirmed',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    it('aggregates summary metrics correctly', () => {
      const summary = computeAnalytics(mockContacts, mockBookings, { preset: 'all' });
      expect(summary.total_leads).toBe(3);
      expect(summary.total_bookings).toBe(2);
      expect(summary.conversion_rate).toBe(66.7);
      expect(summary.clinic_visits).toBe(1);
      expect(summary.video_consultations).toBe(1);
      expect(summary.ad_performance.length).toBeGreaterThan(0);
      expect(summary.top_cities.length).toBeGreaterThan(0);
      expect(summary.gender_stats.female_count).toBe(2);
      expect(summary.gender_stats.male_count).toBe(1);
      expect(summary.ai_recommendations.creative_hooks.length).toBe(3);
    });

    it('filters by ad_name when selected', () => {
      const summary = computeAnalytics(mockContacts, mockBookings, { preset: 'all' }, 'Jaipur Clinic Special Ad');
      expect(summary.total_leads).toBe(1);
      expect(summary.leads[0].name).toBe('Sunita Sharma');
    });

    it('tracks lead by first message date from conversation and records first_message_at', () => {
      const convs = [
        {
          id: 'conv1',
          contact_id: 'c1',
          created_at: '2026-11-20T08:30:00.000Z',
          last_message_text: 'Hi, mujhe consultation chahiye',
          last_message_at: '2026-11-20T08:30:00.000Z',
        },
      ];
      const summary = computeAnalytics(mockContacts, mockBookings, { preset: 'all' }, undefined, convs);
      const lead1 = summary.leads.find((l) => l.id === 'c1');
      expect(lead1).toBeDefined();
      expect(lead1?.first_message_at).toBe('2026-11-20T08:30:00.000Z');
    });

    it('resolves date ranges using IST boundaries for today and yesterday', () => {
      const todayRange = resolveDateRange({ preset: 'today' });
      expect(todayRange.from).not.toBeNull();
      expect(todayRange.to).not.toBeNull();
      expect(todayRange.label).toBe('Today');

      const yesterdayRange = resolveDateRange({ preset: 'yesterday' });
      expect(yesterdayRange.from).not.toBeNull();
      expect(yesterdayRange.to).not.toBeNull();
      expect(yesterdayRange.label).toBe('Yesterday');
    });
  });
});
