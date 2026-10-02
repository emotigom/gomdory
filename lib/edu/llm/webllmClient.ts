import type * as webllm from "@mlc-ai/web-llm";

export type WebLLMChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type StreamTextOptions = {
  engine: webllm.MLCEngine;
  messages: WebLLMChatMessage[];
  temperature?: number;
  onDelta: (delta: string) => void;
  signal?: AbortSignal;
};

export type GenerateJsonOptions = {
  engine: webllm.MLCEngine;
  messages: WebLLMChatMessage[];
  temperature?: number;
  schema?: Record<string, unknown>;
  signal?: AbortSignal;
  useResponseFormat?: boolean;
  maxTokens?: number;
};

export type CompleteTextOptions = {
  engine: webllm.MLCEngine;
  messages: WebLLMChatMessage[];
  temperature?: number;
  signal?: AbortSignal;
};

export type CompleteTextResult = {
  content: string;
};

export type GenerateJsonResult = {
  data: unknown;
  rawText: string;
  usedResponseFormat: boolean;
  usedFallback: boolean;
};

type ChatCompletionRequestWithSignal<T extends webllm.ChatCompletionRequestBase> = T & {
  signal?: AbortSignal;
};

const SYNTHETIC_USER_MESSAGE = "계속 진행해 주세요.";
const JSON_ONLY_INSTRUCTION = "다음 지시에 맞춰 JSON 객체만 출력하세요.";
const JSON_REPAIR_INSTRUCTION = "아래 출력이 JSON이 아닙니다. 유효한 JSON 객체로만 다시 작성하세요.";

let responseFormatAvailability: "unknown" | "supported" | "unsupported" = "unknown";

export async function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener("abort", onAbort);
    }
  }
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fn(controller.signal);
  } finally {
    globalThis.clearTimeout(timeoutId);
    if (signal) {
      signal.removeEventListener("abort", onAbort);
    }
  }
}

function normalizeMessages(messages: WebLLMChatMessage[]) {
  if (!messages.length) {
    throw new Error("메시지가 비어 있어요. system/user 메시지를 포함해 주세요.");
  }

  const hasInvalidSystemMessage =
    messages[0]?.role !== "system" || messages.slice(1).some((message) => message.role === "system");
  if (hasInvalidSystemMessage) {
    throw new Error("system 메시지는 첫 번째이며, 1개만 포함되어야 합니다.");
  }

  const normalized = [...messages];
  const last = normalized[normalized.length - 1];
  if (!last || last.role !== "user") {
    normalized.push({ role: "user", content: SYNTHETIC_USER_MESSAGE });
  }

  return normalized;
}

function buildJsonInstruction(schema?: Record<string, unknown>) {
  if (!schema) {
    return `${JSON_ONLY_INSTRUCTION} 반드시 유효한 JSON 객체만 반환하세요.`;
  }

  return [
    JSON_ONLY_INSTRUCTION,
    "아래 JSON 스키마를 참고해서 정확히 일치하는 JSON 객체만 출력하세요.",
    "```json",
    JSON.stringify(schema, null, 2),
    "```",
  ].join("\n");
}

function parseJsonFromText(text: string) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        const candidate = text.slice(start, end + 1);
        return { ok: true, value: JSON.parse(candidate) };
      } catch {
        // keep fallback
      }
    }
  }
  return { ok: false, value: null };
}

async function requestJsonWithResponseFormat(options: GenerateJsonOptions) {
  const responseFormat: webllm.ResponseFormat = options.schema
    ? { type: "json_object", schema: JSON.stringify(options.schema) }
    : { type: "json_object" };

  const completion = await options.engine.chat.completions.create({
    messages: [...options.messages, { role: "user", content: buildJsonInstruction(options.schema) }],
    temperature: options.temperature ?? 0.2,
    stream: false,
    response_format: responseFormat,
    signal: options.signal,
    max_tokens: options.maxTokens,
  } as ChatCompletionRequestWithSignal<webllm.ChatCompletionRequestNonStreaming>);

  const rawText = completion?.choices?.[0]?.message?.content ?? "";
  const parsed = parseJsonFromText(rawText);
  if (!parsed.ok) {
    throw new Error("response_format 응답을 JSON으로 파싱하지 못했어요.");
  }

  return {
    data: parsed.value,
    rawText,
    usedResponseFormat: true,
    usedFallback: false,
  } satisfies GenerateJsonResult;
}

async function requestJsonWithFallback(options: GenerateJsonOptions): Promise<GenerateJsonResult> {
  const instruction = buildJsonInstruction(options.schema);
  const completion = await options.engine.chat.completions.create({
    messages: [...options.messages, { role: "user", content: instruction }],
    temperature: options.temperature ?? 0.2,
    stream: false,
    signal: options.signal,
    max_tokens: options.maxTokens,
  } as ChatCompletionRequestWithSignal<webllm.ChatCompletionRequestNonStreaming>);

  const rawText = completion?.choices?.[0]?.message?.content ?? "";
  const parsed = parseJsonFromText(rawText);
  if (parsed.ok) {
    return { data: parsed.value, rawText, usedResponseFormat: false, usedFallback: true };
  }

  const repairCompletion = await options.engine.chat.completions.create({
    messages: [
      ...options.messages,
      { role: "user", content: instruction },
      { role: "user", content: `${JSON_REPAIR_INSTRUCTION}\n\n${rawText}` },
    ],
    temperature: options.temperature ?? 0.2,
    stream: false,
    signal: options.signal,
    max_tokens: options.maxTokens,
  } as ChatCompletionRequestWithSignal<webllm.ChatCompletionRequestNonStreaming>);

  const repairedText = repairCompletion?.choices?.[0]?.message?.content ?? "";
  const repaired = parseJsonFromText(repairedText);
  if (!repaired.ok) {
    throw new Error("JSON 응답을 파싱하지 못했어요. 다시 시도해 주세요.");
  }

  return { data: repaired.value, rawText: repairedText, usedResponseFormat: false, usedFallback: true };
}

export async function streamText(options: StreamTextOptions) {
  if (options.signal?.aborted) {
    throw new Error("요청이 취소되었습니다.");
  }

  const messages = normalizeMessages(options.messages);
  const stream = (await options.engine.chat.completions.create({
    messages,
    temperature: options.temperature ?? 0.7,
    stream: true,
    signal: options.signal,
  } as ChatCompletionRequestWithSignal<webllm.ChatCompletionRequestStreaming>)) as AsyncIterable<{
    choices?: Array<{ delta?: { content?: string } }>;
  }>;

  for await (const chunk of stream) {
    if (options.signal?.aborted) {
      throw new Error("요청이 취소되었습니다.");
    }
    const delta = chunk?.choices?.[0]?.delta?.content;
    if (delta) {
      options.onDelta(delta);
    }
  }
}

export async function generateJson(options: GenerateJsonOptions): Promise<GenerateJsonResult> {
  if (options.signal?.aborted) {
    throw new Error("요청이 취소되었습니다.");
  }

  const messages = normalizeMessages(options.messages);
  const baseOptions = { ...options, messages };

  const allowResponseFormat = options.useResponseFormat !== false;

  if (allowResponseFormat && responseFormatAvailability !== "unsupported") {
    try {
      const result = await requestJsonWithResponseFormat(baseOptions);
      responseFormatAvailability = "supported";
      return result;
    } catch (error) {
      if (responseFormatAvailability === "unknown") {
        responseFormatAvailability = "unsupported";
      } else {
        throw error;
      }
    }
  }

  return requestJsonWithFallback(baseOptions);
}

export async function completeTextOnce(options: CompleteTextOptions): Promise<CompleteTextResult> {
  if (options.signal?.aborted) {
    throw new Error("요청이 취소되었습니다.");
  }

  const messages = normalizeMessages(options.messages);
  const completion = await options.engine.chat.completions.create({
    messages,
    temperature: options.temperature ?? 0.2,
    stream: false,
    signal: options.signal,
  } as ChatCompletionRequestWithSignal<webllm.ChatCompletionRequestNonStreaming>);

  const content = completion?.choices?.[0]?.message?.content ?? "";
  return { content };
}
