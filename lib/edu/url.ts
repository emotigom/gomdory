export const DANGEROUS_SCHEME = /^(?:javascript|data|vbscript|file):/i;

export const isDangerousScheme = (value: string): boolean => DANGEROUS_SCHEME.test(value.trim());

export const ensureHttps = (value: string): string =>
  /^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`;

export const normalizeUrl = (raw: string): { ok: boolean; url?: string } => {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return { ok: false };
  if (isDangerousScheme(value)) return { ok: false };

  const candidate = ensureHttps(value);

  try {
    const parsed = new URL(candidate);
    if (isDangerousScheme(parsed.protocol)) return { ok: false };
    return { ok: true, url: parsed.toString() };
  } catch {
    return { ok: false };
  }
};
