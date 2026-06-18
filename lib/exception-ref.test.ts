import { describe, expect, it } from 'vitest';
import { nextExceptionRef } from './exception-ref';

describe('nextExceptionRef', () => {
  it('extracts the fixed-width numeric suffix without binding substring positions', async () => {
    let query: unknown;
    const tx = {
      execute: async (q: unknown) => {
        query = q;
        return [{ max_seq: 1 }];
      },
    };

    const ref = await nextExceptionRef(tx as never, 'firm-1', 2026);

    expect(ref).toBe('EX-2026-0002');
    const chunks = (query as { queryChunks?: unknown[] }).queryChunks ?? [];
    expect(chunks.some((chunk) => chunk === 9)).toBe(false);
  });
});
