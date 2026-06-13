// app/(app)/rfqs/[id]/board/route.ts — read endpoint for the masked board.
// The client hits this on a Realtime signal to re-fetch through the server
// projection (Decision 18). Never returns raw competitor data to a dealer.
import { NextResponse } from 'next/server';
import { resolveUser } from '@/lib/auth/caller';
import { getBoard } from '@/lib/queries/board';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const caller = await resolveUser();
  if (caller.kind !== 'user') return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const data = await getBoard(caller, id);
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  return NextResponse.json({
    board: data.board,
    comparison: data.comparison,
    award: data.award,
  });
}
