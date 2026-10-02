export const MONACO_VERSION = "0.52.2";
export const DEFAULT_MONACO_BASE_URL = `https://cdn.jsdelivr.net/npm/monaco-editor@${MONACO_VERSION}/min/vs/`;

const SAFE_MONACO_BASE_URL_PATTERN = /^(https?:\/\/|\/)(?!\/)/i;

export function normalizeMonacoBaseUrl(rawBaseUrl?: string | null): string {
  const trimmed = rawBaseUrl?.trim();
  const candidate = trimmed && SAFE_MONACO_BASE_URL_PATTERN.test(trimmed) ? trimmed : DEFAULT_MONACO_BASE_URL;
  return candidate.endsWith("/") ? candidate : `${candidate}/`;
}

export function getConfiguredMonacoBaseUrl(): string {
  return normalizeMonacoBaseUrl(process.env.NEXT_PUBLIC_MONACO_BASE_URL ?? process.env.MONACO_BASE_URL);
}

export type MonacoAssetPaths = {
  baseUrl: string;
  loaderUrl: string;
  workerMainUrl: string;
  amdVsPath: string;
};

export function getMonacoAssetPaths(rawBaseUrl?: string | null): MonacoAssetPaths {
  const baseUrl = normalizeMonacoBaseUrl(rawBaseUrl);
  return {
    baseUrl,
    loaderUrl: `${baseUrl}loader.js`,
    workerMainUrl: `${baseUrl}base/worker/workerMain.js`,
    amdVsPath: baseUrl.replace(/\/$/, ""),
  };
}
