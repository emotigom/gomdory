type FingerprintOptions = {
  maxArrayItems?: number;
};

const DEFAULT_MAX_ARRAY_ITEMS = 3;

const normalizeArrayItem = (value: unknown) => (value === undefined ? null : value);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function fingerprintShape(value: unknown, opts: FingerprintOptions = {}): string {
  const maxArrayItems = opts.maxArrayItems ?? DEFAULT_MAX_ARRAY_ITEMS;
  const seen = new WeakSet<object>();

  const walk = (input: unknown): string => {
    if (input === null) return "null";
    if (input === undefined) return "undefined";
    if (typeof input === "string") return "string";
    if (typeof input === "number") return "number";
    if (typeof input === "boolean") return "boolean";

    if (Array.isArray(input)) {
      const items = input.slice(0, Math.max(0, maxArrayItems));
      const shapes = new Set(items.map((item) => walk(normalizeArrayItem(item))));
      const sorted = Array.from(shapes).sort();
      return `array<${sorted.join("|")}>`;
    }

    if (isRecord(input)) {
      if (seen.has(input)) {
        return "object<cycle>";
      }
      seen.add(input);
      const keys = Object.keys(input)
        .filter((key) => input[key] !== undefined)
        .sort();
      const entries = keys.map((key) => `${key}:${walk(input[key])}`);
      return `object{${entries.join(",")}}`;
    }

    return "unknown";
  };

  return walk(value);
}

export function hashFingerprint(fp: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < fp.length; i += 1) {
    hash ^= fp.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(6, "0");
}

export function computeContractHash(data: unknown): string {
  return hashFingerprint(fingerprintShape(data));
}
