// lib/storage.ts — RFQ attachment metadata + Supabase Storage access.
// Service-role Storage bypasses RLS, so every public helper authorizes against
// the RFQ before returning metadata or minting a signed URL.
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { attachments, rfqs } from '@/db/schema';
import type { Caller } from '@/lib/auth/caller';
import { requireEnv } from '@/lib/env';
import { recordEvent } from '@/lib/record-event';
import { createServiceRoleClient } from '@/lib/supabase/server';

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const SIGNED_URL_TTL_SECONDS = 300;
export const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  'application/pdf',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

export type AttachmentDto = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
};

export type AttachmentWithUrl = AttachmentDto & { url: string };

export type StagedAttachment = {
  id: string;
  rfqId: string;
  firmId: string;
  uploadedByUserId: string | null;
  displayFilename: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
};

type RfqForAttachment = {
  id: string;
  firmId: string;
  status?: string;
  deadline?: Date | string | null;
};

export function validateAttachmentFile(file: Pick<File, 'name' | 'type' | 'size'>) {
  if (file.size <= 0) throw new Error('Attachment is empty.');
  if (file.size > MAX_ATTACHMENT_BYTES) throw new Error('Attachment exceeds the 10 MB limit.');
  if (!ALLOWED_ATTACHMENT_MIME_TYPES.has(file.type)) {
    throw new Error('Unsupported attachment type. Upload a PDF, CSV, or XLSX file.');
  }
}

export function canReadRfqAttachments(caller: Caller, rfq: RfqForAttachment): boolean {
  return (
    (caller.kind === 'user' && caller.firmId === rfq.firmId) ||
    (caller.kind === 'dealer' && caller.rfqId === rfq.id)
  );
}

export function canUploadRfqAttachment(caller: Caller, rfq: RfqForAttachment, now = Date.now()): boolean {
  if (caller.kind !== 'user') return false;
  if (caller.firmId !== rfq.firmId) return false;
  if (caller.role !== 'trader' && caller.role !== 'admin') return false;
  if (rfq.status !== 'live' || !rfq.deadline) return false;
  return new Date(rfq.deadline).getTime() > now;
}

export function sanitizeFilename(filename: string): string {
  const cleaned = filename
    .replace(/[/\\]/g, '-')
    .replace(/[^a-zA-Z0-9._ -]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || 'attachment';
}

export function buildStoragePath(firmId: string, rfqId: string, filename: string, uuid = randomUUID()): string {
  return `${firmId}/${rfqId}/${uuid}-${sanitizeFilename(filename)}`;
}

export function toAttachmentDto(row: typeof attachments.$inferSelect): AttachmentDto {
  return {
    id: row.id,
    filename: row.displayFilename,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    createdAt: row.createdAt,
  };
}

function bucketName(): string {
  return requireEnv('SUPABASE_STORAGE_BUCKET');
}

async function uploadObject(path: string, file: File): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.storage
    .from(bucketName())
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(`Attachment upload failed: ${error.message}`);
}

export async function cleanupStagedAttachments(staged: Pick<StagedAttachment, 'storagePath'>[]): Promise<void> {
  if (!staged.length) return;
  const supabase = createServiceRoleClient();
  const { error } = await supabase.storage
    .from(bucketName())
    .remove(staged.map((a) => a.storagePath));
  if (error) console.warn('Attachment cleanup failed', { error: error.message });
}

export async function stageAttachmentUpload(args: {
  firmId: string;
  rfqId: string;
  uploadedByUserId: string | null;
  file: File;
}): Promise<StagedAttachment> {
  validateAttachmentFile(args.file);
  const id = randomUUID();
  const displayFilename = sanitizeFilename(args.file.name);
  const storagePath = buildStoragePath(args.firmId, args.rfqId, displayFilename);
  await uploadObject(storagePath, args.file);
  return {
    id,
    rfqId: args.rfqId,
    firmId: args.firmId,
    uploadedByUserId: args.uploadedByUserId,
    displayFilename,
    storagePath,
    mimeType: args.file.type,
    sizeBytes: args.file.size,
  };
}

export async function uploadAttachment(caller: Caller, rfqId: string, file: File): Promise<AttachmentDto> {
  const rfq = await db.query.rfqs.findFirst({ where: eq(rfqs.id, rfqId) });
  if (!rfq) throw new Error('RFQ not found.');
  if (!canUploadRfqAttachment(caller, rfq)) throw new Error('You cannot upload attachments for this RFQ.');
  if (caller.kind !== 'user') throw new Error('Only users can upload attachments.');

  const staged = await stageAttachmentUpload({
    firmId: rfq.firmId,
    rfqId: rfq.id,
    uploadedByUserId: caller.userId,
    file,
  });

  try {
    await recordEvent(
      { kind: 'user', userId: caller.userId, label: caller.label },
      {
        firmId: rfq.firmId,
        rfqId: rfq.id,
        type: 'attachment_added',
        summary: `Added attachment — ${staged.displayFilename}`,
        detail: {
          attachmentId: staged.id,
          filename: staged.displayFilename,
          mimeType: staged.mimeType,
          sizeBytes: staged.sizeBytes,
        },
      },
      async (tx) => {
        await tx.insert(attachments).values(staged);
      },
    );
  } catch (e) {
    await cleanupStagedAttachments([staged]);
    throw e;
  }

  const row = await db.query.attachments.findFirst({ where: eq(attachments.id, staged.id) });
  if (!row) throw new Error('Attachment metadata was not saved.');
  return toAttachmentDto(row);
}

export async function listAttachments(caller: Caller, rfqId: string): Promise<AttachmentDto[]> {
  const rfq = await db.query.rfqs.findFirst({ where: eq(rfqs.id, rfqId) });
  if (!rfq || !canReadRfqAttachments(caller, rfq)) return [];

  const rows = await db
    .select()
    .from(attachments)
    .where(and(eq(attachments.rfqId, rfqId), eq(attachments.firmId, rfq.firmId)));
  return rows.map(toAttachmentDto);
}

export async function signedUrl(caller: Caller, attachmentId: string): Promise<string | null> {
  const attachment = await db.query.attachments.findFirst({ where: eq(attachments.id, attachmentId) });
  if (!attachment) return null;

  const rfq = await db.query.rfqs.findFirst({ where: eq(rfqs.id, attachment.rfqId) });
  if (!rfq || attachment.firmId !== rfq.firmId || !canReadRfqAttachments(caller, rfq)) return null;

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.storage
    .from(bucketName())
    .createSignedUrl(attachment.storagePath, SIGNED_URL_TTL_SECONDS);
  if (error) throw new Error(`Could not sign attachment URL: ${error.message}`);
  return data.signedUrl;
}

export async function listAttachmentsWithUrls(caller: Caller, rfqId: string): Promise<AttachmentWithUrl[]> {
  const rows = await listAttachments(caller, rfqId);
  const withUrls = await Promise.all(rows.map(async (row) => {
    const url = await signedUrl(caller, row.id);
    return url ? { ...row, url } : null;
  }));
  return withUrls.filter((row): row is AttachmentWithUrl => row !== null);
}
