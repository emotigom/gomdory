import { resolveWebllmConfig, type WebllmResolvedConfig, type WebllmResolvedSection } from "@/lib/edu/llm/webllmResolvedConfig";

export type WebllmCanonicalAssetSectionKind = "primary" | "fallback" | "coach";

export type WebllmCanonicalAssetSection = {
  kind: WebllmCanonicalAssetSectionKind;
  modelId: string;
  modelUrl: string;
  modelRootUrl: string;
  modelConfigUrl: string;
  wasmCandidateUrls: string[];
  selectedWasmUrl: string | null;
};

export type WebllmCanonicalAssetPlanStatusCode =
  | "WEBLLM_READY"
  | "WEBLLM_ENV_MISSING"
  | "WEBLLM_DERIVED_URL_INVALID";

export type WebllmCanonicalAssetPlan = {
  statusCode: WebllmCanonicalAssetPlanStatusCode;
  hasRequiredEnv: boolean;
  envSource: WebllmResolvedConfig["envSource"];
  missingKeys: string[];
  hardDisable: boolean;
  hardDisableRaw: string | undefined;
  resolvedConfig: WebllmResolvedConfig;
  primary: WebllmCanonicalAssetSection | null;
  fallback: WebllmCanonicalAssetSection | null;
  coach: WebllmCanonicalAssetSection | null;
  runtimeModelOrder: string[];
  invalidReasons: string[];
};

const ensureTrailingSlash = (value: string) => (value.endsWith("/") ? value : `${value}/`);

const safeParseUrl = (value: string): URL | null => {
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

const normalizeSection = (
  kind: WebllmCanonicalAssetSectionKind,
  section: WebllmResolvedSection | null,
): WebllmCanonicalAssetSection | null => {
  if (!section) return null;
  const modelUrl = ensureTrailingSlash(section.paths.modelUrl);
  return {
    kind,
    modelId: section.modelId,
    modelUrl,
    modelRootUrl: modelUrl,
    modelConfigUrl: `${modelUrl}mlc-chat-config.json`,
    wasmCandidateUrls: section.paths.wasmCandidates ?? (section.paths.wasmUrl ? [section.paths.wasmUrl] : []),
    selectedWasmUrl: section.paths.wasmCandidates?.[0] ?? section.paths.wasmUrl ?? null,
  };
};

const collectInvalidReasons = (plan: {
  primary: WebllmCanonicalAssetSection | null;
  fallback: WebllmCanonicalAssetSection | null;
  coach: WebllmCanonicalAssetSection | null;
  hasRequiredEnv: boolean;
}): string[] => {
  if (!plan.hasRequiredEnv) return [];

  const reasons: string[] = [];
  const sections = [plan.primary, plan.fallback, plan.coach].filter(
    (section): section is WebllmCanonicalAssetSection => Boolean(section),
  );

  for (const section of sections) {
    if (!safeParseUrl(section.modelConfigUrl)) {
      reasons.push(`${section.kind}:model_config_url_invalid`);
    }
    if (section.wasmCandidateUrls.length === 0) {
      reasons.push(`${section.kind}:wasm_candidates_missing`);
      continue;
    }
    for (const wasmCandidate of section.wasmCandidateUrls) {
      if (!safeParseUrl(wasmCandidate)) {
        reasons.push(`${section.kind}:wasm_url_invalid`);
      }
    }
  }

  return reasons;
};

export function resolveWebllmCanonicalAssetPlan(): WebllmCanonicalAssetPlan {
  const resolvedConfig = resolveWebllmConfig();
  const primary = normalizeSection("primary", resolvedConfig.primary);
  const fallback = normalizeSection("fallback", resolvedConfig.fallback);
  const coach = normalizeSection("coach", resolvedConfig.coach);
  const hasRequiredEnv = resolvedConfig.missingKeys.length === 0;
  const invalidReasons = collectInvalidReasons({
    primary,
    fallback,
    coach,
    hasRequiredEnv,
  });
  const runtimeModelOrder = [primary?.modelId, fallback?.modelId].filter(
    (modelId, index, items): modelId is string => Boolean(modelId) && items.indexOf(modelId) === index,
  );

  const statusCode: WebllmCanonicalAssetPlanStatusCode = !hasRequiredEnv
    ? "WEBLLM_ENV_MISSING"
    : invalidReasons.length > 0
      ? "WEBLLM_DERIVED_URL_INVALID"
      : "WEBLLM_READY";

  return {
    statusCode,
    hasRequiredEnv,
    envSource: resolvedConfig.envSource,
    missingKeys: [...resolvedConfig.missingKeys],
    hardDisable: resolvedConfig.hardDisable,
    hardDisableRaw: resolvedConfig.hardDisableRaw,
    resolvedConfig,
    primary,
    fallback,
    coach,
    runtimeModelOrder,
    invalidReasons,
  };
}
