import { describe, it, expect, vi } from 'vitest';
import {
  isContactBlocked,
  checkIfContactIsBlocked,
  blockContact,
  unblockContact,
  BLOCKED_TAG_NAME,
} from './block-service';

describe('block-service', () => {
  describe('isContactBlocked', () => {
    it('returns true when contact has 🚫 Blocked tag', () => {
      const contact = {
        id: 'c1',
        tags: [{ id: 't1', user_id: 'u1', name: '🚫 Blocked', color: '#ef4444', created_at: '' }],
      };
      expect(isContactBlocked(contact)).toBe(true);
    });

    it('returns true for case-insensitive blocked tag', () => {
      const contact = {
        id: 'c1',
        tags: [{ id: 't1', user_id: 'u1', name: 'blocked lead', color: '#ef4444', created_at: '' }],
      };
      expect(isContactBlocked(contact)).toBe(true);
    });

    it('returns false when contact has other tags', () => {
      const contact = {
        id: 'c1',
        tags: [{ id: 't1', user_id: 'u1', name: 'Interested', color: '#10b981', created_at: '' }],
      };
      expect(isContactBlocked(contact)).toBe(false);
    });

    it('returns false when contact has no tags or is null', () => {
      expect(isContactBlocked(null)).toBe(false);
      expect(isContactBlocked({ id: 'c1' })).toBe(false);
      expect(isContactBlocked({ id: 'c1', tags: [] })).toBe(false);
    });
  });

  describe('checkIfContactIsBlocked', () => {
    it('returns true when contact_tags has blocked tag', async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'contact_tags') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              ilike: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue({ data: [{ id: 'ct1' }] }),
            };
          }
          return {};
        }),
      } as any;

      const result = await checkIfContactIsBlocked(mockSupabase, 'c1');
      expect(result).toBe(true);
    });

    it('returns true when contact_notes has [BLOCKED] marker', async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'contact_tags') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              ilike: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue({ data: [] }),
            };
          }
          if (table === 'contact_notes') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              ilike: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue({ data: [{ id: 'n1' }] }),
            };
          }
          return {};
        }),
      } as any;

      const result = await checkIfContactIsBlocked(mockSupabase, 'c1');
      expect(result).toBe(true);
    });

    it('returns false when neither tags nor notes match', async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          ilike: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [] }),
        })),
      } as any;

      const result = await checkIfContactIsBlocked(mockSupabase, 'c1');
      expect(result).toBe(false);
    });
  });
});
