import { describe, it, expect } from 'vitest';
import {
  buildVoiceAgentPrompt,
  detectCallDisposition,
  normalizeHindiForSpeech,
} from './voice-agent-service';

describe('Voice Agent Service', () => {
  describe('buildVoiceAgentPrompt', () => {
    it('creates empathetic voice prompt with patient name and concern', () => {
      const prompt = buildVoiceAgentPrompt({
        patientName: 'Priya',
        phone: '919876543210',
        concern: 'Tubal Blockage',
        city: 'Jaipur',
      });

      expect(prompt).toContain('Priya जी');
      expect(prompt).toContain('Tubal Blockage');
      expect(prompt).toContain('Jaipur');
      expect(prompt).toContain('गायनोसी');
      expect(prompt).toContain('चार सौ निन्यानवे रुपये');
      expect(prompt).toContain('डाइट प्लान');
    });

    it('handles defaults gracefully when options are empty', () => {
      const prompt = buildVoiceAgentPrompt({});
      expect(prompt).toContain('गायनोसी');
      expect(prompt).toContain('NATURAL VOICE & HUMAN CADENCE');
    });
  });

  describe('normalizeHindiForSpeech', () => {
    it('normalizes numbers and brand names into fluent spoken Hindi words', () => {
      const normalized = normalizeHindiForSpeech(
        'Gynocci में ₹499 में 5 डॉक्टरों का पैनल IVF और PCOD की जांच करता है'
      );

      expect(normalized).toContain('गायनोसी');
      expect(normalized).toContain('चार सौ निन्यानवे रुपये');
      expect(normalized).toContain('पाँच सीनियर डॉक्टर');
      expect(normalized).toContain('आई.वी.एफ.');
      expect(normalized).toContain('पी.सी.ओ.डी.');
    });

    it('adds natural breathing pause after greeting', () => {
      const normalized = normalizeHindiForSpeech('नमस्ते जी मैं डॉ. शिखा हूँ');
      expect(normalized).toContain('नमस्ते, जी');
    });
  });

  describe('detectCallDisposition', () => {
    it('detects Booked status', () => {
      const res = detectCallDisposition('मरीज ने कहा अपॉइंटमेंट कन्फर्म कर दीजिये');
      expect(res.disposition).toBe('Booked');
    });

    it('detects Fees Hesitation status', () => {
      const res = detectCallDisposition('मरीज ने बोला कि फीस बहुत ज्यादा है क्या ₹499 ही लगेगी');
      expect(res.disposition).toBe('Fees Hesitation');
    });

    it('detects Clinic Visit status', () => {
      const res = detectCallDisposition('मरीज जयपुर क्लिनिक आकर मिलूंगी बोला');
      expect(res.disposition).toBe('Clinic Visit');
    });

    it('detects Callback status', () => {
      const res = detectCallDisposition('मरीज ने बोला बाद में कॉल करना अभी बिजी हूँ');
      expect(res.disposition).toBe('Callback');
    });

    it('detects Interested status', () => {
      const res = detectCallDisposition('मरीज ने इलाज के बारे में जानकारी पूछी');
      expect(res.disposition).toBe('Interested');
    });

    it('defaults to Awareness status', () => {
      const res = detectCallDisposition('हेलो कौन बोल रहा है');
      expect(res.disposition).toBe('Awareness');
    });
  });
});
