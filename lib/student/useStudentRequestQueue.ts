"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { apiFetch } from "@/lib/http/apiFetch";

import type { StudentRequestRecord, StudentRequestStatus, StudentRequestType } from "@/lib/types/studentRequests";
import { buildActionPayload, parseRateLimitError } from "@/lib/student/actions.logic";

const STORAGE_PREFIX = "gomdory:student";
const ANON_ID_KEY = "gomdory:anonId";
const MAX_ITEMS = 20;
const MAX_RETRIES = 3;

export type StudentRequestQueueItem = StudentRequestRecord & {
  attempts: number;
  retryAfterAt?: number | null;
};

type StudentRequestQueueState = {
  items: StudentRequestQueueItem[];
};

function getStorageKey(code: string) {
  return `${STORAGE_PREFIX}:${code}:requests`;
}

function makeClientRequestId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `client_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
}

function getAnonId() {
  if (typeof window === "undefined") return null;
  try {
    const existing = window.localStorage.getItem(ANON_ID_KEY);
    if (existing) return existing;
    const next = makeClientRequestId();
    window.localStorage.setItem(ANON_ID_KEY, next);
    return next;
  } catch {
    return null;
  }
}

function readQueue(code: string): StudentRequestQueueState {
  if (typeof window === "undefined") return { items: [] };
  try {
    const stored = window.localStorage.getItem(getStorageKey(code));
    if (!stored) return { items: [] };
    const parsed = JSON.parse(stored) as StudentRequestQueueState | null;
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.items)) {
      return { items: [] };
    }
    const items = parsed.items.filter((item) => item && typeof item.id === "string");
    return { items };
  } catch {
    return { items: [] };
  }
}

function writeQueue(code: string, state: StudentRequestQueueState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getStorageKey(code), JSON.stringify(state));
  } catch {
    // ignore
  }
}

function normalizeMeta(meta: Record<string, unknown> | undefined | null) {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return {} as Record<string, unknown>;
  return meta;
}

export function useStudentRequestQueue({ shareCode }: { shareCode: string }) {
  const [items, setItems] = useState<StudentRequestQueueItem[]>([]);
  const inflightRef = useRef(new Set<string>());

  useEffect(() => {
    const stored = readQueue(shareCode);
    setItems(stored.items);
  }, [shareCode]);

  const persistItems = useCallback(
    (nextItems: StudentRequestQueueItem[]) => {
      const trimmed = nextItems
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, MAX_ITEMS);
      setItems(trimmed);
      writeQueue(shareCode, { items: trimmed });
    },
    [shareCode],
  );

  const updateItem = useCallback(
    (id: string, updater: (item: StudentRequestQueueItem) => StudentRequestQueueItem) => {
      persistItems(items.map((item) => (item.id === id ? updater(item) : item)));
    },
    [items, persistItems],
  );

  const sendRequest = useCallback(
    async (item: StudentRequestQueueItem) => {
      if (inflightRef.current.has(item.id)) return;
      inflightRef.current.add(item.id);
      const anonId = getAnonId();
      const meta = normalizeMeta(item.meta);
      const requestPayload = buildActionPayload({
        id: item.id,
        type: item.type,
        text: item.text,
        anonId,
        meta,
      });

      try {
        const response = await apiFetch(apiV1Path(`s/${shareCode}/actions`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestPayload),
        });

        const payload = (await response.json().catch(() => null)) as
          | {
              ok: true;
              actionId?: string;
              status?: string;
            }
          | { ok?: false; error?: { message?: string; code?: string }; retryAfterSeconds?: number }
          | null;

        if (!response.ok || !payload || payload.ok !== true) {
          const rateLimit = parseRateLimitError({
            status: response.status,
            payload: payload as { retryAfterSeconds?: number } | null,
            now: Date.now(),
          });
          const message =
            rateLimit?.message ??
            (payload && "error" in payload
              ? payload.error?.message ?? "요청을 전송하지 못했습니다."
              : "요청을 전송하지 못했습니다.");
          const error = new Error(message) as Error & { retryAfterAt?: number | null };
          error.retryAfterAt = rateLimit?.retryAfterAt ?? null;
          throw error;
        }

        const statusMap: Record<string, StudentRequestStatus> = {
          sent_pending: "sent",
          accepted: "approved",
          hidden: "hidden",
          rejected: "rejected",
        };
        updateItem(item.id, (prev) => ({
          ...prev,
          status: payload.status ? statusMap[payload.status] ?? "sent" : "sent",
          errorMessage: null,
          retryAfterAt: null,
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : "요청을 전송하지 못했습니다.";
        updateItem(item.id, (prev) => ({
          ...prev,
          status: "failed",
          errorMessage: message,
          retryAfterAt: (error as Error & { retryAfterAt?: number | null }).retryAfterAt ?? null,
        }));
      } finally {
        inflightRef.current.delete(item.id);
      }
    },
    [shareCode, updateItem],
  );

  const enqueue = useCallback(
    async (type: StudentRequestType, text?: string | null, meta?: Record<string, unknown>) => {
      const createdAt = Date.now();
      const id = makeClientRequestId();
      const next: StudentRequestQueueItem = {
        id,
        type,
        text: text ?? null,
        meta: normalizeMeta(meta),
        createdAt,
        status: "queued",
        attempts: 0,
        errorMessage: null,
        retryAfterAt: null,
      };
      persistItems([next, ...items]);
      await sendRequest(next);
    },
    [items, persistItems, sendRequest],
  );

  const retry = useCallback(
    async (id: string) => {
      const target = items.find((item) => item.id === id);
      if (!target) return;
      if (target.attempts >= MAX_RETRIES) return;
      const updated: StudentRequestQueueItem = {
        ...target,
        status: "queued",
        attempts: target.attempts + 1,
        errorMessage: null,
      };
      persistItems(items.map((item) => (item.id === id ? updated : item)));
      await sendRequest(updated);
    },
    [items, persistItems, sendRequest],
  );

  const summary = useMemo(() => {
    const total = items.length;
    const failed = items.filter((item) => item.status === "failed").length;
    const last = items[0] ?? null;
    return { total, failed, last };
  }, [items]);

  return {
    requests: items,
    enqueue,
    retry,
    summary,
    maxRetries: MAX_RETRIES,
  };
}
