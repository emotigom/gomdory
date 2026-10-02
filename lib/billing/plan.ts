const DEFAULT_FREE_QUOTA_MB = 512;
const DEFAULT_PRO_QUOTA_GB = 10;

const MB = 1024 * 1024;
const GB = 1024 * 1024 * 1024;

function parseEnvNumber(
  name: string,
  fallback: number,
  env: Record<string, string | undefined> = process.env,
): number {
  const raw = env[name];
  if (!raw || raw.trim().length === 0) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

export function getPlanQuotaBytes(env: Record<string, string | undefined> = process.env) {
  const freeLimitBytes = parseEnvNumber("FREE_STORAGE_LIMIT_BYTES", 0, env);
  const proLimitBytes = parseEnvNumber("PRO_STORAGE_LIMIT_BYTES", 0, env);
  const freeQuotaMb = parseEnvNumber("NEXT_PUBLIC_FREE_QUOTA_MB", DEFAULT_FREE_QUOTA_MB, env);
  const proQuotaGb = parseEnvNumber("NEXT_PUBLIC_PRO_QUOTA_GB", DEFAULT_PRO_QUOTA_GB, env);

  return {
    freeQuotaBytes: freeLimitBytes > 0 ? freeLimitBytes : freeQuotaMb * MB,
    proQuotaBytes: proLimitBytes > 0 ? proLimitBytes : proQuotaGb * GB,
  };
}

export function getFreeQuotaBytes(env: Record<string, string | undefined> = process.env): number {
  return getPlanQuotaBytes(env).freeQuotaBytes;
}

export function getProQuotaBytes(env: Record<string, string | undefined> = process.env): number {
  return getPlanQuotaBytes(env).proQuotaBytes;
}
