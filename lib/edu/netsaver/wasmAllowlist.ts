import { getWebllmPaths, getWebllmPathsForModelId } from "../llm/webllmConfig";

let cachedAllowlist: Set<string> | null = null;

const toAbsoluteUrl = (url: string) => {
  try {
    return new URL(url, window.location.href).href;
  } catch {
    return url;
  }
};

const readEnvUrl = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const getWasmAllowlist = () => {
  if (cachedAllowlist) return cachedAllowlist;
  const urls = [
    readEnvUrl(process.env.NEXT_PUBLIC_EDU_COACH_WASM_URL),
    readEnvUrl(process.env.NEXT_PUBLIC_COACH_WASM_URL),
    readEnvUrl(process.env.NEXT_PUBLIC_EDU_GENERATOR_PRIMARY_WASM_URL),
    readEnvUrl(process.env.NEXT_PUBLIC_GENERATOR_PRIMARY_WASM_URL),
    readEnvUrl(process.env.NEXT_PUBLIC_EDU_GENERATOR_FALLBACK_WASM_URL),
    readEnvUrl(process.env.NEXT_PUBLIC_GENERATOR_FALLBACK_WASM_URL),
  ];
  try {
    const primaryPaths = getWebllmPaths();
    urls.push(primaryPaths.wasmUrl);
    if (primaryPaths.fallbackModelId) {
      urls.push(getWebllmPathsForModelId(primaryPaths.fallbackModelId).wasmUrl);
    }
  } catch {
    // ignore invalid config
  }
  cachedAllowlist = new Set(urls.filter(Boolean).map((url) => toAbsoluteUrl(url as string)));
  return cachedAllowlist;
};
