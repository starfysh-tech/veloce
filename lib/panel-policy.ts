// Shared panel/dealer-selection rules used by Create RFQ and Admin panel config.
export const MIN_RFQ_DEALERS = 3;

export function hasUniqueIds(ids: readonly string[]): boolean {
  return new Set(ids).size === ids.length;
}
