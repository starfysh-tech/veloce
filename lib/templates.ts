// RFQ wizard templates. MVP scope: ship `put` only (the most common product
// in seed). The 4 other template strings (collar, put-spread, var, overlay)
// still appear on seeded RFQ rows so the blotter/detail/quote pages render
// them correctly — they're just not constructable from the wizard yet.

export type TemplateId = 'put';

export type Template = {
  id: TemplateId;
  name: string; // wizard-facing template name
  product: string; // rfqs.product label (matches db/seed-data.ts strings)
  defaultFields: string; // freeform list for UI hint
  defaultWindow: string; // e.g. "30 min"
  defaultWindowMinutes: number;
  defaultSide: string;
  defaultQuoteUnit: string;
};

export const TEMPLATES: readonly Template[] = [
  {
    id: 'put',
    name: 'Index Put Hedge',
    product: 'Equity Put Option',
    defaultFields: 'Underlying · Strike % · Tenor · Style · Settlement',
    defaultWindow: '30 min',
    defaultWindowMinutes: 30,
    defaultSide: 'Buy protection',
    defaultQuoteUnit: '% of notional',
  },
] as const;

export function getTemplate(id: TemplateId): Template {
  const t = TEMPLATES.find((x) => x.id === id);
  if (!t) throw new Error(`Unknown template id: ${id}`);
  return t;
}
