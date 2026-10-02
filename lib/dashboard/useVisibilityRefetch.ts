"use client";

import { useCallback, useEffect, useRef } from "react";

type VisibilityState = "visible" | "hidden";

type VisibilityRefetchControllerOptions = {
  refetch: () => void;
  getVisibilityState: () => VisibilityState;
  isOnline: () => boolean;
};

export type VisibilityRefetchController = {
  requestRefetch: () => void;
  markPending: () => void;
  handleVisibilityChange: () => void;
  handleFocus: () => void;
  handleOnline: () => void;
  isPending: () => boolean;
};

export function createVisibilityRefetchController(
  options: VisibilityRefetchControllerOptions,
): VisibilityRefetchController {
  let pending = false;

  const canRun = () => options.getVisibilityState() === "visible" && options.isOnline();

  const flushPending = () => {
    if (!pending || !canRun()) return;
    pending = false;
    options.refetch();
  };

  const requestRefetch = () => {
    if (!canRun()) {
      pending = true;
      return;
    }
    options.refetch();
  };

  return {
    requestRefetch,
    markPending: () => {
      pending = true;
    },
    handleVisibilityChange: () => {
      flushPending();
    },
    handleFocus: () => {
      flushPending();
    },
    handleOnline: () => {
      flushPending();
    },
    isPending: () => pending,
  };
}

export function useVisibilityRefetch(refetch: () => void): {
  requestRefetch: () => void;
  markPending: () => void;
  isPending: () => boolean;
} {
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  const controllerRef = useRef<VisibilityRefetchController | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = createVisibilityRefetchController({
      refetch: () => refetchRef.current(),
      getVisibilityState: () => (typeof document === "undefined" ? "visible" : document.visibilityState),
      isOnline: () => (typeof navigator === "undefined" ? true : navigator.onLine !== false),
    });
  }

  const requestRefetch = useCallback(() => {
    controllerRef.current?.requestRefetch();
  }, []);

  const markPending = useCallback(() => {
    controllerRef.current?.markPending();
  }, []);

  const isPending = useCallback(() => controllerRef.current?.isPending() ?? false, []);

  useEffect(() => {
    const handleVisibilityChange = () => controllerRef.current?.handleVisibilityChange();
    const handleFocus = () => controllerRef.current?.handleFocus();
    const handleOnline = () => controllerRef.current?.handleOnline();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("online", handleOnline);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  return { requestRefetch, markPending, isPending };
}
