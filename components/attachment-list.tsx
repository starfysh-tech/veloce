import type { AttachmentWithUrl } from '@/lib/storage';
import { fmtBytes } from '@/lib/attachment-policy';

export function AttachmentList({
  attachments,
  emptyText,
}: {
  attachments: AttachmentWithUrl[];
  emptyText: string;
}) {
  if (attachments.length === 0) return <div className="note">{emptyText}</div>;

  return (
    <div className="grid" style={{ gap: 8 }}>
      {attachments.map((a) => (
        <a key={a.id} className="checkrow" href={a.url} target="_blank" rel="noreferrer">
          <span style={{ fontWeight: 600 }}>{a.filename}</span>
          <span className="spacer" />
          <span className="note">{fmtBytes(a.sizeBytes)}</span>
        </a>
      ))}
    </div>
  );
}
