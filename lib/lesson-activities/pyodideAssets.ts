export const PYODIDE_VERSION = "0.26.4";
export const DEFAULT_PYODIDE_BASE_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

const SAFE_PYODIDE_BASE_URL_PATTERN = /^(https?:\/\/|\/)(?!\/)/i;

export function normalizePyodideBaseUrl(rawBaseUrl?: string | null): string {
  const trimmed = rawBaseUrl?.trim();
  const candidate = trimmed && SAFE_PYODIDE_BASE_URL_PATTERN.test(trimmed) ? trimmed : DEFAULT_PYODIDE_BASE_URL;
  return candidate.endsWith("/") ? candidate : `${candidate}/`;
}

export function getConfiguredPyodideBaseUrl(): string {
  return normalizePyodideBaseUrl(process.env.NEXT_PUBLIC_PYODIDE_BASE_URL ?? process.env.PYODIDE_BASE_URL);
}

export type PyodideAssetPaths = {
  baseUrl: string;
  loaderUrl: string;
};

export function getPyodideAssetPaths(rawBaseUrl?: string | null): PyodideAssetPaths {
  const baseUrl = normalizePyodideBaseUrl(rawBaseUrl);
  return {
    baseUrl,
    loaderUrl: `${baseUrl}pyodide.js`,
  };
}
