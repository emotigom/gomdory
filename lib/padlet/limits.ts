export function getPositiveEnvNumber(name: string, fallback: number): number {
  const value = process.env[name];

  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
}

export const padletImportDefaults = {
  csvMaxBytes: 20 * 1024 * 1024,
  zipMaxBytes: 20 * 1024 * 1024,
  totalMaxBytes: 20 * 1024 * 1024,
  maxEntries: 200,
};
