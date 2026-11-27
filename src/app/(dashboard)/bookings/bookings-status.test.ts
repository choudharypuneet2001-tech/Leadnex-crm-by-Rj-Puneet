import { describe, it, expect } from 'vitest';
import {
  getEffectiveWebsiteStatus,
  getEffectiveVisitOutcome,
  normalizeDateStringToYMD,
  cleanPatientQueryNotes,
  getCombinedBookingNotesForWebsite,
  formatPreferredScheduleInEnglish,
} from './page';
import type { Booking } from '@/types';

function createMockBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'test-booking-id',
    account_id: 'test-account-id',
    contact_id: 'test-contact-id',
    booking_query_id: 'GYN-001',
    patient_name: 'सुनीता शर्मा',
    phone: '919876543210',
    city: 'Jaipur',
    consultation_type: 'clinic_visit',
    clinic_location: 'Jaipur',
    status: 'confirmed',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('Bookings Status & Conversion Helpers', () => {
  describe('getEffectiveWebsiteStatus', () => {
    it('returns column website_status if done', () => {
      const b = createMockBooking({ website_status: 'done' });
      expect(getEffectiveWebsiteStatus(b)).toBe('done');
    });

    it('returns column website_status if pending', () => {
      const b = createMockBooking({ website_status: 'pending' });
      expect(getEffectiveWebsiteStatus(b)).toBe('pending');
    });

    it('falls back to notes tag [Website: DONE]', () => {
      const b = createMockBooking({ notes: 'Patient confirmed. [Website: DONE]' });
      expect(getEffectiveWebsiteStatus(b)).toBe('done');
    });

    it('defaults to pending when neither column nor notes indicate done', () => {
      const b = createMockBooking({ notes: 'Normal patient note' });
      expect(getEffectiveWebsiteStatus(b)).toBe('pending');
    });
  });

  describe('getEffectiveVisitOutcome', () => {
    it('returns column visit_outcome directly', () => {
      const b1 = createMockBooking({ visit_outcome: 'converted' });
      expect(getEffectiveVisitOutcome(b1)).toBe('converted');

      const b2 = createMockBooking({ visit_outcome: 'non_converted' });
      expect(getEffectiveVisitOutcome(b2)).toBe('non_converted');

      const b3 = createMockBooking({ visit_outcome: 'not_visited' });
      expect(getEffectiveVisitOutcome(b3)).toBe('not_visited');
    });

    it('falls back to notes tag [Outcome: CONVERTED]', () => {
      const b = createMockBooking({ notes: 'Visited clinic today [Outcome: CONVERTED]' });
      expect(getEffectiveVisitOutcome(b)).toBe('converted');
    });

    it('falls back to notes tag [Outcome: NON_CONVERTED]', () => {
      const b = createMockBooking({ notes: 'Came for consult [Outcome: NON_CONVERTED]' });
      expect(getEffectiveVisitOutcome(b)).toBe('non_converted');
    });

    it('falls back to notes tag [Outcome: NOT_VISITED]', () => {
      const b = createMockBooking({ notes: 'Did not arrive [Outcome: NOT_VISITED]' });
      expect(getEffectiveVisitOutcome(b)).toBe('not_visited');
    });

    it('defaults to pending_visit when outcome is unspecified', () => {
      const b = createMockBooking({ notes: undefined });
      expect(getEffectiveVisitOutcome(b)).toBe('pending_visit');
    });
  });

  describe('normalizeDateStringToYMD', () => {
    it('normalizes ISO date YYYY-MM-DD correctly', () => {
      expect(normalizeDateStringToYMD('2026-11-27')).toBe('2026-11-27');
      expect(normalizeDateStringToYMD('2026-05-04')).toBe('2026-05-04');
    });

    it('normalizes DMY formats DD/MM/YYYY and DD-MM-YYYY', () => {
      expect(normalizeDateStringToYMD('27/11/2026')).toBe('2026-11-27');
      expect(normalizeDateStringToYMD('04-05-2026')).toBe('2026-05-04');
    });

    it('normalizes text month dates e.g. "27 November 2026" and "28 Nov 2026"', () => {
      expect(normalizeDateStringToYMD('27 November 2026')).toBe('2026-11-27');
      expect(normalizeDateStringToYMD('28 Nov 2026')).toBe('2026-11-28');
      expect(normalizeDateStringToYMD('1 January 2027')).toBe('2027-01-01');
    });

    it('normalizes Hindi month dates e.g. "15 नवंबर 2026", "16 नवम्बर", "1 दिसंबर 2026"', () => {
      expect(normalizeDateStringToYMD('15 नवंबर 2026')).toBe('2026-11-15');
      expect(normalizeDateStringToYMD('16 नवम्बर 2026')).toBe('2026-11-16');
      expect(normalizeDateStringToYMD('1 दिसंबर 2026')).toBe('2026-12-01');
    });

    it('normalizes Hindi digits e.g. "१५ नवंबर २०२६"', () => {
      expect(normalizeDateStringToYMD('१५ नवंबर २०२६')).toBe('2026-11-15');
    });

    it('normalizes relative terms e.g. "aaj", "kal", "parso", "आज", "कल"', () => {
      expect(normalizeDateStringToYMD('aaj')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(normalizeDateStringToYMD('kal')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(normalizeDateStringToYMD('आज')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(normalizeDateStringToYMD('कल')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('returns null for empty or non-date strings', () => {
      expect(normalizeDateStringToYMD('')).toBeNull();
      expect(normalizeDateStringToYMD(null)).toBeNull();
      expect(normalizeDateStringToYMD(undefined)).toBeNull();
      expect(normalizeDateStringToYMD('Flexible')).toBeNull();
    });
  });

  describe('formatPreferredScheduleInEnglish', () => {
    it('formats Hindi date and Hindi time into clean English', () => {
      const formatted = formatPreferredScheduleInEnglish('15 नवंबर 2026', 'शाम 6:30 बजे');
      expect(formatted).toBe('15 November 2026 - 06:30 PM');
    });

    it('formats Hindi date with morning time', () => {
      const formatted = formatPreferredScheduleInEnglish('16 नवंबर 2026', 'सुबह 10 बजे');
      expect(formatted).toBe('16 November 2026 - 10:00 AM');
    });

    it('cleans trailing relative labels like "- Aaj" and "- Kal"', () => {
      const formatted = formatPreferredScheduleInEnglish('15 November 2026 - Aaj', '4:00 PM');
      expect(formatted).toBe('15 November 2026 - 04:00 PM');
    });

    it('formats December dates accurately', () => {
      const formatted = formatPreferredScheduleInEnglish('1 दिसंबर 2026', '');
      expect(formatted).toBe('1 December 2026');
    });
  });

  describe('cleanPatientQueryNotes', () => {
    it('returns empty string for null or undefined or empty', () => {
      expect(cleanPatientQueryNotes(null)).toBe('');
      expect(cleanPatientQueryNotes(undefined)).toBe('');
      expect(cleanPatientQueryNotes('')).toBe('');
    });

    it('preserves genuine patient query and symptoms notes', () => {
      const raw = 'Patient ko 2 saal se PCOD problem hai\nDoctor se baat karni hai';
      expect(cleanPatientQueryNotes(raw)).toBe(
        'Patient ko 2 saal se PCOD problem hai\nDoctor se baat karni hai'
      );
    });

    it('filters out automated call status and agent stamped disposition logs', () => {
      const polluted = `Patient bol rahi hai reports WhatsApp par bheji hain
👤 Meenal (27 Nov, 04:30 PM): ❌ Not Connected / Call Not Answered. Next Follow-up: Today 06:00 PM
👤 Meenal (27 Nov, 04:31 PM): ❌ Not Connected / Call Not Answered. Next Follow-up: Today 06:00 PM
👤 Deepesh (27 Nov, 05:00 PM): ⏳ Callback Requested by Patient. Suggested call: Today 06:30 PM
[Booking GYN-101] 👤 Meenal (27 Nov, 04:30 PM): ❌ Not Connected
[Outcome: NOT_VISITED]
[Website: PENDING]`;

      expect(cleanPatientQueryNotes(polluted)).toBe(
        'Patient bol rahi hai reports WhatsApp par bheji hain'
      );
    });
  });

  describe('getCombinedBookingNotesForWebsite', () => {
    it('prioritizes agent discussion notes over initial automated AI health_concern', () => {
      const b = createMockBooking({
        health_concern: 'अनियमित पीरियड्स',
        notes: '👤 Puneet Choudhary (27 Nov, 05:37 pm): Age: 20 Shadi ko 12 saal ho gaye',
      });
      const combined = getCombinedBookingNotesForWebsite(b);
      expect(combined).toBe('Age: 20 Shadi ko 12 saal ho gaye');
    });

    it('returns health_concern when no additional query notes exist', () => {
      const b = createMockBooking({
        health_concern: 'अनियमित पीरियड्स',
        notes: null,
      });
      expect(getCombinedBookingNotesForWebsite(b)).toBe('अनियमित पीरियड्स');
    });

    it('returns cleaned query notes when health_concern is absent', () => {
      const b = createMockBooking({
        health_concern: undefined,
        notes: '👤 Puneet Choudhary (27 Nov, 05:37 pm): Age: 20 Shadi ko 12 saal ho gaye',
      });
      expect(getCombinedBookingNotesForWebsite(b)).toBe('Age: 20 Shadi ko 12 saal ho gaye');
    });

    it('filters out automated disposition logs and keeps genuine query notes', () => {
      const b = createMockBooking({
        health_concern: 'PCOD',
        notes: `👤 Meenal (27 Nov, 04:30 PM): ❌ Not Connected / Call Not Answered. Next Follow-up: Today 06:00 PM
👤 Puneet Choudhary (27 Nov, 05:37 pm): Reports WhatsApp par bhej di hain`,
      });
      const combined = getCombinedBookingNotesForWebsite(b);
      expect(combined).toBe('Reports WhatsApp par bhej di hain');
    });

    it('returns health_concern when notes only have automated call disposition tags', () => {
      const b = createMockBooking({
        health_concern: 'Tubal Blockage',
        notes: '👤 Meenal (27 Nov, 04:30 PM): ❌ Not Connected / Call Not Answered. Next Follow-up: Today 06:00 PM',
      });
      expect(getCombinedBookingNotesForWebsite(b)).toBe('Tubal Blockage');
    });
  });
});
