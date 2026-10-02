export function getPositiveEnvNumber(name: string, fallback: number): number {
  const value = process.env[name];

  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

export const boardImportDefaults = {
  zipMaxBytes: 30 * 1024 * 1024,
  totalMaxBytes: 60 * 1024 * 1024,
  fileMaxBytes: 15 * 1024 * 1024,
  maxFiles: 200,
  externalDownloadConcurrency: 3,
  externalDownloadTimeoutMs: 15000,
};
