import assert from "node:assert/strict";
import test from "node:test";

import { buildWorldHubHudViewModel } from "@/lib/world-hub/runtime/worldHubHudModel";

function makeBaseModelArgs() {
  return {
    runtime: null,
    sceneLoading: { stage: "loading", summaryLabel: "로딩", detail: "준비 중" },
    statusText: "준비중",
    loading: true,
    errorText: null,
    focusedPortal: null,
    kioskFocused: true,
    joiningPortalId: null,
    selectedPortalId: null,
    selectedPortalPolicy: null,
    identitySummary: {
      profile: {
        status: "empty",
        title: "테스트",
        detail: "테스트",
        hasCompletedMission: false,
        hasRecentReward: false,
        lastMissionId: null,
        lastMissionTitle: null,
        completedAtIso: null,
        completionLabel: null,
        rewardLabel: null,
        persistenceLabel: null,
      },
      collectible: {
        status: "empty",
        summaryLabel: "없음",
        summaryDetail: "없음",
        highlightedCollectibleLabel: null,
        collectibleCount: 0,
        inventoryUpdateCount: 0,
      },
      source: {
        kind: "deterministic-local",
        label: "테스트",
        detail: "테스트",
        diagnostics: {
          deterministic: true,
          derivedFrom: "deterministic-local-fallback",
          progressSourceKind: "not-available",
          rewardSourceKind: "none",
          resolvedAtIso: new Date(0).toISOString(),
        },
      },
      fallback: {
        mode: "deterministic-local",
        reason: "not-needed",
        label: "테스트",
        detail: "테스트",
      },
    },
    homeZoneState: "away",
    ambientFeedback: null,
    homeAcknowledgement: null,
    homeRepeatVisitCue: null,
    homeLanePersonalization: { title: "", detail: "", readyCount: 0, signals: [] },
    classCelebrationSummary: null,
    sessionCelebrationSummary: null,
    seasonalDecorationSummary: null,
    presentationProgression: {
      suggestionProminence: "resting",
      readinessProminence: "resting",
      pathGuidanceProminence: "resting",
      academyTempoProminence: "resting",
      portalAnticipationProminence: "resting",
    },
    recentMissionResult: null,
    codingStudioProgression: null,
  } as const;
}

test("world hub model exposes coding studio bridge card when academy is focused", () => {
  const model = buildWorldHubHudViewModel({
    ...makeBaseModelArgs(),
    kioskFocused: true,
  });

  assert.equal(model.codingStudioCard.visible, true);
  assert.equal(model.codingStudioCard.ctaLabel, "코딩 스튜디오 시작");
});

test("world hub coding studio card echoes current and next lesson continuity when progression exists", () => {
  const model = buildWorldHubHudViewModel({
    ...makeBaseModelArgs(),
    codingStudioProgression: {
      currentLessonId: "turn-pivot",
      nextLessonId: "repeat-route",
    },
  });

  assert.equal(model.codingStudioCard.visible, true);
  assert.match(model.codingStudioCard.body, /입문 2/);
  assert.match(model.codingStudioCard.body, /방향과 회전/);
  assert.match(model.codingStudioCard.hint, /입문 3/);
});

test("world hub coding studio card prefers assigned path continuity when assignment exists", () => {
  const model = buildWorldHubHudViewModel({
    ...makeBaseModelArgs(),
    codingStudioAssignment: {
      title: "오늘의 실습 경로 · 입문 1~3",
      currentLessonId: "turn-pivot",
      nextLessonId: "repeat-route",
    },
  });

  assert.equal(model.codingStudioCard.visible, true);
  assert.equal(model.codingStudioCard.ctaLabel, "지정 실습 이어가기");
  assert.match(model.codingStudioCard.body, /오늘의 실습 경로/);
  assert.match(model.codingStudioCard.hint, /입문 3/);
});

test("world hub model suppresses coding studio bridge during gather stage to avoid noisy overlap", () => {
  const args = makeBaseModelArgs();
  const viewModel = buildWorldHubHudViewModel({
    ...args,
    runtime: {
      scene: { worldId: "world", title: "월드 허브", subtitle: "테스트" },
      spawn: { x: 0, y: 0, z: 0, yaw: 0 },
      portals: [],
      kiosk: { title: "아카데미 롯지", summary: "준비", hintLabel: "안내" },
      hud: { movementLabel: "WASD", interactionLabel: "E", runtimeBadge: "테스트" },
      progress: { recentMissionCompletion: null },
      liveSession: {
        status: "teacher-guided",
        cueState: "prepare_at_academy",
      },
    } as never,
    kioskFocused: true,
  });

  assert.equal(viewModel.classSessionGuidanceCard?.stage, "prepare");
  assert.equal(viewModel.codingStudioCard.visible, false);
});
