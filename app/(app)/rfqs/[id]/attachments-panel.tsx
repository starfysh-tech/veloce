'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AttachmentList } from '@/components/attachment-list';
import { ATTACHMENT_ACCEPT } from '@/lib/attachment-policy';
import type { AttachmentWithUrl } from '@/lib/storage';
import { uploadRfqAttachmentAction } from './actions';

export function AttachmentsPanel({
  rfqId,
  attachments,
  canUpload,
}: {
  rfqId: string;
  attachments: AttachmentWithUrl[];
  canUpload: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function upload() {
    const files = inputRef.current?.files;
    if (!files?.length) return;
    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append('attachments', file));
    setError(null);
    startTransition(async () => {
      try {
        await uploadRfqAttachmentAction(rfqId, formData);
        if (inputRef.current) inputRef.current.value = '';
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Attachment upload failed.');
      }
    });
  }

  return (
    <div className="card">
      <div className="row">
        <h3 style={{ margin: 0 }}>Attachments</h3>
        <span className="spacer" />
        <span className="note">PDF, CSV, XLSX · max 10 MB</span>
      </div>
      <hr className="hr" />
      <AttachmentList attachments={attachments} emptyText="No attachments uploaded." />
      {canUpload && (
        <div style={{ marginTop: 12 }}>
          <label className="fld">Add documents
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={ATTACHMENT_ACCEPT}
            />
          </label>
          {error && <div className="flag flag-warn" style={{ marginTop: 10 }}>{error}</div>}
          <div className="btn-row" style={{ marginTop: 10 }}>
            <button className="btn btn-primary" onClick={upload} disabled={pending}>
              {pending ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
