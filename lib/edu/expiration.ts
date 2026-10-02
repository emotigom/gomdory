const DEFAULT_EDU_PROJECT_TTL_DAYS = 30;

type EnvSource = Record<string, string | undefined>;

export function getEduProjectTtlDays(source: EnvSource = process.env) {
  const raw = source.EDU_PROJECT_TTL_DAYS;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_EDU_PROJECT_TTL_DAYS;
  }

  return parsed;
}

export function getEduProjectExpiresAt(
  now: Date = new Date(),
  ttlDays: number = getEduProjectTtlDays(),
) {
  const millis = ttlDays * 24 * 60 * 60 * 1000;
  return new Date(now.getTime() + millis).toISOString();
}
