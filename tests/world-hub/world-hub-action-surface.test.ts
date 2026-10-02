import assert from "node:assert/strict";
import test from "node:test";

import { getDefaultWorldHubManifest } from "@/lib/world-hub/config/defaultManifest";
import { buildWorldHubHudViewModel } from "@/lib/world-hub/runtime/worldHubHudModel";
import { resolveWorldHubHintDensity } from "@/lib/world-hub/runtime/worldHubHintDensity";

function buildBaseArgs() {
  const manifest = getDefaultWorldHubManifest();
  const selectedPortal = manifest.portals[0]!;

  return {
    runtime: {
      scene: {
        worldId: manifest.worldId,
        title: manifest.title,
        subtitle: manifest.subtitle,
      },
      spawn: manifest.spawn,
      portals: manifest.portals.map((portal, index) =>
        index === 0
          ? {
              ...portal,
              entryCue: "suggested",
              availability: "available",
            }
          : portal),
      kiosk: manifest.kiosk,
      hud: manifest.hud,
      progress: {
        recentMissionCompletion: null,
      },
      liveSession: {
        status: "mission-starting-soon",
        cueState: "start_mission",
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
    focusedPortal: selectedPortal,
    kioskFocused: false,
    joiningPortalId: null,
    selectedPortalId: selectedPortal.id,
    selectedPortalPolicy: null,
    identitySummary: {
      profile: {
        detail: "홈을 둘러보고 출발해요",
        lastMissionTitle: "새벽빛 트레일",
        persistenceLabel: "프로필 연동",
        rewardLabel: null,
        completionLabel: null,
        hasCompletedMission: true,
        hasRecentReward: true,
      },
      collectible: {
        collectibleCount: 0,
        highlightedCollectibleLabel: null,
      },
      source: {
        label: "로컬 프리뷰",
        diagnostics: {
          derivedFrom: "runtime",
        },
      },
    } as never,
    homeZoneState: "away" as const,
    ambientFeedback: null,
    homeAcknowledgement: null,
    homeRepeatVisitCue: null,
    homeLanePersonalization: {
      title: "개인 포인트",
      detail: "준비 상태를 차분히 정리해요",
      readyCount: 1,
      signals: [],
    },
    classCelebrationSummary: null,
    sessionCelebrationSummary: null,
    seasonalDecorationSummary: null,
    presentationProgression: {
      currentStage: "portal",
      emphasis: "ready-to-depart",
      homeAnchorPresence: "supporting",
      suggestionProminence: "secondary",
      readinessProminence: "primary",
      pathGuidanceProminence: "primary",
      academyTempoProminence: "resting",
      portalAnticipationProminence: "primary",
    },
    recentMissionResult: null,
  };
}

test("near or focused portal produces a visible portal action card", () => {
  const viewModel = buildWorldHubHudViewModel(buildBaseArgs());
  assert.equal(viewModel.classSessionGuidanceCard?.stage, "launch");
  assert.equal(viewModel.portalActionCard.visible, true);
  assert.match(viewModel.portalActionCard.title, /도착했어요/);
});

test("portal action card is calmer while preparing and stronger when ready", () => {
  const baseArgs = buildBaseArgs();
  const preparing = buildWorldHubHudViewModel({
    ...baseArgs,
    runtime: {
      ...baseArgs.runtime,
      portals: baseArgs.runtime.portals.map((portal) =>
        portal.id === baseArgs.selectedPortalId
          ? {
              ...portal,
              availability: "queued",
            }
          : portal),
    },
  });
  const ready = buildWorldHubHudViewModel(baseArgs);

  assert.equal(preparing.portalActionCard.mode, "preparing");
  assert.notEqual(preparing.portalActionCard.actionHint, "Enter 또는 E로 이어가기");
  assert.equal(ready.portalActionCard.mode, "ready");
  assert.equal(ready.portalActionCard.actionHint, "Enter 또는 E로 이어가기");
});

test("irrelevant portal state de-emphasizes action card", () => {
  const baseArgs = buildBaseArgs();
  const viewModel = buildWorldHubHudViewModel({
    ...baseArgs,
    runtime: {
      ...baseArgs.runtime,
      portals: baseArgs.runtime.portals.map((portal) => ({
        ...portal,
        availability: "queued",
        entryCue: "unavailable",
      })),
    },
    focusedPortal: null,
    selectedPortalId: null,
    presentationProgression: {
      ...baseArgs.presentationProgression,
      currentStage: "home",
      readinessProminence: "subtle",
      pathGuidanceProminence: "resting",
      portalAnticipationProminence: "resting",
    },
  });
  assert.equal(viewModel.portalActionCard.prominence, "subtle");
});

test("fresh home return produces compact return summary cue", () => {
  const baseArgs = buildBaseArgs();
  const viewModel = buildWorldHubHudViewModel({
    ...baseArgs,
    homeZoneState: "arrived",
    ambientFeedback: {
      kind: "return",
      eyebrow: "다시 돌아왔어요",
      title: "복귀",
      detail: "복귀",
      tone: "return",
      chips: ["복귀"],
    } as never,
  });
  assert.equal(viewModel.returnSummaryCue.visible, true);
  assert.equal(viewModel.returnSummaryCue.title, "홈으로 돌아와 학습 흐름을 정리했어요");
  assert.equal(
    viewModel.returnSummaryCue.body,
    "다음 실습 또는 모험을 차분히 선택해 이어갈 수 있어요",
  );
});

test("return summary is de-emphasized when portal state is primary", () => {
  const density = resolveWorldHubHintDensity({
    onboardingPhase: "compact",
    homeZoneState: "arrived",
    progression: {
      currentStage: "portal",
      emphasis: "ready-to-depart",
      homeAnchorPresence: "supporting",
      suggestionProminence: "secondary",
      readinessProminence: "primary",
      pathGuidanceProminence: "primary",
      academyTempoProminence: "resting",
      portalAnticipationProminence: "primary",
    },
    hasAmbientFeedback: false,
    hasFocusedPortal: true,
    hasSelectedPortal: true,
    hasPortalEntryFeedback: true,
    hasClassSessionGuidance: false,
    classSessionStage: null,
  });
  assert.equal(density.primarySurface, "portal");
  assert.equal(density.showAmbientFeedback, false);
});

test("portal and return action copy remains concise Korean", () => {
  const viewModel = buildWorldHubHudViewModel(buildBaseArgs());
  assert.match(viewModel.portalActionCard.title, /포털|도착했어요|트레일/);
  assert.equal(viewModel.returnSummaryCue.visible, false);

  const returned = buildWorldHubHudViewModel({
    ...buildBaseArgs(),
    homeZoneState: "arrived",
    ambientFeedback: {
      kind: "return",
      eyebrow: "다시 돌아왔어요",
      title: "복귀",
      detail: "복귀",
      tone: "return",
      chips: ["복귀"],
    } as never,
  });
  assert.match(
    returned.returnSummaryCue.body,
    /다음 (?:실습 또는 )?모험/,
  );
});
