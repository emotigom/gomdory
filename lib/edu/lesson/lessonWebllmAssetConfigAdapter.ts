import {
  getWebllmModelIds,
  getWebllmPaths,
  getWebllmPathsForModelId,
} from "@/lib/edu/llm/webllmConfig";

export type LessonWebllmAssetHealthState = {
  ok?: boolean;
  primary?: {
    modelConfigUrl?: string;
    selectedWasmUrl?: string | null;
    wasmCandidateUrls?: string[];
  } | null;
  coach?: {
    modelId?: string | null;
  } | null;
};

type LessonWebllmPathResolver = {
  getPaths: typeof getWebllmPaths;
  getPathsForModelId: typeof getWebllmPathsForModelId;
};

const defaultPathResolver: LessonWebllmPathResolver = {
  getPaths: getWebllmPaths,
  getPathsForModelId: getWebllmPathsForModelId,
};

export const resolveLessonWebllmAssetHostFromUrl = (value?: string | null) => {
  if (!value) return null;
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
};

export const resolveLessonWebllmAssetHosts = (input: {
  effectiveWebllmEnabled: boolean;
  preferredModelId: string | null;
  health: LessonWebllmAssetHealthState | null;
  pathResolver?: LessonWebllmPathResolver;
}) => {
  const { effectiveWebllmEnabled, preferredModelId, health, pathResolver = defaultPathResolver } = input;
  if (!effectiveWebllmEnabled) {
    return { modelHost: null, wasmHost: null };
  }

  try {
    const paths = preferredModelId
      ? pathResolver.getPathsForModelId(preferredModelId)
      : pathResolver.getPaths();
    return {
      modelHost: resolveLessonWebllmAssetHostFromUrl(paths.modelUrl),
      wasmHost: resolveLessonWebllmAssetHostFromUrl(paths.wasmUrl),
    };
  } catch {
    if (health?.ok !== true) {
      return { modelHost: null, wasmHost: null };
    }
    const modelHost = resolveLessonWebllmAssetHostFromUrl(health.primary?.modelConfigUrl ?? null);
    const wasmHost = resolveLessonWebllmAssetHostFromUrl(
      health.primary?.selectedWasmUrl ?? health.primary?.wasmCandidateUrls?.[0] ?? null,
    );
    return { modelHost, wasmHost };
  }
};

export const resolveLessonWebllmSelectionMetadata = (input: {
  effectiveWebllmEnabled: boolean;
  health: LessonWebllmAssetHealthState | null;
}) => {
  const { effectiveWebllmEnabled, health } = input;
  const fallbackModelId = (() => {
    if (!effectiveWebllmEnabled) return null;
    try {
      return getWebllmModelIds().fallbackModelId ?? null;
    } catch {
      return null;
    }
  })();

  const coachModelId =
    health?.coach?.modelId?.trim() ??
    process.env.NEXT_PUBLIC_EDU_WEBLLM_COACH_MODEL_ID?.trim() ??
    null;

  return {
    fallbackModelId,
    coachModelId,
  };
};
