"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ClassSummary } from "@/lib/data/classes";

type ClassFetchIssue = {
  code: string;
  requestId?: string;
  status?: number;
  unauthorized?: boolean;
  message?: string;
};

type ClassFetchResult = {
  classes: ClassSummary[];
  issue: ClassFetchIssue | null;
};

type LoadState = "loading" | "ready" | "error";

function logFetchFailure(issue: ClassFetchIssue, message?: string) {
  console.error(
    JSON.stringify(
      {
        level: "error",
        stage: "dashboard_classes_fetch_failed",
        code: issue.code,
        requestId: issue.requestId,
        status: issue.status,
        message: message ?? issue.message,
      },
      (_key, value) => (value === undefined ? undefined : value),
    ),
  );
}

async function fetchClasses(signal?: AbortSignal): Promise<ClassFetchResult> {
  try {
    const response = await fetch(apiV1Path("classes"), { cache: "no-store", signal });

    let payload: unknown = null;
    let parsedJson = false;

    try {
      payload = await response.clone().json();
      parsedJson = true;
    } catch {
      payload = null;
    }

    const code =
      payload && typeof payload === "object" && payload
        ? ("code" in payload && typeof payload.code === "string" ? payload.code : undefined)
        : undefined;
    const requestId =
      payload && typeof payload === "object" && payload
        ? ("requestId" in payload && typeof payload.requestId === "string"
            ? payload.requestId
            : undefined)
        : undefined;
    const message =
      payload && typeof payload === "object" && payload && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : undefined;

    if (response.ok && payload && typeof payload === "object" && "classes" in payload) {
      const raw = Array.isArray((payload as { classes: ClassSummary[] }).classes)
        ? (payload as { classes: ClassSummary[] }).classes
        : [];
      return { classes: raw, issue: null };
    }

    if (response.status === 401) {
      const issue: ClassFetchIssue = {
        code: code ?? "unauthorized",
        requestId,
        status: response.status,
        unauthorized: true,
        message,
      };
      logFetchFailure(issue);
      return { classes: [], issue };
    }

    if (!parsedJson) {
      const issue: ClassFetchIssue = { code: "non_json_response", status: response.status };
      logFetchFailure(issue);
      return { classes: [], issue };
    }

    const issue: ClassFetchIssue = {
      code: code ?? "unknown_error",
      requestId,
      status: response.status,
      message,
    };
    logFetchFailure(issue);
    return { classes: [], issue };
  } catch (error) {
    const issue: ClassFetchIssue = {
      code: "network_error",
      message: error instanceof Error ? error.message : "network_error",
    };
    logFetchFailure(issue);
    return { classes: [], issue };
  }
}

export function useDashboardClasses() {
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [issue, setIssue] = useState<ClassFetchIssue | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const fetchInFlight = useRef<AbortController | null>(null);

  const revalidate = useCallback(async () => {
    if (fetchInFlight.current) {
      fetchInFlight.current.abort();
    }

    const controller = new AbortController();
    fetchInFlight.current = controller;
    setLoadState("loading");

    const result = await fetchClasses(controller.signal);
    if (controller.signal.aborted) return;

    setClasses(result.classes);
    setIssue(result.issue);
    setLoadState(result.issue ? "error" : "ready");
    fetchInFlight.current = null;
  }, []);

  useEffect(() => {
    void revalidate();

    return () => {
      if (fetchInFlight.current) {
        fetchInFlight.current.abort();
      }
    };
  }, [revalidate]);

  const createClass = useCallback(async (title: string) => {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      throw new Error("제목을 입력해주세요.");
    }

    const response = await fetch(apiV1Path("classes"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: normalizedTitle }),
    });

    const payload = (await response.json().catch(() => null)) as
      | {
          class?: ClassSummary;
          error?: string;
        }
      | null;

    if (!response.ok) {
      const message =
        payload && typeof payload === "object" && payload && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : "클래스를 생성하지 못했습니다.";
      throw new Error(message);
    }

    const created = payload?.class ?? null;
    if (created) {
      setClasses((current) => [created, ...current]);
    }

    return created;
  }, []);

  const value = useMemo(
    () => ({
      classes,
      issue,
      loadState,
      revalidate,
      actions: { createClass },
    }),
    [classes, createClass, issue, loadState, revalidate],
  );

  return value;
}
