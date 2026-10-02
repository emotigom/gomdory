export const WEBLLM_MODEL_CONFIG_FILENAME = "mlc-chat-config.json";
const WEBLLM_DEFAULT_MODEL_SUBDIR = "resolve/main";
const WEBLLM_DEFAULT_WASM_FILENAME = "webllm-model.wasm";

type WebLLMAssetResolverEnv = {
  modelBase: string;
  modelSubdir?: string;
  libBase: string;
  coachWasmFilename?: string;
};

const normalizeBaseUrl = (value: string) => value.trim().replace(/\/+$/, "");

const normalizePathSegment = (value: string) => value.trim().replace(/^\/+|\/+$/g, "");

const normalizeModelId = (value: string) => normalizePathSegment(value);

export const createWebllmAssetResolver = (env: WebLLMAssetResolverEnv) => {
  const modelBase = normalizeBaseUrl(env.modelBase);
  const libBase = normalizeBaseUrl(env.libBase);
  const modelSubdir = normalizePathSegment(env.modelSubdir ?? WEBLLM_DEFAULT_MODEL_SUBDIR);
  const coachWasmFilename = env.coachWasmFilename?.trim();

  const modelConfigUrl = (modelId: string) =>
    `${modelBase}/${normalizeModelId(modelId)}/${modelSubdir}/${WEBLLM_MODEL_CONFIG_FILENAME}`;

  const wasmCandidates = (modelId: string) => [
    `${libBase}/${normalizeModelId(modelId)}/${normalizeModelId(modelId)}.wasm`,
    `${libBase}/${WEBLLM_DEFAULT_WASM_FILENAME}`,
  ];

  const coachWasmUrl = () =>
    coachWasmFilename ? `${libBase}/${normalizePathSegment(coachWasmFilename)}` : null;

  return {
    modelBase,
    libBase,
    modelSubdir,
    modelConfigUrl,
    wasmCandidates,
    coachWasmUrl,
  };
};

export const getWebllmModelRootUrl = (modelConfigUrl: string) => {
  if (!modelConfigUrl) return "";
  if (modelConfigUrl.endsWith(WEBLLM_MODEL_CONFIG_FILENAME)) {
    return modelConfigUrl.slice(0, -WEBLLM_MODEL_CONFIG_FILENAME.length);
  }
  return modelConfigUrl;
};
