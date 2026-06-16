// app/(app)/compliance/export/[rfqId]/route.ts — read-only best-ex JSON export.
// Route handlers do not inherit page role gates, so auth/tenant checks happen
// here before the bundle query. This endpoint never records a domain event.
import { NextResponse } from 'next/server';
import { resolveUser } from '@/lib/auth/caller';
import { getBestExBundle } from '@/lib/queries/compliance';

function filenamePart(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, '_');
}

export async function GET(_req: Request, { params }: { params: Promise<{ rfqId: string }> }) {
  const caller = await resolveUser();
  if (caller.kind !== 'user') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (caller.role !== 'compliance' && caller.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { rfqId } = await params;
  const bundle = await getBestExBundle(caller.firmId, rfqId);
  if (!bundle) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const body = JSON.stringify(bundle, null, 2);
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="best-ex-${filenamePart(bundle.rfq.publicRef)}.json"`,
    },
  });
}
