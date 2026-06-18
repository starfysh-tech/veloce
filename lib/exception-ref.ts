// lib/exception-ref.ts — firm-scoped sequence helper for exceptions.ref.
// Mirrors the inline VEL-YYYY-NNNN helper in app/(app)/rfqs/new/actions.ts:
// snapshot the current MAX(seq) for (firm_id, year) inside the caller's tx, +1.
// Refs are fixed-width (`EX-YYYY-NNNN`), so parse the rightmost four chars.
// The exceptions_firm_ref_uniq index is defense-in-depth against collisions.
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { exceptions } from '@/db/schema';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function pad4(n: number): string {
  return String(n).padStart(4, '0');
}

/**
 * Reserve the next exception ref for a firm-year. Must be called inside the
 * transaction that performs the insert, so the snapshot stays consistent.
 *
 * @param tx     active drizzle transaction
 * @param firmId firm scope for the sequence
 * @param year   four-digit year (typically `new Date().getFullYear()`)
 * @returns ref in the form `EX-YYYY-NNNN`
 */
export async function nextExceptionRef(
  // Drizzle transaction type — matches the shape recordEvent's apply receives.
  tx: Tx,
  firmId: string,
  year: number,
): Promise<string> {
  const refPrefix = `EX-${year}-`;
  const rows = await tx.execute<{ max_seq: number | null }>(
    sql`select max(cast(right(${exceptions.ref}, 4) as int)) as max_seq
        from ${exceptions}
        where ${exceptions.firmId} = ${firmId} and ${exceptions.ref} like ${refPrefix + '%'}`,
  );
  const maxSeq = rows[0]?.max_seq ?? 0;
  return refPrefix + pad4(maxSeq + 1);
}
