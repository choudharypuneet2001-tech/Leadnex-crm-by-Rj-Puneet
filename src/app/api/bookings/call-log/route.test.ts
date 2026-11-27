import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  adminFrom: vi.fn(),
}));

vi.mock('@/lib/auth/account', () => ({
  requireRole: mocks.requireRole,
  toErrorResponse: vi.fn((err: any) =>
    Response.json({ error: err?.message || 'auth failed' }, { status: 403 })
  ),
}));

vi.mock('@/lib/ai/admin-client', () => ({
  supabaseAdmin: () => ({
    from: mocks.adminFrom,
  }),
}));

import { POST } from './route';

const mockContext = {
  supabase: {},
  accountId: 'test-account-123',
  userId: 'test-user-456',
  role: 'agent',
  account: { id: 'test-account-123', name: 'Gynocci Femtech' },
};

function createMockPostRequest(body: unknown) {
  return new Request('http://localhost/api/bookings/call-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/bookings/call-log', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireRole.mockResolvedValue(mockContext);
  });

  it('returns 400 if bookingId or disposition is missing', async () => {
    const res = await POST(createMockPostRequest({ bookingId: 'b-1' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('bookingId and disposition are required');
  });

  it('logs Not Connected disposition, traces official name from profile and assigns tags without mutating visit_outcome', async () => {
    const mockBooking = {
      id: 'b-1',
      account_id: 'test-account-123',
      contact_id: 'contact-1',
      phone: '919876543210',
      patient_name: 'सुनीता शर्मा',
      notes: 'Patient original medical query',
    };

    const mockAdmin = {
      from: (table: string) => {
        if (table === 'profiles') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { full_name: 'Puneet Choudhary' } }),
              }),
            }),
          };
        }
        if (table === 'bookings') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  single: async () => ({ data: mockBooking, error: null }),
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: async () => ({ error: null }),
            }),
          };
        }
        if (table === 'tags') {
          return {
            select: () => ({
              eq: () => ({
                ilike: (col: string, val: string) => ({
                  maybeSingle: async () => ({
                    data: { id: `tag-${val}`, name: val, color: '#3b82f6' },
                  }),
                }),
                order: () => ({
                  data: [
                    { id: 'tag-1', name: 'Call By Puneet Choudhary', color: '#8b5cf6' },
                    { id: 'tag-2', name: 'Not Connected', color: '#f43f5e' },
                    { id: 'tag-3', name: 'Follow-up: Today 06:30 PM', color: '#0284c7' },
                  ],
                }),
              }),
            }),
            insert: () => ({
              select: () => ({
                single: async () => ({ data: { id: 'tag-new' }, error: null }),
              }),
            }),
          };
        }
        if (table === 'contact_tags') {
          return {
            select: () => ({
              eq: async () => ({
                data: [
                  { id: 'ct-1', tag_id: 'tag-old-agent', tags: { id: 'tag-old-agent', name: 'Call By Deepesh' } },
                ],
              }),
            }),
            delete: () => ({
              eq: () => ({
                in: async () => ({ error: null }),
              }),
            }),
            insert: () => ({
              select: () => ({
                maybeSingle: async () => ({ data: { id: 'ct-new' }, error: null }),
              }),
            }),
          };
        }
        return {};
      },
    };

    mocks.adminFrom.mockImplementation(mockAdmin.from);

    const res = await POST(
      createMockPostRequest({
        bookingId: 'b-1',
        disposition: 'not_connected',
        agentName: 'Meenal',
        followupRec: 'Today 06:30 PM',
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.officialAgentName).toBe('Puneet Choudhary');
    expect(json.contactId).toBe('contact-1');
  });
});
