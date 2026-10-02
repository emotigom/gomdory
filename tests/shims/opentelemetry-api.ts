export const trace = {
  getTracer: () => ({
    startSpan: () => ({ end: () => {} }),
    startActiveSpan: (_name: string, fn: (span: { end: () => void }) => unknown) => fn({ end: () => {} }),
  }),
  setSpan: (_context: unknown, _span: unknown) => _context,
  getSpan: () => null,
};

export const context = {
  active: () => ({}),
  with: (_ctx: unknown, fn: () => unknown) => fn(),
  bind: (_ctx: unknown, value: unknown) => value,
  setValue: (_key: unknown, _value: unknown, ctx: unknown) => ctx,
  getValue: () => undefined,
  createContextKey: (name: string) => name,
};

export const createContextKey = (name: string) => name;

export const SpanStatusCode = { OK: 1, ERROR: 2, UNSET: 0 } as const;
export const propagation = { createBaggage: () => ({}) };
export const diag = { debug: () => {}, error: () => {}, info: () => {}, warn: () => {} };
