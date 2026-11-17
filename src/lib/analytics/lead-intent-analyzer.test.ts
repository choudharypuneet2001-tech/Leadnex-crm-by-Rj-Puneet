import { describe, it, expect } from 'vitest';
import { analyzeLeadIntent } from './lead-intent-analyzer';

describe('lead-intent-analyzer', () => {
  it('identifies confirmed bookings', () => {
    const analysis = analyzeLeadIntent({
      name: 'Sunita Sharma',
      phone: '+919876543210',
      city: 'Jaipur',
      hasBooking: true,
      bookingStatus: 'confirmed',
    });

    expect(analysis.intent_stage).toBe('booked');
    expect(analysis.intent_label).toContain('Booking Confirmed');
    expect(analysis.urgency).toBe('low');
  });

  it('identifies fees hesitation drop-off', () => {
    const analysis = analyzeLeadIntent({
      name: 'Pooja Verma',
      phone: '+919876543211',
      city: 'Bikaner',
      healthConcern: 'PCOD and periods irregular',
      hasBooking: false,
      lastMessageText: 'Registration fees 499 Rs pay karna hoga.',
    });

    expect(analysis.intent_stage).toBe('fees_hesitation');
    expect(analysis.intent_label).toContain('Fees Hesitation');
    expect(analysis.dropout_reason).toContain('499');
    expect(analysis.urgency).toBe('high');
  });

  it('identifies clinic branch opportunity when near clinic city', () => {
    const analysis = analyzeLeadIntent({
      name: 'Komal Gupta',
      phone: '+919876543212',
      city: 'Jaipur',
      healthConcern: 'Dono fallopian tube block hai',
      hasBooking: false,
      lastMessageText: 'reports dekh ke batao',
    });

    expect(analysis.intent_stage).toBe('clinic_opportunity');
    expect(analysis.intent_label).toContain('Clinic Visit');
    expect(analysis.calling_pitch).toContain('नाड़ी परीक्षण');
    expect(analysis.urgency).toBe('high');
  });

  it('identifies ready to convert hot lead for remote patient with serious condition', () => {
    const analysis = analyzeLeadIntent({
      name: 'Anjali Devi',
      phone: '+919876543213',
      city: 'Gorakhpur',
      healthConcern: 'Conceive nahi ho raha 4 saal se',
      concernCategory: 'Infertility & Conceiving',
      hasBooking: false,
      lastMessageText: 'kya ilaaj sambhav hai',
    });

    expect(analysis.intent_stage).toBe('ready_to_convert');
    expect(analysis.intent_label).toContain('Ready to Convert');
    expect(analysis.calling_pitch).toContain('5 सीनियर डॉक्टर्स');
    expect(analysis.urgency).toBe('high');
  });

  it('identifies awareness only for generic questions without symptoms', () => {
    const analysis = analyzeLeadIntent({
      name: 'Rajesh',
      phone: '+919876543214',
      city: 'Nagpur',
      hasBooking: false,
      lastMessageText: 'dawai ka naam batao price kya hai',
    });

    expect(analysis.intent_stage).toBe('awareness_only');
    expect(analysis.intent_label).toContain('Awareness Only');
    expect(analysis.urgency).toBe('low');
  });
});
