import assert from "node:assert/strict";
import test from "node:test";

import type { MissionRoomRuntimeInputs } from "@/lib/world-hub/mission/contracts";
import {
  createWorldHubMissionResultReturnPayload,
  createWorldHubReturnRouteWithMissionResult,
  parseRecentMissionResultReturnFromSearchParams,
} from "@/lib/world-hub/mission/resultHandoff";

function createCompletedRuntime(): MissionRoomRuntimeInputs {
  return {
    route: {
      missionId: "mission-orbit-lab",
      mode: "validated-handoff",
      returnHubPath: "/world-hub",
      fallbackReason: null,
    },
    handoff: {
      missionId: "mission-orbit-lab",
      worldId: "starter-world-hub",
      sessionId: "hub-session-1",
      launchMode: "placeholder-route",
      bootstrapMode: "local-preview",
      issuedAtIso: "2026-03-21T00:00:00.000Z",
      portalLabel: "Orbit Lab",
      portalStatusLabel: "Ready",
      portalAvailability: "available",
    },
    scene: {
      missionId: "mission-orbit-lab",
      title: "Orbit Lab",
      subtitle: "Calibrate the beacon",
      summary: "A safe summary for the hub acknowledgement panel.",
      accent: "#22d3ee",
      missionTypeLabel: "Mission",
      environmentLabel: "Orbital relay deck",
      objectiveLabel: "Align the console array.",
      statusLabel: "Ready",
      returnLabel: "Return to world hub",
      scene: {
        containerLabel: "Mission",
        containerSummary: "Placeholder scene",
        placeholderTitle: "Placeholder",
        placeholderBody: "Placeholder body",
      },
      metadata: [],
    },
    assets: {
      scope: "mission-room",
      runtimeId: "mission-orbit-lab",
      manifestVersion: 1,
      descriptors: [],
      source: {
        kind: "local-fallback",
        label: "Local assets",
        detail: null,
        fallbackReason: null,
        diagnostics: {
          deliveryMode: "local-bundled",
          assetCount: 0,
          readyAssetCount: 0,
          baseUrl: null,
        },
      },
    },
    policy: {
      runtime: "mission-room",
      resolution: "allowed",
      entry: {
        status: "allowed",
        code: "allowed",
        label: "Mission access allowed",
        detail: "Validated handoff accepted.",
      },
      source: {
        kind: "local-preview",
        label: "Local preview policy",
        detail: null,
        fallbackReason: null,
      },
      diagnostics: {
        adapterKind: "local-preview",
        scopeAlignment: "aligned",
      },
      preview: {
        mode: "deterministic-local",
      },
      scope: {
        worldId: "starter-world-hub",
        missionId: "mission-orbit-lab",
        sessionId: "hub-session-1",
      },
    },
    bootstrapSource: {
      kind: "local-single-user",
      label: "Local bootstrap",
      detail: null,
      fallbackReason: null,
      diagnostics: {
        strategy: "deterministic-local",
        requestedMode: "local-single-user",
        resolvedMode: "local-single-user",
        endpoint: null,
      },
    },
    bootstrap: {
      requestedMode: "local-single-user",
      mode: "local-single-user",
      authority: "local-preview",
      roomId: "room-1",
      roomLabel: "Orbit Lab Local Room",
      seatLabel: "Solo preview seat",
      connectionLabel: "Local room connected",
      objectiveState: "ready",
      partySize: 1,
    },
    session: {
      scope: "mission-room",
      runtimeId: "room-1",
      runtimeAuthority: "local-preview",
      authority: {
        scope: "mission-room",
        authorityKind: "local-preview",
        ownerId: "mission-room:room-1",
        authorityEpochIso: "2026-03-21T00:00:00.000Z",
      },
      presence: {
        scope: "mission-room",
        status: "local-only",
        transport: "local-preview",
        channelKey: null,
      },
      reservation: {
        scope: "mission-room",
        status: "reserved",
        activationState: "active",
        hasJoinTicket: false,
      },
    },
    presence: {
      adapterKind: "local-noop",
      channelKey: null,
      peerCount: 0,
      peers: [],
      diagnostics: {
        mode: "local-preview",
        lastEventIso: "2026-03-21T00:00:00.000Z",
      },
    },
    gameplay: {
      missionId: "mission-orbit-lab",
      lifecycle: {
        status: "completed",
        label: "Completed",
        detail: "Mission completed locally.",
      },
      objective: {
        label: "Final objective",
        detail: "Done",
        stepIndex: 3,
        totalSteps: 3,
        callToAction: null,
      },
      progress: {
        completedObjectives: 3,
        totalObjectives: 3,
        percent: 100,
        statusLabel: "3/3 complete",
      },
      resolution: {
        occurredAtIso: "2026-03-21T00:00:30.000Z",
        reason: "completed",
      },
      source: {
        kind: "deterministic-local",
        label: "Deterministic local gameplay",
        detail: null,
        diagnostics: {
          progressionMode: "deterministic-local",
          owner: "local-preview",
          sequence: 3,
          transitionCount: 3,
        },
      },
    },
    completion: {
      missionId: "mission-orbit-lab",
      outcome: {
        status: "completed",
        label: "Mission completion ready",
        detail: "Completion resolved locally.",
      },
      metadata: {
        completedAtIso: "2026-03-21T00:00:30.000Z",
        objectiveCount: 3,
        completedObjectives: 3,
        percentComplete: 100,
        routeMode: "validated-handoff",
        runtimeAuthority: "local-preview",
        validationState: "not-requested",
        returnFlow: {
          available: true,
          hubPath: "/world-hub",
          label: "Return to world hub",
        },
      },
      result: {
        kind: "preview",
        label: "Local completion result",
        detail: "A preview-safe mission result is available for runtime consumers.",
        teacherReportStatus: "not-generated",
        inventoryStatus: "placeholder-ready",
        nextActionLabel: "Return to world hub",
      },
      rewards: {
        status: "placeholder",
        placeholders: [
          {
            id: "mission-orbit-lab-reward-badge",
            kind: "badge",
            label: "Orbit Lab completion badge",
            detail: "Placeholder badge seam.",
            quantity: 1,
            status: "placeholder",
          },
        ],
        summary: {
          status: "placeholder",
          summary: {
            label: "3 reward placeholders ready",
            detail: "Deterministic local reward resolution produced a stable placeholder summary for the world hub, inventory, and future reward services.",
            highlightedRewardLabel: "Orbit Lab completion ledger entry",
            placeholderCount: 3,
            inventoryUpdateCount: 2,
          },
          inventoryUpdates: [
            {
              id: "mission-orbit-lab-inventory-ledger",
              target: "mission-ledger",
              label: "Orbit Lab completion ledger entry",
              detail: "Placeholder mission history entry for a future Supabase-backed reward ledger seam.",
              quantity: 1,
              status: "placeholder",
            },
            {
              id: "mission-orbit-lab-inventory-badge",
              target: "profile-inventory",
              label: "Orbit Lab reward inventory stub",
              detail: "Placeholder inventory update for future profile/badge integration without mutating core profile systems today.",
              quantity: 1,
              status: "placeholder",
            },
            {
              id: "mission-orbit-lab-inventory-return",
              target: "classroom-report",
              label: "Return to world hub",
              detail: "Placeholder classroom/reporting handoff that keeps reward acknowledgement aligned with the world-hub return path.",
              quantity: null,
              status: "placeholder",
            },
          ],
          source: {
            kind: "deterministic-local",
            label: "Deterministic local reward hook",
            detail: "Reward placeholders were resolved entirely in preview-safe local mode.",
            diagnostics: {
              deterministic: true,
              derivedFrom: "mission-completion",
              placeholderCount: 3,
              inventoryUpdateCount: 2,
              rewardServiceStatus: "placeholder-only",
              inventoryServiceStatus: "placeholder-only",
              emittedAtIso: "2026-03-21T00:00:30.000Z",
            },
          },
          fallback: {
            mode: "deterministic-local",
            reason: "preview-safe-default",
            label: "Preview-safe reward resolution active",
            detail: "The mission used the default deterministic reward hook so runtime consumers can read stable reward summaries before backend services are added.",
          },
        },
      },
      source: {
        kind: "deterministic-local",
        label: "Deterministic local completion seam",
        detail: null,
        diagnostics: {
          adapterKind: "deterministic-local",
          deterministic: true,
          derivedFrom: "gameplay-state",
          lastEvent: "completion-ready",
          sequence: 3,
          transitionCount: 3,
          resultVersion: "mission-completion-v1",
          rewardIntegration: "not-connected",
          persistence: "none",
          reporting: "none",
          validatedBy: "local-preview",
          emittedAtIso: "2026-03-21T00:00:30.000Z",
        },
      },
    },
    source: {
      kind: "local-derived",
      label: "Local scene config",
      detail: null,
      fallbackReason: null,
    },
  } as MissionRoomRuntimeInputs;
}

test("mission result return contract serializes a safe completed summary for the hub", () => {
  const runtime = createCompletedRuntime();
  const payload = createWorldHubMissionResultReturnPayload({
    runtime,
    now: new Date("2026-03-21T00:01:00.000Z"),
  });

  assert.equal(payload.version, 1);
  assert.equal(payload.source, "mission-room");
  assert.equal(payload.missionId, "mission-orbit-lab");
  assert.equal(payload.summary.completedObjectives, 3);
  assert.equal(payload.summary.objectiveCount, 3);
  assert.equal(payload.summary.resultLabel, "Local completion result");
  assert.equal(payload.rewards.placeholderCount, 3);
  assert.equal(payload.rewards.inventoryUpdateCount, 2);
  assert.equal(payload.rewards.summaryLabel, "3 reward placeholders ready");
  assert.equal(payload.integrations.rewardHook, "deterministic-local-placeholder");
  assert.equal(payload.integrations.persistence, "pending-write");

  const route = createWorldHubReturnRouteWithMissionResult({
    hubPath: runtime.route.returnHubPath,
    payload,
  });

  assert.match(route, /^\/world-hub\?missionResult=/);
});

test("world hub mission result parser accepts recent typed return data and normalizes an acknowledgement", () => {
  const runtime = createCompletedRuntime();
  const payload = createWorldHubMissionResultReturnPayload({
    runtime,
    now: new Date("2026-03-21T00:01:00.000Z"),
  });
  const normalized = parseRecentMissionResultReturnFromSearchParams({
    resultParam: JSON.stringify(payload),
    now: new Date("2026-03-21T00:05:00.000Z"),
  });

  assert.ok(normalized);
  assert.equal(normalized?.payload.missionTitle, "Orbit Lab");
  assert.equal(normalized?.freshness.status, "recent");
  assert.equal(normalized?.ack.title, "Orbit Lab complete");
  assert.match(normalized?.ack.rewardLabel ?? "", /3 reward placeholders ready/);
  assert.match(normalized?.ack.integrationLabel ?? "", /Deterministic local reward hook/);
});

test("world hub mission result parser ignores stale or invalid return payloads", () => {
  const runtime = createCompletedRuntime();
  const payload = createWorldHubMissionResultReturnPayload({
    runtime,
    now: new Date("2026-03-21T00:01:00.000Z"),
  });

  const stale = parseRecentMissionResultReturnFromSearchParams({
    resultParam: JSON.stringify(payload),
    now: new Date("2026-03-21T00:30:01.000Z"),
  });
  const invalid = parseRecentMissionResultReturnFromSearchParams({
    resultParam: "{not-json}",
  });

  assert.equal(stale, null);
  assert.equal(invalid, null);
});
