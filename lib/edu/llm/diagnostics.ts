export type GeneratorOverrideFlags = {
  forceFallback: boolean;
  forceTemplate: boolean;
};

const FORCE_FALLBACK_KEY = "edu:webllm:forceFallback";
const FORCE_TEMPLATE_KEY = "edu:webllm:forceTemplate";

const readFlag = (key: string) => {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
};

const writeFlag = (key: string, value: boolean) => {
  if (typeof window === "undefined") return;
  try {
    if (value) {
      window.sessionStorage.setItem(key, "1");
    } else {
      window.sessionStorage.removeItem(key);
    }
  } catch {
    // ignore storage failures
  }
};

export const getGeneratorOverrideFlags = (): GeneratorOverrideFlags => ({
  forceFallback: readFlag(FORCE_FALLBACK_KEY),
  forceTemplate: readFlag(FORCE_TEMPLATE_KEY),
});

export const setGeneratorOverrideFlags = (flags: GeneratorOverrideFlags) => {
  writeFlag(FORCE_FALLBACK_KEY, flags.forceFallback);
  writeFlag(FORCE_TEMPLATE_KEY, flags.forceTemplate);
};

export const clearGeneratorOverrideFlags = () => {
  writeFlag(FORCE_FALLBACK_KEY, false);
  writeFlag(FORCE_TEMPLATE_KEY, false);
};

export const clearEduLocalState = () => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem("edu:webllm:modelId");
    window.localStorage.removeItem("edu:webllm:teacher");
  } catch {
    // ignore storage failures
  }
  clearGeneratorOverrideFlags();
};
