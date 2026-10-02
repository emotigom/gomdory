const serverOnlyWebLLMError = () => {
  throw new Error("@mlc-ai/web-llm is a browser-only dependency and must not run in the server worker bundle.");
};

export const prebuiltAppConfig = { model_list: [] };
export const modelLibURLPrefix = "";
export const modelVersion = "server-stub";
export const functionCallingModelIds: string[] = [];

export const CreateMLCEngine = serverOnlyWebLLMError;
export const CreateWebWorkerMLCEngine = serverOnlyWebLLMError;
export const CreateServiceWorkerMLCEngine = serverOnlyWebLLMError;
export const CreateExtensionServiceWorkerMLCEngine = serverOnlyWebLLMError;

export class MLCEngine {
  constructor() {
    serverOnlyWebLLMError();
  }
}

export class WebWorkerMLCEngine extends MLCEngine {}
export class ServiceWorkerMLCEngine extends MLCEngine {}
export class ExtensionServiceWorkerMLCEngine extends MLCEngine {}
export class WebWorkerMLCEngineHandler {}
export class ServiceWorkerMLCEngineHandler {}
export class ExtensionServiceWorkerMLCEngineHandler {}
export class Chat {}
export class Completions {}
export class Embeddings {}

export const ModelType = {};
export const ChatCompletionRequestUnsupportedFields = [];

export const deleteChatConfigInCache = serverOnlyWebLLMError;
export const deleteModelAllInfoInCache = serverOnlyWebLLMError;
export const deleteModelInCache = serverOnlyWebLLMError;
export const deleteModelWasmInCache = serverOnlyWebLLMError;
export const hasModelInCache = serverOnlyWebLLMError;
export const postInitAndCheckFieldsChatCompletion = serverOnlyWebLLMError;
export const postInitAndCheckFieldsCompletion = serverOnlyWebLLMError;
export const postInitAndCheckFieldsEmbedding = serverOnlyWebLLMError;
