import assert from "node:assert/strict";
import test from "node:test";

import { createBrowserMetaverseProgressPersistence } from "@/lib/world-hub/progress/browserPersistence";
import { createMetaverseProgressSnapshotFromMissionResult } from "@/lib/world-hub/progress/contracts";
import {
  readMetaverseProgressSnapshotForUser,
  writeMetaverseProgressSnapshotForUser,
} from "@/lib/world-hub/progress/serverPersistence";
import type { WorldHubMissionResultReturnPayload } from "@/lib/world-hub/mission/resultHandoff";

function createMissionResultPayload(): WorldHubMissionResultReturnPayload {
  return {
    version: 1,
    source: "mission-room",
    worldId: "starter-world-hub",
    sessionId: "hub-session-1",
    missionId: "mission-orbit-lab",
    missionTitle: "Orbit Lab",
    returnHubPath: "/world-hub",
    issuedAtIso: "2026-03-21T00:00:35.000Z",
    completedAtIso: "2026-03-21T00:00:30.000Z",
    outcome: {
      status: "completed",
      label: "Mission completion ready",
    },
    summary: {
      completionLabel: "3/3 objectives complete",
      objectiveCount: 3,
      completedObjectives: 3,
      percentComplete: 100,
      resultLabel: "Local completion result",
      resultDetail: "A preview-safe mission result is available for runtime consumers.",
    },
    rewards: {
      status: "placeholder",
      summaryLabel: "3 reward placeholders ready",
      summaryDetail: "Deterministic local reward resolution produced a stable placeholder summary for the world hub, inventory, and future reward services.",
      highlightedRewardLabel: "Orbit Lab completion ledger entry",
      placeholderCount: 3,
      inventoryUpdateCount: 2,
      sourceLabel: "Deterministic local reward hook",
      fallbackLabel: "Preview-safe reward resolution active",
    },
    integrations: {
      rewardHook: "deterministic-local-placeholder",
      persistence: "pending-write",
      reporting: "not-connected",
    },
  };
}

test("metaverse progress snapshot normalizes a persisted mission completion", () => {
  const payload = createMissionResultPayload();
  const snapshot = createMetaverseProgressSnapshotFromMissionResult({
    payload,
    persistenceStatus: "persisted",
    source: {
      kind: "supabase",
      label: "Supabase metaverse progress",
      detail: "Loaded persisted metaverse completion snapshot.",
      fallbackReason: null,
      diagnostics: {
        mode: "supabase",
        storageKey: null,
        endpoint: "/world-hub/api/progress",
        userScoped: true,
        readStatus: "succeeded",
        writeStatus: "not-requested",
        syncedAtIso: "2026-03-21T00:00:36.000Z",
      },
    },
  });

  assert.equal(snapshot.state, "ready");
  assert.equal(snapshot.recentMissionCompletion?.missionId, payload.missionId);
  assert.equal(snapshot.persistedCompletion?.status, "persisted");
  assert.equal(snapshot.homeAcknowledgement?.rewardLabel, "3 reward placeholders ready · Orbit Lab completion ledger entry");
  assert.equal(snapshot.source.kind, "supabase");
});

test("browser metaverse progress persistence falls back to local storage when remote write fails", async () => {
  const storage = new Map<string, string>();
  const browserPersistence = createBrowserMetaverseProgressPersistence({
    fetcher: async () => new Response("write failed", { status: 500 }),
    storage: {
      getItem(key) {
        return storage.get(key) ?? null;
      },
      setItem(key, value) {
        storage.set(key, value);
      },
    },
  });

  const writeResult = await browserPersistence.persistCompletion({
    payload: createMissionResultPayload(),
  });

  assert.equal(writeResult.status, "fallback-persisted");
  assert.equal(writeResult.snapshot.source.kind, "local-storage-fallback");

  const readResult = await browserPersistence.readSnapshot();
  assert.equal(readResult.state, "ready");
  assert.equal(readResult.recentMissionCompletion?.missionTitle, "Orbit Lab");
  assert.equal(readResult.source.kind, "local-storage-fallback");
});

test("server metaverse progress persistence writes and reads stable snapshots without exposing row shapes", async () => {
  let storedRow: Record<string, unknown> | null = null;

  const createAdminClientFn = () =>
    ({
      from() {
        return {
          select() {
            return {
              eq() {
                return {
                  async maybeSingle() {
                    return { data: storedRow, error: null };
                  },
                };
              },
            };
          },
          async upsert(payload: Record<string, unknown>) {
            storedRow = payload;
            return { error: null };
          },
        };
      },
    }) as never;

  const emptySnapshot = await readMetaverseProgressSnapshotForUser({
    userId: "00000000-0000-4000-8000-000000000001",
    createAdminClientFn,
  });
  assert.equal(emptySnapshot.state, "empty");
  assert.equal(emptySnapshot.source.kind, "supabase");

  const writeResult = await writeMetaverseProgressSnapshotForUser({
    userId: "00000000-0000-4000-8000-000000000001",
    payload: createMissionResultPayload(),
    createAdminClientFn,
  });

  assert.equal(writeResult.status, "persisted");
  assert.equal(writeResult.snapshot.persistedCompletion?.status, "persisted");

  const readSnapshot = await readMetaverseProgressSnapshotForUser({
    userId: "00000000-0000-4000-8000-000000000001",
    createAdminClientFn,
  });

  assert.equal(readSnapshot.state, "ready");
  assert.equal(readSnapshot.lastCompletedMission?.missionId, "mission-orbit-lab");
  assert.equal(readSnapshot.recentMissionCompletion?.rewardSummary?.summaryLabel, "3 reward placeholders ready");
  assert.equal(readSnapshot.recentMissionCompletion?.rewardSummary?.placeholderCount, 3);
  assert.equal(readSnapshot.source.kind, "supabase");
});
