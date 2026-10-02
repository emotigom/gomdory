"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { useRequestContext } from "@/app/_components/request-context";
import { getLastRequestId } from "@/lib/http/requestId";

const clamp = (value: string, maxLength: number) =>
  value.length > maxLength ? value.slice(0, maxLength) : value;

export default function RequestIdOverlay() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const requestContext = useRequestContext();
  const [storageEnabled, setStorageEnabled] = useState(false);
  const [lastRequestId, setLastRequestId] = useState<string | null>(getLastRequestId());

  const queryEnabled = searchParams?.get("debug") === "1";

  useEffect(() => {
    setStorageEnabled(localStorage.getItem("gom_debug") === "1");
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setLastRequestId(getLastRequestId());
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  const enabled = queryEnabled || storageEnabled;
  const resolvedRequestId = lastRequestId ?? requestContext.requestId;
  const resolvedPath = pathname ?? requestContext.path;

  const content = useMemo(() => {
    const requestIdText = resolvedRequestId ? `requestId: ${resolvedRequestId}` : "requestId: -";
    const pathText = resolvedPath ? `path: ${resolvedPath}` : "path: -";
    return clamp(`${requestIdText} | ${pathText}`, 300);
  }, [resolvedPath, resolvedRequestId]);

  if (!enabled) return null;

  const handleCopy = async () => {
    const copyText = [resolvedRequestId, resolvedPath].filter(Boolean).join(" ");
    if (!copyText) return;
    try {
      await navigator.clipboard.writeText(copyText);
    } catch {
      return;
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="fixed bottom-4 right-4 z-50 rounded-full border border-slate-200 bg-white/90 px-3 py-2 text-xs font-medium text-slate-700 shadow-lg backdrop-blur"
      aria-label="Copy request id"
    >
      {content}
    </button>
  );
}
