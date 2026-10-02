import type { LiveSnapshot, LiveSnapshotShareable } from "@/lib/data/liveSession";

export type LiveStatus = "active" | "idle" | "uninitialized";

export type LiveWarning = {
  code: string;
  message: string;
};

type LiveShare = {
  code?: string | null;
  url?: string | null;
};

type LivePayload = {
  ok: true;
  requestId: string;
  live: {
    status: LiveStatus;
    snapshot: LiveSnapshot | LiveSnapshotShareable | null;
  };
  share?: LiveShare;
  warning?: LiveWarning;
};

type LiveErrorPayload = {
  ok: false;
  requestId: string;
  error: {
    code: string;
    message: string;
  };
};

export type LiveResponsePayload = LivePayload | LiveErrorPayload;

type OkLiveOptions = {
  requestId: string;
  status: LiveStatus;
  snapshot: LiveSnapshot | LiveSnapshotShareable | null;
  share?: LiveShare;
  warning?: LiveWarning;
  extra?: Record<string, unknown>;
};

type FailLiveOptions = {
  requestId: string;
  code: string;
  message: string;
};

export function okLive({ requestId, status, snapshot, share, warning, extra }: OkLiveOptions) {
  return {
    ok: true,
    requestId,
    live: {
      status,
      snapshot,
    },
    ...(share ? { share } : {}),
    ...(warning ? { warning } : {}),
    ...(extra ?? {}),
  };
}

export function failLive({ requestId, code, message }: FailLiveOptions): LiveResponsePayload {
  return {
    ok: false,
    requestId,
    error: {
      code,
      message,
    },
  };
}
