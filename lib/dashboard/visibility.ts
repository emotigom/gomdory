"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";

type VisibilityGate = {
  visible: boolean;
  online: boolean;
  pendingInvalidationRef: MutableRefObject<boolean>;
  markPending: () => void;
  clearPending: () => void;
};

function getInitialVisibility(): boolean {
  if (typeof document === "undefined") return true;
  return document.visibilityState === "visible";
}

function getInitialOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine !== false;
}

export function useVisibilityGate(): VisibilityGate {
  const [visible, setVisible] = useState(getInitialVisibility);
  const [online, setOnline] = useState(getInitialOnline);
  const pendingInvalidationRef = useRef(false);

  const markPending = useCallback(() => {
    pendingInvalidationRef.current = true;
  }, []);

  const clearPending = useCallback(() => {
    pendingInvalidationRef.current = false;
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      setVisible(document.visibilityState === "visible");
    };
    const handleFocus = () => {
      setVisible(true);
    };
    const handleOnline = () => {
      setOnline(navigator.onLine !== false);
    };
    const handleOffline = () => {
      setOnline(false);
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return { visible, online, pendingInvalidationRef, markPending, clearPending };
}
