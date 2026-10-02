import assert from "node:assert/strict";
import test from "node:test";

import { getDefaultWorldHubManifest } from "@/lib/world-hub/config/defaultManifest";
import { buildWorldHubHudViewModel } from "@/lib/world-hub/runtime/worldHubHudModel";
import { resolveWorldHubHintDensity } from "@/lib/world-hub/runtime/worldHubHintDensity";

function baseArgs() {
  const manifest = getDefaultWorldHubManifest();
  return {
    runtime: {
      scene: {
        worldId: manifest.worldId,
        title: manifest.title,
        subtitle: manifest.subtitle,
      },
      spawn: manifest.spawn,
      portals: manifest.portals,
      kiosk: manifest.kiosk,
      hud: manifest.hud,
      progress: { recentMissionCompletion: null },
      liveSession: {
        status: "self-paced-open",
        cueState: "none",
      },
    } as never,
    sceneLoading: {
      stage: "ready",
      summaryLabel: "준비 완료",
      detail: "로컬 장면 로드 완료",
    } as never,
    statusText: "ready",
    loading: false,
    errorText: null,
    focusedPortal: null,
    kioskFocused: false,
    joiningPortalId: null,
    selectedPortalId: null,
    selectedPortalPolicy: null,
    identitySummary: {
      profile: {
        detail: "홈을 둘러보고 출발해요",
        lastMissionTitle: null,
        persistenceLabel: null,
        rewardLabel: null,
        completionLabel: null,
        hasCompletedMission: false,
        hasRecentReward: false,
      },
      collectible: {
        collectibleCount: 0,
        highlightedCollectibleLabel: null,
      },
      source: {
        label: "로컬 프리뷰",
        diagnostics: { derivedFrom: "runtime" },
      },
    } as never,
    homeZoneState: "away" as const,
    ambientFeedback: null,
    homeAcknowledgement: null,
    homeRepeatVisitCue: null,
    homeLanePersonalization: {
      title: "개인 포인트",
      detail: "준비 상태를 차분히 정리해요",
      readyCount: 0,
      signals: [],
    },
    classCelebrationSummary: null,
    sessionCelebrationSummary: null,
    seasonalDecorationSummary: null,
    presentationProgression: {
      currentStage: "home",
      emphasis: "settled-home",
      homeAnchorPresence: "primary",
      suggestionProminence: "secondary",
      readinessProminence: "subtle",
      pathGuidanceProminence: "subtle",
      academyTempoProminence: "resting",
      portalAnticipationProminence: "resting",
    },
    recentMissionResult: null,
  };
}

test("self-paced-open does not render class session hero guidance", () => {
  const viewModel = buildWorldHubHudViewModel(baseArgs());
  assert.equal(viewModel.classSessionGuidanceCard, null);
});

test("teacher-guided gather_at_plaza renders plaza-stage guidance", () => {
  const args = baseArgs();
  const viewModel = buildWorldHubHudViewModel({
    ...args,
    runtime: {
      ...args.runtime,
      liveSession: {
        status: "teacher-guided",
        cueState: "gather_at_plaza",
      },
    },
  });

  assert.equal(viewModel.classSessionGuidanceCard?.stage, "gather");
  assert.equal(viewModel.classSessionGuidanceCard?.title, "지금은 광장에 모일 시간이에요");
  assert.match(viewModel.classSessionGuidanceCard?.hint ?? "", /광장 빛/);
  assert.equal(viewModel.portalActionCard.visible, false);
});

test("teacher-guided prepare_at_academy renders academy-stage guidance", () => {
  const args = baseArgs();
  const viewModel = buildWorldHubHudViewModel({
    ...args,
    runtime: {
      ...args.runtime,
      liveSession: {
        status: "teacher-guided",
        cueState: "prepare_at_academy",
      },
    },
  });

  assert.equal(viewModel.classSessionGuidanceCard?.stage, "prepare");
  assert.equal(viewModel.classSessionGuidanceCard?.title, "아카데미에서 출발 준비를 하고 있어요");
});

test("mission-starting-soon start_mission renders launch-stage guidance", () => {
  const args = baseArgs();
  const viewModel = buildWorldHubHudViewModel({
    ...args,
    runtime: {
      ...args.runtime,
      liveSession: {
        status: "mission-starting-soon",
        cueState: "start_mission",
      },
    },
  });

  assert.equal(viewModel.classSessionGuidanceCard?.stage, "launch");
  assert.equal(viewModel.classSessionGuidanceCard?.eyebrow, "출발 안내");
  assert.equal(viewModel.classSessionGuidanceCard?.hint, "포털 앞에서 Enter 또는 E로 이어가기");
});

test("class guidance becomes primary hint surface and onboarding recedes", () => {
  const density = resolveWorldHubHintDensity({
    onboardingPhase: "expanded",
    homeZoneState: "away",
    progression: {
      currentStage: "home",
      emphasis: "settled-home",
      homeAnchorPresence: "primary",
      suggestionProminence: "secondary",
      readinessProminence: "subtle",
      pathGuidanceProminence: "subtle",
      academyTempoProminence: "resting",
      portalAnticipationProminence: "resting",
    },
    hasAmbientFeedback: false,
    hasFocusedPortal: false,
    hasSelectedPortal: false,
    hasPortalEntryFeedback: false,
    hasClassSessionGuidance: true,
    classSessionStage: "gather",
  });

  assert.equal(density.primarySurface, "class-session");
  assert.equal(density.classSessionProminence, "primary");
  assert.equal(density.onboardingProminence, "subtle");
});
