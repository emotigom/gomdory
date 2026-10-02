"use client";

export const DASHBOARD_CHANNEL = "gomdory:dashboard";
const TAB_ID_KEY = "gomdory_tab_id";

export type DashboardInvalidateEvent =
  | {
      type: "boards_changed";
      reason: "created" | "deleted" | "updated" | "pinned" | "unpinned" | "bulk";
      ts: number;
      sourceTabId: string;
    }
  | {
      type: "files_changed" | "storage_changed";
      reason: "uploaded" | "deleted" | "updated";
      ts: number;
      sourceTabId: string;
    }
  | {
      type: "templates_changed";
      reason: "published" | "copied";
      ts: number;
      sourceTabId: string;
    }
  | {
      type: "presets_changed";
      reason: "updated" | "imported" | "reset";
      ts: number;
      sourceTabId: string;
    }
  | {
      type: "share_links_changed";
      reason: "ensured" | "rotated";
      ts: number;
      sourceTabId: string;
    };

export type DashboardInvalidateEventInput =
  | Omit<Extract<DashboardInvalidateEvent, { type: "boards_changed" }>, "sourceTabId">
  | Omit<Extract<DashboardInvalidateEvent, { type: "files_changed" | "storage_changed" }>, "sourceTabId">
  | Omit<Extract<DashboardInvalidateEvent, { type: "templates_changed" }>, "sourceTabId">
  | Omit<Extract<DashboardInvalidateEvent, { type: "presets_changed" }>, "sourceTabId">
  | Omit<Extract<DashboardInvalidateEvent, { type: "share_links_changed" }>, "sourceTabId">;
export type DashboardInvalidationEvent = DashboardInvalidateEvent;

function getWindow(): typeof window | null {
  return typeof window === "undefined" ? null : window;
}

export function getDashboardTabId(): string {
  const win = getWindow();
  if (!win) return "server";

  try {
    const cached = win.sessionStorage.getItem(TAB_ID_KEY);
    if (cached) return cached;
    const next = win.crypto.randomUUID();
    win.sessionStorage.setItem(TAB_ID_KEY, next);
    return next;
  } catch {
    return "fallback";
  }
}

export function publishDashboardInvalidate(event: DashboardInvalidateEventInput): void {
  const win = getWindow();
  if (!win || typeof BroadcastChannel === "undefined") return;

  const sourceTabId = getDashboardTabId();
  let message: DashboardInvalidateEvent;
  switch (event.type) {
    case "boards_changed":
      message = { ...event, sourceTabId };
      break;
    case "files_changed":
      message = { ...event, sourceTabId };
      break;
    case "storage_changed":
      message = { ...event, sourceTabId };
      break;
    case "presets_changed":
      message = { ...event, sourceTabId };
      break;
    case "templates_changed":
      message = { ...event, sourceTabId };
      break;
    case "share_links_changed":
      message = { ...event, sourceTabId };
      break;
  }

  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(DASHBOARD_CHANNEL);
    channel.postMessage(message);
  } catch {
    // BroadcastChannel can be unavailable or blocked in some embedded/private contexts.
  } finally {
    channel?.close();
  }
}

export function subscribeDashboardInvalidate(
  handler: (event: DashboardInvalidateEvent) => void,
): () => void {
  const win = getWindow();
  if (!win || typeof BroadcastChannel === "undefined") return () => {};

  const myTabId = getDashboardTabId();
  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(DASHBOARD_CHANNEL);
  } catch {
    return () => {};
  }

  const onMessage = (event: MessageEvent<DashboardInvalidateEvent>) => {
    const message = event.data;
    if (!message || message.sourceTabId === myTabId) return;
    handler(message);
  };

  channel.addEventListener("message", onMessage);

  return () => {
    channel.removeEventListener("message", onMessage);
    channel.close();
  };
}

export const publishDashboardInvalidation = publishDashboardInvalidate;
export const subscribeDashboardInvalidation = subscribeDashboardInvalidate;
export const DASHBOARD_INVALIDATION_CHANNEL = DASHBOARD_CHANNEL;
