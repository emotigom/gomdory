export const OPS_BANNER_LEVELS = ["info", "warning", "maintenance"] as const;

export type OpsBannerLevel = (typeof OPS_BANNER_LEVELS)[number];

export type OpsBannerInput = {
  message?: string | null;
  href?: string | null;
  label?: string | null;
  enabled?: boolean;
  level?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
};

export type NormalizedOpsBanner = {
  message: string;
  href: string | null;
  label: string | null;
  enabled: boolean;
  level: OpsBannerLevel;
  startsAt: string | null;
  endsAt: string | null;
};

function normalizeDateTime(value?: string | null): string | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.valueOf())) return null;
  return parsed.toISOString();
}

export function normalizeBannerLevel(level?: string | null): OpsBannerLevel {
  if (level === "warning" || level === "maintenance") {
    return level;
  }
  return "info";
}

export function normalizeBannerHref(rawHref?: string | null): string | null {
  const candidate = (rawHref ?? "").trim();
  if (!candidate) return null;

  if (candidate.startsWith("/")) {
    return candidate;
  }

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function normalizeOpsBannerInput(input: OpsBannerInput): NormalizedOpsBanner {
  const message = (input.message ?? "").trim();
  const href = normalizeBannerHref(input.href);
  const rawLabel = (input.label ?? "").trim();
  const label = href ? rawLabel || "자세히" : null;
  const hasMessage = message.length > 0;
  const startsAt = normalizeDateTime(input.startsAt);
  const endsAt = normalizeDateTime(input.endsAt);

  return {
    message,
    href,
    label,
    enabled: Boolean(input.enabled) && hasMessage,
    level: normalizeBannerLevel(input.level),
    startsAt,
    endsAt,
  };
}
