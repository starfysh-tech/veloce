// app/(app)/approvals/[id]/actions-panel.tsx — client component. The three
// approver actions (approve / reject / request clarification). Server actions
// live in app/(app)/approvals/actions.ts which is step 8 work and does not
// exist yet — the imports below are stubbed so this file typechecks today.
'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui';
import {
  approveAward as approveAwardAction,
  rejectAward as rejectAwardAction,
  requestClarification as requestClarificationAction,
} from '@/app/(app)/approvals/actions';

// Thin client adapters: server actions take `committeeNote?: string`; the
// panel passes `string | null` (null = not required). Normalize here.
async function approveAward(args: {
  rfqId: string;
  ackedFlagIds: string[];
  committeeNote: string | null;
}): Promise<void> {
  await approveAwardAction({
    rfqId: args.rfqId,
    ackedFlagIds: args.ackedFlagIds,
    committeeNote: args.committeeNote ?? undefined,
  });
}
async function rejectAward(args: {
  rfqId: string;
  reason: string;
}): Promise<void> {
  await rejectAwardAction(args);
}
async function requestClarification(args: {
  rfqId: string;
  note: string;
}): Promise<void> {
  await requestClarificationAction(args);
}

type ActionKind = 'approve' | 'reject' | 'clarify';

export function ApprovalActions({
  rfqId,
  firmName,
  warnFlags,
  requiresCommitteeNote,
  awardRefForToast,
}: {
  rfqId: string;
  firmName: string;
  warnFlags: Array<{ id: string; text: string }>;
  requiresCommitteeNote: boolean;
  awardRefForToast: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState<ActionKind | null>(null);
  const [acked, setAcked] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const allAcked = warnFlags.every((f) => acked.has(f.id));
  const noteOk =
    !requiresCommitteeNote || note.trim().length >= 20;
  const canApprove = allAcked && noteOk && !pending;

  function toggleAck(id: string) {
    setAcked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function run(kind: ActionKind, fn: () => Promise<void>, successMsg: string) {
    setError(null);
    setSuccess(null);
    setSubmitting(kind);
    startTransition(async () => {
      try {
        await fn();
        setSuccess(successMsg);
        setNote('');
        setRejectReason('');
        setAcked(new Set());
        router.refresh();
      } catch (e) {
        // Next.js serializes server-action errors; the discriminating `name`
        // travels in the message for typed errors thrown server-side. The
        // server message itself is already user-friendly, so just check for
        // the sentinel substring.
        const msg = e instanceof Error ? e.message : 'Action failed';
        if (msg.includes('no longer awaiting approval')) {
          setError('RFQ has moved on. Refresh the page.');
        } else {
          setError(msg);
        }
      } finally {
        setSubmitting(null);
      }
    });
  }

  const noteLabel = requiresCommitteeNote
    ? 'Committee acknowledgement note (required, ≥20 chars)'
    : 'Optional note / clarification message';

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Approver actions</h3>
      <p className="sub" style={{ marginTop: 0 }}>
        Acting as <b>{firmName}</b> on <span className="mono">{awardRefForToast}</span>
      </p>

      {/* Warn-flag acknowledgements */}
      {warnFlags.length > 0 && (
        <>
          <div className="s-label">Acknowledge warnings ({acked.size}/{warnFlags.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
            {warnFlags.map((f) => (
              <label
                key={f.id}
                style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, lineHeight: 1.4 }}
              >
                <input
                  type="checkbox"
                  checked={acked.has(f.id)}
                  onChange={() => toggleAck(f.id)}
                  style={{ marginTop: 3 }}
                />
                <span>{f.text}</span>
              </label>
            ))}
          </div>
        </>
      )}

      {/* Note / clarification textarea */}
      <div style={{ marginBottom: 12 }}>
        <div className="s-label">{noteLabel}</div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          style={{ width: '100%', fontFamily: 'inherit', padding: 8 }}
          placeholder={
            requiresCommitteeNote
              ? 'Document committee sign-off (name, time, decision)…'
              : 'Optional — included with clarification requests…'
          }
        />
        {requiresCommitteeNote && !noteOk && note.length > 0 && (
          <div className="t-faint" style={{ fontSize: 11.5 }}>
            {note.trim().length} / 20 characters
          </div>
        )}
      </div>

      {/* Rejection reason */}
      <div style={{ marginBottom: 12 }}>
        <div className="s-label">Rejection reason (required to reject)</div>
        <textarea
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          rows={2}
          style={{ width: '100%', fontFamily: 'inherit', padding: 8 }}
          placeholder="Why is this award being rejected?"
        />
      </div>

      {/* Status messages */}
      {error && (
        <div className="flag flag-warn" style={{ marginBottom: 10 }}>
          <Icon name="alert" size={15} />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="flag flag-ok" style={{ marginBottom: 10 }}>
          <Icon name="check" size={15} />
          <span>{success}</span>
        </div>
      )}

      {/* Action buttons */}
      <div className="btn-row">
        <button
          type="button"
          className="btn btn-green"
          disabled={!canApprove || submitting !== null}
          onClick={() =>
            run(
              'approve',
              () =>
                approveAward({
                  rfqId,
                  ackedFlagIds: Array.from(acked),
                  committeeNote: requiresCommitteeNote ? note.trim() : null,
                }),
              `Approved ${awardRefForToast}`,
            )
          }
        >
          {submitting === 'approve' ? 'Approving…' : 'Approve'}
        </button>
        <button
          type="button"
          className="btn btn-red"
          disabled={
            rejectReason.trim().length === 0 || submitting !== null || pending
          }
          onClick={() =>
            run(
              'reject',
              () => rejectAward({ rfqId, reason: rejectReason.trim() }),
              `Rejected ${awardRefForToast}`,
            )
          }
        >
          {submitting === 'reject' ? 'Rejecting…' : 'Reject'}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={note.trim().length === 0 || submitting !== null || pending}
          onClick={() =>
            run(
              'clarify',
              () => requestClarification({ rfqId, note: note.trim() }),
              `Clarification requested on ${awardRefForToast}`,
            )
          }
        >
          {submitting === 'clarify' ? 'Sending…' : 'Request clarification'}
        </button>
      </div>
    </div>
  );
}
