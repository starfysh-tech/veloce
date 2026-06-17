import { describe, expect, it, vi } from 'vitest';
import type { Caller } from './auth/caller';

vi.mock('@/db', () => ({ db: {} }));
vi.mock('@/lib/record-event', () => ({ recordEvent: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createServiceRoleClient: vi.fn() }));

import {
  MAX_ATTACHMENT_BYTES,
  buildStoragePath,
  canReadRfqAttachments,
  canUploadRfqAttachment,
  sanitizeFilename,
  toAttachmentDto,
  validateAttachmentFile,
} from './storage';
import type { attachments } from '@/db/schema';

const owner: Caller = { kind: 'user', userId: 'u1', firmId: 'meridian', role: 'trader', label: 'Dana' };
const admin: Caller = { ...owner, role: 'admin' };
const approver: Caller = { ...owner, role: 'approver' };
const otherFirmUser: Caller = { kind: 'user', userId: 'u2', firmId: 'halcyon', role: 'trader', label: 'J.C.' };
const dealer: Caller = { kind: 'dealer', dealerFirmId: 'dealer-a', rfqId: 'rfq1', invitationId: 'i1', label: 'Dealer' };

const rfq = { id: 'rfq1', firmId: 'meridian', status: 'live', deadline: new Date(Date.now() + 60_000) };

describe('attachment access rules', () => {
  it('allows the owning firm user to read', () => {
    expect(canReadRfqAttachments(owner, rfq)).toBe(true);
  });

  it('denies a user from another firm', () => {
    expect(canReadRfqAttachments(otherFirmUser, rfq)).toBe(false);
  });

  it('allows a dealer scoped to the same RFQ', () => {
    expect(canReadRfqAttachments(dealer, rfq)).toBe(true);
  });

  it('denies a dealer scoped to another RFQ even if dealerFirmId matches nothing relevant', () => {
    expect(canReadRfqAttachments({ ...dealer, rfqId: 'rfq-other' }, rfq)).toBe(false);
  });

  it('denies anonymous callers', () => {
    expect(canReadRfqAttachments({ kind: 'anonymous' }, rfq)).toBe(false);
  });
});

describe('attachment upload rules', () => {
  it('allows trader and admin on an open owning-firm RFQ', () => {
    expect(canUploadRfqAttachment(owner, rfq)).toBe(true);
    expect(canUploadRfqAttachment(admin, rfq)).toBe(true);
  });

  it('denies non-trader/admin roles and dealers', () => {
    expect(canUploadRfqAttachment(approver, rfq)).toBe(false);
    expect(canUploadRfqAttachment(dealer, rfq)).toBe(false);
  });

  it('denies closed or expired RFQs', () => {
    expect(canUploadRfqAttachment(owner, { ...rfq, status: 'under_review' })).toBe(false);
    expect(canUploadRfqAttachment(owner, { ...rfq, deadline: new Date(Date.now() - 1) })).toBe(false);
  });
});

describe('attachment validation and DTOs', () => {
  it('accepts allowed MIME types under 10 MB', () => {
    expect(() => validateAttachmentFile({ name: 'terms.pdf', type: 'application/pdf', size: 10 })).not.toThrow();
    expect(() => validateAttachmentFile({ name: 'basket.csv', type: 'text/csv', size: 10 })).not.toThrow();
    expect(() => validateAttachmentFile({ name: 'basket.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 10 })).not.toThrow();
  });

  it('rejects empty, oversized, and unsupported files', () => {
    expect(() => validateAttachmentFile({ name: 'empty.pdf', type: 'application/pdf', size: 0 })).toThrow('empty');
    expect(() => validateAttachmentFile({ name: 'huge.pdf', type: 'application/pdf', size: MAX_ATTACHMENT_BYTES + 1 })).toThrow('10 MB');
    expect(() => validateAttachmentFile({ name: 'html.html', type: 'text/html', size: 10 })).toThrow('Unsupported');
  });

  it('sanitizes filenames and builds tenant/RFQ scoped paths', () => {
    expect(sanitizeFilename('../term sheet?.pdf')).toBe('..-term sheet.pdf');
    expect(buildStoragePath('firm1', 'rfq1', '../term sheet?.pdf', '00000000-0000-4000-8000-000000000000')).toBe('firm1/rfq1/00000000-0000-4000-8000-000000000000-..-term sheet.pdf');
  });

  it('maps rows to a safe DTO without path or firm fields', () => {
    const createdAt = new Date();
    const row = {
      id: 'a1', rfqId: 'rfq1', firmId: 'firm1', uploadedByUserId: 'u1',
      displayFilename: 'terms.pdf', storagePath: 'firm1/rfq1/a1-terms.pdf',
      mimeType: 'application/pdf', sizeBytes: 123, createdAt,
    } satisfies typeof attachments.$inferSelect;

    expect(toAttachmentDto(row)).toEqual({
      id: 'a1', filename: 'terms.pdf', mimeType: 'application/pdf', sizeBytes: 123, createdAt,
    });
  });
});
