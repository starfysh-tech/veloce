// lib/attachment-policy.ts — shared attachment limits safe for client imports.
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  'application/pdf',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const;

export const ALLOWED_ATTACHMENT_EXTENSIONS = ['pdf', 'csv', 'xlsx'] as const;

export const ATTACHMENT_ACCEPT = ALLOWED_ATTACHMENT_MIME_TYPES.join(',');

export function fmtBytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function attachmentExtension(filename: string): string | null {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext && ext !== filename.toLowerCase() ? ext : null;
}
