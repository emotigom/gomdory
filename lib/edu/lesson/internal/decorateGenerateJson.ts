import { decoratePlanJsonSchema } from "@/lib/edu/llm/responseSchemas";
import type { LocalChatMessage, WebLLMWorkerResponse } from "@/lib/edu/llm/webllmWorkerTypes";

const DECORATE_CONTEXT_TOKEN = Symbol("decorate.generateJson.context");
let activeDecorateContext: symbol | null = null;

export async function withDecorateGenerateJsonContext<T>(fn: () => Promise<T>): Promise<T> {
  const previous = activeDecorateContext;
  activeDecorateContext = DECORATE_CONTEXT_TOKEN;
  try {
    return await fn();
  } finally {
    activeDecorateContext = previous;
  }
}

export type DecorateGenerateJsonResult =
  | { ok: true; response: WebLLMWorkerResponse }
  | { ok: false; reason: "decorate_generateJson_bypass"; response: WebLLMWorkerResponse | null };

export async function generateDecoratePlanJson(params: {
  requestId: string;
  userPrompt: string;
  slotType: string;
  timeoutMs: number;
  modelId?: string;
  maxTokens: number;
  signal?: AbortSignal;
  startWebLLM: (
    requestId: string,
    input: {
      kind: "generateJson";
      messages: LocalChatMessage[];
      temperature: number;
      schema: Record<string, unknown>;
      timeoutMs: number;
      maxTokens: number;
      preferredModelId?: string;
      useResponseFormat: true;
      signal?: AbortSignal;
    },
  ) => Promise<WebLLMWorkerResponse>;
}): Promise<DecorateGenerateJsonResult> {
  if (activeDecorateContext !== DECORATE_CONTEXT_TOKEN) {
    if (process.env.NODE_ENV !== "production") {
      throw new Error("decorate_generateJson_bypass");
    }
    return { ok: false, reason: "decorate_generateJson_bypass", response: null };
  }

  const response = await params.startWebLLM(params.requestId, {
    kind: "generateJson",
    messages: [
      {
        role: "system",
        content:
          "JSON only. Return DecoratePlan DSL v1. Use slot target primarily. Allowed ops: insert_media, add_caption, emphasize_heading, add_callout_box, tidy_spacing, set_surface_background.",
      },
      {
        role: "user",
        content: `요청=${params.userPrompt}\nslotType=${params.slotType}`,
      },
    ],
    temperature: 0,
    schema: decoratePlanJsonSchema(),
    timeoutMs: params.timeoutMs,
    maxTokens: params.maxTokens,
    preferredModelId: params.modelId,
    useResponseFormat: true,
    signal: params.signal,
  });

  return { ok: true, response };
}
