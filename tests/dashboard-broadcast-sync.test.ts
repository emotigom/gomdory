import assert from "node:assert/strict";
import test from "node:test";

import {
  publishDashboardInvalidate,
  subscribeDashboardInvalidate,
  type DashboardInvalidateEvent,
} from "@/lib/dashboard/invalidation";
import { createExternalInvalidateController } from "@/app/dashboard/useDashboardBoards";

class FakeBroadcastChannel {
  static channels = new Map<string, Set<FakeBroadcastChannel>>();
  readonly name: string;
  private listeners = new Set<(event: MessageEvent<unknown>) => void>();

  constructor(name: string) {
    this.name = name;
    const bucket = FakeBroadcastChannel.channels.get(name) ?? new Set();
    bucket.add(this);
    FakeBroadcastChannel.channels.set(name, bucket);
  }

  addEventListener(_type: "message", handler: (event: MessageEvent<unknown>) => void) {
    this.listeners.add(handler);
  }

  removeEventListener(_type: "message", handler: (event: MessageEvent<unknown>) => void) {
    this.listeners.delete(handler);
  }

  postMessage(message: unknown) {
    const bucket = FakeBroadcastChannel.channels.get(this.name);
    if (!bucket) return;
    for (const channel of bucket) {
      for (const listener of channel.listeners) {
        listener({ data: message } as MessageEvent<unknown>);
      }
    }
  }

  close() {
    const bucket = FakeBroadcastChannel.channels.get(this.name);
    if (bucket) {
      bucket.delete(this);
    }
  }
}

async function withGlobals<T>(windowStub: typeof window, runner: () => Promise<T> | T): Promise<T> {
  const previousWindow = globalThis.window;
  const previousBroadcast = globalThis.BroadcastChannel;
  // @ts-expect-error - test stub
  globalThis.window = windowStub;
  // @ts-expect-error - test stub
  globalThis.BroadcastChannel = FakeBroadcastChannel;
  try {
    return await runner();
  } finally {
    globalThis.window = previousWindow;
    globalThis.BroadcastChannel = previousBroadcast;
  }
}

test("dashboard invalidation injects tabId and ignores self events", async () => {
  const events: DashboardInvalidateEvent[] = [];
  const sessionStore: Record<string, string> = { gomdory_tab_id: "tab-a" };

  const windowStub = {
    sessionStorage: {
      getItem: (key: string) => sessionStore[key] ?? null,
      setItem: (key: string, value: string) => {
        sessionStore[key] = value;
      },
    },
    crypto: { randomUUID: () => "tab-a" },
  } as unknown as typeof window;

  await withGlobals(windowStub, async () => {
    const unsubscribe = subscribeDashboardInvalidate((event) => {
      events.push(event);
    });

    publishDashboardInvalidate({
      type: "boards_changed",
      reason: "created",
      ts: 1000,
    });

    sessionStore.gomdory_tab_id = "tab-b";
    publishDashboardInvalidate({
      type: "boards_changed",
      reason: "updated",
      ts: 2000,
    });

    await new Promise((resolve) => setTimeout(resolve, 10));
    unsubscribe();
  });

  assert.equal(events.length, 1);
  assert.equal(events[0].sourceTabId, "tab-b");
});

test("external invalidation waits for visibility before revalidating", () => {
  let scheduleCount = 0;
  let visibility: "hidden" | "visible" = "hidden";

  const controller = createExternalInvalidateController({
    scheduleRevalidate: () => {
      scheduleCount += 1;
    },
    getVisibilityState: () => visibility,
    onPendingChange: () => {},
  });

  controller.handleEvent({
    type: "boards_changed",
    reason: "updated",
    ts: 1000,
    sourceTabId: "other",
  });

  assert.equal(scheduleCount, 0);
  assert.equal(controller.isPending(), true);

  visibility = "visible";
  controller.handleVisibilityChange();

  assert.equal(scheduleCount, 1);
  assert.equal(controller.isPending(), false);
});
