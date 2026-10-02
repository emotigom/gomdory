import type {
  LocalChatMessage,
  LocalWebLLMJsonResult,
  LocalWebLLMResult,
  LocalWebLLMTextResult,
  LocalWebLLMDiagnostics,
} from "./localWebllm";

export type { LocalChatMessage, LocalWebLLMDiagnostics };

export type WebLLMProgressStage = "preparing" | "loading" | "thinking" | "applying";

export type WebLLMWorkerInput =
  | {
      kind: "streamChat";
      messages: LocalChatMessage[];
      temperature?: number;
      preferredModelId?: string;
      stallTimeoutMs?: number;
    }
  | {
      kind: "generateJson";
      messages: LocalChatMessage[];
      schema?: Record<string, unknown>;
      temperature?: number;
      preferredModelId?: string;
      timeoutMs?: number;
      engineTimeoutMs?: number;
      useResponseFormat?: boolean;
      maxTokens?: number;
    }
  | {
      kind: "completeText";
      messages: LocalChatMessage[];
      temperature?: number;
      preferredModelId?: string;
    }
  | {
      kind: "warmup";
      preferredModelId?: string;
    }
  | {
      kind: "reset";
      scope: "coach" | "generator";
    }
  | {
      kind: "diagnostics";
    }
  | {
      kind: "recordInsurance";
    };

export type WebLLMWorkerRequest =
  | { type: "start"; requestId: string; input: WebLLMWorkerInput }
  | { type: "abort"; requestId: string };

export type WebLLMWorkerProgressEvent = {
  type: "progress";
  requestId: string;
  kind: WebLLMWorkerInput["kind"];
  stage: WebLLMProgressStage;
  message: string;
  tokenCount?: number;
  delta?: string;
};

export type WebLLMWorkerResult =
  | { kind: "streamChat"; result: LocalWebLLMResult }
  | { kind: "generateJson"; result: LocalWebLLMJsonResult }
  | { kind: "completeText"; result: LocalWebLLMTextResult }
  | {
      kind: "warmup";
      result: { ok: boolean; modelId?: string; usedFallback?: boolean; message?: string };
    }
  | { kind: "reset"; result: { ok: true } }
  | { kind: "diagnostics"; result: LocalWebLLMDiagnostics }
  | { kind: "recordInsurance"; result: { ok: true } };

export type WebLLMWorkerResponse =
  | WebLLMWorkerProgressEvent
  | { type: "result"; requestId: string } & WebLLMWorkerResult
  | { type: "error"; requestId: string; kind?: WebLLMWorkerInput["kind"]; error: { message: string } }
  | { type: "aborted"; requestId: string; kind?: WebLLMWorkerInput["kind"] };
