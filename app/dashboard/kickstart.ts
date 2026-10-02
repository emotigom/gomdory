"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";

export type KickstartApiResponse =
  | { ok: true; created?: boolean; skipped?: boolean; boardId?: string | null }
  | { ok: false; code?: string; message?: string };

export type KickstartTriggerInput = {
  boardCount: number;
  loadState: "loading" | "ready" | "error";
  hasTriggered: boolean;
  shouldAutoOpenChecklist?: boolean;
};

export function shouldTriggerKickstart({
  boardCount,
  loadState,
  hasTriggered,
  shouldAutoOpenChecklist,
}: KickstartTriggerInput): boolean {
  if (hasTriggered) return false;
  if (loadState !== "ready") return false;
  if (boardCount !== 0) return false;

  return Boolean(shouldAutoOpenChecklist) || boardCount === 0;
}

export async function requestKickstart(
  fetchFn: typeof fetch,
  signal?: AbortSignal,
): Promise<KickstartApiResponse> {
  const response = await fetchFn(apiV1Path("onboarding/kickstart"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
  });

  const payload = (await response.json().catch(() => null)) as KickstartApiResponse | null;

  if (!response.ok) {
    const message = payload && typeof payload === "object" && "message" in payload && payload.message
      ? payload.message
      : "킥스타트를 준비하지 못했습니다.";
    throw new Error(message);
  }

  return payload ?? { ok: true, skipped: true };
}
