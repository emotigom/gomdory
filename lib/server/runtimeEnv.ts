export type RuntimeEnv = Record<string, unknown>;

export function getRuntimeEnv(): RuntimeEnv {
  const cf = (globalThis as { __CLOUDFLARE_ENV__?: unknown }).__CLOUDFLARE_ENV__;
  if (cf && typeof cf === "object") {
    return cf as RuntimeEnv;
  }
  // eslint-disable-next-line no-restricted-properties -- runtime fallback for Node.js envs
  const pe = typeof process !== "undefined" ? (process.env as unknown) : undefined;
  return (pe && typeof pe === "object" ? pe : {}) as RuntimeEnv;
}

export function readEnvStringFrom(source: RuntimeEnv, key: string): string | undefined {
  const value = source[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function readEnvString(key: string): string | undefined {
  return readEnvStringFrom(getRuntimeEnv(), key);
}

export function hasEnvString(key: string, source: RuntimeEnv = getRuntimeEnv()): boolean {
  return Boolean(readEnvStringFrom(source, key));
}

export function readFirstEnvString(
  keys: readonly string[],
  source: RuntimeEnv = getRuntimeEnv(),
): string | undefined {
  for (const key of keys) {
    const value = readEnvStringFrom(source, key);
    if (value) return value;
  }
  return undefined;
}

export function buildMissingEnvKeys(
  requiredKeys: readonly string[],
  options?: {
    allowAnyGroups?: readonly (readonly string[])[];
    source?: RuntimeEnv;
  },
): string[] {
  const source = options?.source ?? getRuntimeEnv();
  const allowAnyGroups = options?.allowAnyGroups ?? [];
  const missing: string[] = [];
  const allowAnyFlat = new Set(allowAnyGroups.flat());

  for (const group of allowAnyGroups) {
    const anyPresent = group.some((key) => hasEnvString(key, source));
    if (!anyPresent) {
      missing.push(...group);
    }
  }

  for (const key of requiredKeys) {
    if (allowAnyFlat.has(key)) continue;
    if (!hasEnvString(key, source)) {
      missing.push(key);
    }
  }

  return missing;
}
