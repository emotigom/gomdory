import type { WorldHubRuntimeInputs } from "@/lib/world-hub/contracts";
import type { WorldHubMissionResultReturnEnvelope } from "@/lib/world-hub/mission/resultHandoff";
import type { MetaverseResolvedIdentitySummary } from "@/lib/world-hub/identity/contracts";
import type { AccessPolicyDecision } from "@/lib/world-hub/policy/contracts";
import type { WorldHubResolvedSceneLoading } from "@/lib/world-hub/assets/sceneLoading";
import type { WorldHubAmbientFeedback, WorldHubHomeZoneState } from "@/lib/world-hub/runtime/homeArrivalFeedback";
import type { WorldHubJourneyPresentationProgression } from "@/lib/world-hub/runtime/journeyPresentationProgression";
import type { WorldHubHomeAnchorAcknowledgementView } from "@/lib/world-hub/runtime/homeAnchorAcknowledgement";
import type { WorldHubHomeLanePlaceholderSignal } from "@/lib/world-hub/runtime/homeLanePersonalization";
import type { WorldHubHomeRepeatVisitCue } from "@/lib/world-hub/runtime/homeRepeatVisitCue";
import {
  resolveWorldHubNextAdventureReadinessCue,
  type WorldHubNextAdventureReadinessCue,
} from "@/lib/world-hub/runtime/nextAdventureReadinessCue";
import { resolveWorldHubBadgeShelf, type WorldHubBadgeShelfView } from "@/lib/world-hub/runtime/badgeShelf";
import type { WorldHubClassCelebrationSummary } from "@/lib/world-hub/runtime/classCelebrationCues";
import type { WorldHubSessionCelebrationSummary } from "@/lib/world-hub/runtime/sessionCelebrationAccents";
import type { WorldHubSeasonalDecorationSummary } from "@/lib/world-hub/seasonal/contracts";
import { resolveWorldHubRecentJourneyView, type WorldHubRecentJourneyView } from "@/lib/world-hub/runtime/recentJourney";
import {
  resolveWorldHubNextAdventureSuggestionCue,
  type WorldHubNextAdventureSuggestionCue,
} from "@/lib/world-hub/runtime/nextAdventureSuggestionCue";
import {
  resolveWorldHubJourneyPathGuidance,
  type WorldHubJourneyPathGuidance,
} from "@/lib/world-hub/runtime/journeyPathGuidance";
import {
  resolveWorldHubClassSessionGuidanceCard,
  type WorldHubClassSessionGuidanceCard,
} from "@/lib/world-hub/runtime/worldHubClassSessionGuidance";
import { getLessonById } from "@/lib/coding-studio/lessons";
import type { LessonId } from "@/lib/coding-studio/types";

const HUD_BADGE_TONE_BY_STAGE = {
  loading: "sky",
  "partial-ready": "amber",
  ready: "emerald",
  fallback: "amber",
  unavailable: "rose",
} as const;

type HudBadgeTone = (typeof HUD_BADGE_TONE_BY_STAGE)[keyof typeof HUD_BADGE_TONE_BY_STAGE];

function resolveHudBadgeTone(stage: WorldHubResolvedSceneLoading["stage"]): HudBadgeTone {
  return HUD_BADGE_TONE_BY_STAGE[stage as keyof typeof HUD_BADGE_TONE_BY_STAGE] ?? "amber";
}

export type WorldHubHudViewModel = {
  identity: {
    eyebrow: string;
    title: string;
    subtitle: string;
  };
  homeAnchor: {
    eyebrow: string;
    title: string;
    detail: string;
    statusLabel: string;
    returnLabel: string | null;
    emphasis: "idle" | "soft" | "warm";
    acknowledgement: WorldHubHomeAnchorAcknowledgementView | null;
    repeatVisitCue: WorldHubHomeRepeatVisitCue | null;
    personalization: {
      title: string;
      detail: string;
      readyCount: number;
      signals: WorldHubHomeLanePlaceholderSignal[];
    };
  };
  adventure: {
    eyebrow: string;
    title: string;
    detail: string;
    statusLabel: string;
    ctaLabel: string;
    disabled: boolean;
  };
  prompt: {
    eyebrow: string;
    label: string;
    detail: string;
    hint: string;
  };
  classSessionGuidanceCard: WorldHubClassSessionGuidanceCard | null;
  portalActionCard: {
    visible: boolean;
    prominence: "primary" | "secondary" | "subtle";
    mode: "preparing" | "ready";
    title: string;
    body: string;
    actionHint: string;
  };
  codingStudioCard: {
    visible: boolean;
    title: string;
    body: string;
    ctaLabel: string;
    hint: string;
  };
  returnSummaryCue: {
    visible: boolean;
    title: string;
    body: string;
    tone: "warm" | "settled";
  };
  sceneBadge: {
    label: string;
    detail: string;
    tone: HudBadgeTone;
  };
  badgeShelf: WorldHubBadgeShelfView;
  recentJourney: WorldHubRecentJourneyView;
  nextAdventureSuggestion: WorldHubNextAdventureSuggestionCue;
  homeReadinessCue: WorldHubNextAdventureReadinessCue;
  journeyPathGuidance: WorldHubJourneyPathGuidance;
  ambientFeedback: WorldHubAmbientFeedback | null;
  classCelebration: WorldHubClassCelebrationSummary | null;
  sessionCelebration: WorldHubSessionCelebrationSummary | null;
  seasonalDecoration: WorldHubSeasonalDecorationSummary | null;
  presentationProgression: WorldHubJourneyPresentationProgression;
};

export function buildWorldHubHudViewModel(args: {
  runtime: WorldHubRuntimeInputs | null;
  sceneLoading: WorldHubResolvedSceneLoading;
  statusText: string;
  loading: boolean;
  errorText: string | null;
  focusedPortal: WorldHubRuntimeInputs["portals"][number] | null;
  kioskFocused: boolean;
  joiningPortalId: string | null;
  selectedPortalId: string | null;
  selectedPortalPolicy: AccessPolicyDecision | null;
  identitySummary: MetaverseResolvedIdentitySummary;
  homeZoneState: WorldHubHomeZoneState;
  ambientFeedback: WorldHubAmbientFeedback | null;
  homeAcknowledgement: WorldHubHomeAnchorAcknowledgementView | null;
  homeRepeatVisitCue: WorldHubHomeRepeatVisitCue | null;
  homeLanePersonalization: {
    title: string;
    detail: string;
    readyCount: number;
    signals: WorldHubHomeLanePlaceholderSignal[];
  };
  classCelebrationSummary: WorldHubClassCelebrationSummary | null;
  sessionCelebrationSummary: WorldHubSessionCelebrationSummary | null;
  seasonalDecorationSummary: WorldHubSeasonalDecorationSummary | null;
  presentationProgression: WorldHubJourneyPresentationProgression;
  recentMissionResult: WorldHubMissionResultReturnEnvelope | null;
  codingStudioProgression?: {
    currentLessonId: LessonId;
    nextLessonId: LessonId | null;
  } | null;
  codingStudioAssignment?: {
    title: string;
    currentLessonId: LessonId;
    nextLessonId: LessonId | null;
  } | null;
}): WorldHubHudViewModel {
  const runtimeSceneLoading = args.runtime?.sceneLoading ?? args.sceneLoading;
  const tone = resolveHudBadgeTone(runtimeSceneLoading.stage);
  const focusedPortal = args.focusedPortal;
  const selectedPortal = args.runtime?.portals.find((portal) => portal.id === args.selectedPortalId) ?? null;
  const portalForPrompt = focusedPortal ?? selectedPortal;
  const todaysAdventure =
    portalForPrompt ??
    args.runtime?.portals.find((portal) => portal.entryCue === "suggested") ??
    args.runtime?.portals.find((portal) => portal.availability === "available") ??
    args.runtime?.portals[0] ??
    null;
  const currentCodingLesson = args.codingStudioProgression ? getLessonById(args.codingStudioProgression.currentLessonId) : null;
  const nextCodingLesson =
    args.codingStudioProgression?.nextLessonId ? getLessonById(args.codingStudioProgression.nextLessonId) : null;
  const assignedCurrentLesson = args.codingStudioAssignment ? getLessonById(args.codingStudioAssignment.currentLessonId) : null;
  const assignedNextLesson = args.codingStudioAssignment?.nextLessonId ? getLessonById(args.codingStudioAssignment.nextLessonId) : null;

  const homeAnchor: WorldHubHudViewModel["homeAnchor"] = !args.runtime
    ? {
        eyebrow: "홈",
        title: "따뜻한 숲속 베이스캠프",
        detail: "모닥불과 귀환 길을 준비하고 있어요…",
        statusLabel: "캠프 기억 정리 중",
        returnLabel: null,
        emphasis: "idle",
        acknowledgement: null,
        repeatVisitCue: null,
        personalization: args.homeLanePersonalization,
      }
    : {
        eyebrow: "홈",
        title: args.runtime.scene.title,
        detail:
          args.identitySummary.profile.detail ??
          "잠깐 머물며 주변을 둘러보고, 준비되면 오늘의 길로 출발해 보세요.",
        statusLabel:
          args.homeZoneState === "arrived"
            ? "홈 공간 근처"
            : args.homeZoneState === "approaching"
              ? "모닥불이 가까워요"
              : args.identitySummary.source.label,
        returnLabel: args.identitySummary.profile.lastMissionTitle,
        emphasis:
          args.homeAcknowledgement?.emphasis === "fresh"
            ? "warm"
            : args.homeAcknowledgement?.emphasis === "settled"
              ? "soft"
              : args.homeZoneState === "arrived"
                ? "warm"
                : args.homeZoneState === "approaching"
                  ? "soft"
                  : "idle",
        acknowledgement: args.homeAcknowledgement,
        repeatVisitCue: args.homeRepeatVisitCue,
        personalization: args.homeLanePersonalization,
      };

  const liveSessionCue = args.runtime?.liveSession ?? null;
  const classSessionGuidanceCard = resolveWorldHubClassSessionGuidanceCard({
    liveSession: liveSessionCue,
    hasFocusedPortal: Boolean(focusedPortal),
    hasSelectedPortal: Boolean(selectedPortal),
    kioskFocused: args.kioskFocused,
  });

  const prompt = (() => {
    if (classSessionGuidanceCard?.stage === "gather" && !focusedPortal && !args.kioskFocused) {
      return {
        eyebrow: "학급 흐름",
        label: "광장 모임 흐름이 진행 중이에요",
        detail: "중앙 안내 카드에서 우리 반 단계를 확인하고, 광장에서 함께 모여 주세요.",
        hint: "학급 안내를 따라 이동하면 돼요",
      };
    }

    if ((classSessionGuidanceCard?.stage === "prepare" || classSessionGuidanceCard?.stage === "launch") && args.kioskFocused && args.runtime) {
      return {
        eyebrow: classSessionGuidanceCard.stage === "launch" ? "출발 흐름" : "학급 흐름",
        label: classSessionGuidanceCard.stage === "launch" ? "출발 직전 단계예요" : `${args.runtime.kiosk.title} · 함께 준비 중`,
        detail:
          classSessionGuidanceCard.stage === "launch"
            ? "포털 이동 전 마지막 준비를 확인하는 시간이에요."
            : "아카데미에서 목표를 정리한 뒤, 다음 신호에 맞춰 이동해요.",
        hint:
          classSessionGuidanceCard.stage === "launch"
            ? "학급 안내 카드와 포털 안내를 함께 확인하세요"
            : `${args.runtime.kiosk.hintLabel} · 아카데미 근처에서 신호를 기다려요`,
      };
    }

    if (args.loading) {
      return {
        eyebrow: "안내",
        label: "베이스캠프에 도착 중",
        detail: args.statusText,
        hint: "잠시만 기다려 주세요.",
      };
    }

    if (todaysAdventure && args.joiningPortalId === todaysAdventure.id) {
      return {
        eyebrow: "안내",
        label: `${todaysAdventure.label} 모험으로 출발해요`,
        detail: "지금 길이 열리고 있어요.",
        hint: "잠시 대기해 주세요.",
      };
    }

    if (
      liveSessionCue?.cueState === "prepare_at_academy" &&
      args.runtime &&
      !args.kioskFocused &&
      !focusedPortal &&
      todaysAdventure
    ) {
      return {
        eyebrow: "출발 안내",
        label: `아카데미 준비 완료 · 다음은 ${todaysAdventure.label}`,
        detail: "아카데미에서 포털 언덕으로 이어지는 부드러운 출발 리듬이 활성화됐어요.",
        hint: "은은한 길 안내를 따라 언덕으로 이동하고, 팀이 준비되면 출발하세요.",
      };
    }

    if (args.homeZoneState === "arrived") {
      return {
        eyebrow: "안내",
        label: "홈 중심에 도착했어요",
        detail: "베이스캠프 중심으로 돌아왔어요. 잠깐 머물며 차분히 리셋해도 좋아요.",
        hint:
          args.homeLanePersonalization.readyCount > 0
            ? "포치 표식에서 새 기록을 확인하고, 준비되면 출발해 보세요."
            : (args.runtime?.kiosk.hintLabel ?? "모닥불 표식 근처에서 E 키를 눌러요."),
      };
    }

    if (args.homeZoneState === "approaching") {
      return {
        eyebrow: "안내",
        label: "홈 공간으로 이동 중",
        detail: "모닥불이 가까워요. 다시 출발하기 전, 이곳에서 팀을 정리하기 좋아요.",
        hint: args.runtime?.hud.movementLabel ?? "WASD로 이동 · E 키로 상호작용",
      };
    }

    if (focusedPortal) {
      if (liveSessionCue?.cueState === "start_mission") {
        return {
          eyebrow: "출발 신호",
          label: `${focusedPortal.label} 출발 준비 완료`,
          detail: "학급의 미션 시작 신호가 활성화되어 있어요.",
          hint: "팀과 함께 머물다가 모두 준비되면 Enter 키를 눌러요.",
        };
      }
      if (focusedPortal.entryCue === "unavailable") {
        return {
          eyebrow: "안내",
          label: `${focusedPortal.label} 포털이 잠시 쉬고 있어요`,
          detail: focusedPortal.summary,
          hint: "다른 빛나는 길잡이로 이동해 보세요.",
        };
      }
      return {
        eyebrow: "안내",
        label: `${focusedPortal.label} 근처`,
        detail: focusedPortal.summary,
        hint:
          focusedPortal.entryCue === "suggested"
            ? "오늘의 학급 모험이에요. Enter 키로 출발하세요."
            : "E 키로 준비하고, Enter 키로 출발해요.",
      };
    }

    if (args.kioskFocused && args.runtime) {
      const suggestedPortal =
        args.runtime.portals.find((portal) => portal.entryCue === "suggested" && portal.availability === "available") ??
        args.runtime.portals.find((portal) => portal.entryCue === "suggested") ??
        null;
      if (liveSessionCue?.cueState === "gather_at_plaza") {
        return {
          eyebrow: "광장 신호",
          label: `${args.runtime.kiosk.title} · 먼저 모이기`,
          detail: "아카데미 준비 전, 선생님이 광장에서 모두를 모으고 있어요.",
          hint: "광장 모닥불에 들렀다가 함께 이곳으로 돌아오세요.",
        };
      }
      return {
        eyebrow: "안내",
        label: `${args.runtime.kiosk.title} · 미션 준비`,
        detail:
          suggestedPortal
            ? `${args.runtime.kiosk.summary} 다음: ${suggestedPortal.label}.`
            : `${args.runtime.kiosk.summary} 팀이 준비되면 빛나는 게이트를 선택해 보세요.`,
        hint: `${args.runtime.kiosk.hintLabel} · 포털이 실제 모험 출발 게이트예요.`,
      };
    }

    if (args.errorText) {
      return {
        eyebrow: "안내",
        label: "베이스캠프를 잠깐 정리할게요",
        detail: args.errorText,
        hint: "아래 로컬 부트스트랩 재시도를 눌러 주세요.",
      };
    }

    return {
      eyebrow: "안내",
      label: "숲속 광장을 둘러보세요",
      detail: "홈은 안정을, 광장은 모임을, 아카데미 롯지는 출발 준비를 돕는 공간이에요.",
      hint: args.runtime?.hud.movementLabel ?? "WASD로 이동 · E 키로 상호작용",
    };
  })();

  const adventureStatusLabel =
    args.selectedPortalPolicy?.label ?? todaysAdventure?.statusLabel ?? runtimeSceneLoading.summaryLabel;
  const adventureDisabled =
    !todaysAdventure ||
    args.joiningPortalId === todaysAdventure.id ||
    args.selectedPortalPolicy?.status === "blocked" ||
    todaysAdventure.entryCue === "unavailable";

  const badgeShelf = resolveWorldHubBadgeShelf({
    identitySummary: args.identitySummary,
    acknowledgement: args.homeAcknowledgement,
  });

  const recentJourney = resolveWorldHubRecentJourneyView({
    runtime: args.runtime,
    identitySummary: args.identitySummary,
    homeRepeatVisitCue: args.homeRepeatVisitCue,
  });
  const nextAdventureSuggestion = resolveWorldHubNextAdventureSuggestionCue({
    runtime: args.runtime,
    identitySummary: args.identitySummary,
    recentJourney,
  });
  const homeReadinessCue = resolveWorldHubNextAdventureReadinessCue({
    runtime: args.runtime,
    homeZoneState: args.homeZoneState,
    recentJourney,
    suggestion: nextAdventureSuggestion,
  });
  const journeyPathGuidance = resolveWorldHubJourneyPathGuidance({
    runtime: args.runtime,
    suggestion: nextAdventureSuggestion,
    readiness: homeReadinessCue,
    homeZoneState: args.homeZoneState,
  });

  const focusedOrSelectedPortal = focusedPortal ?? selectedPortal ?? todaysAdventure;
  const classGuidanceStage = classSessionGuidanceCard?.stage ?? null;
  const portalPrimaryContext =
    Boolean(focusedPortal) ||
    Boolean(selectedPortal) ||
    journeyPathGuidance.status === "active" ||
    homeReadinessCue.status === "ready";
  const portalShouldShow =
    Boolean(focusedOrSelectedPortal) &&
    portalPrimaryContext &&
    !(classGuidanceStage === "gather" && !focusedPortal && !selectedPortal) &&
    !(classGuidanceStage === "prepare" && !focusedPortal && !selectedPortal && !args.kioskFocused);
  const portalActionMode: "preparing" | "ready" =
    homeReadinessCue.status === "ready" && focusedOrSelectedPortal?.availability === "available" ? "ready" : "preparing";
  const portalActionCard: WorldHubHudViewModel["portalActionCard"] = portalShouldShow
    ? {
        visible: true,
        prominence:
          classGuidanceStage === "launch"
            ? portalActionMode === "ready"
              ? "secondary"
              : "subtle"
            : classGuidanceStage === "gather" || classGuidanceStage === "prepare"
              ? focusedPortal
                ? "secondary"
                : "subtle"
              : portalActionMode === "ready"
                ? "primary"
                : focusedPortal
                  ? "secondary"
                  : "subtle",
        mode: portalActionMode,
        title: `${focusedOrSelectedPortal?.label ?? "포털"} 앞에 도착했어요`,
        body:
          focusedOrSelectedPortal?.summary ??
          (portalActionMode === "ready" ? "오늘의 모험으로 이어질 수 있어요." : "다음 모험이 열릴 때까지 차분히 준비할 수 있어요."),
        actionHint:
          portalActionMode === "ready"
            ? "Enter 또는 E로 이어가기"
            : "조금 더 둘러보거나 바로 이어갈 수 있어요",
      }
    : {
        visible: false,
        prominence: "subtle",
        mode: "preparing",
        title: "포털 안내",
        body: "",
        actionHint: "",
      };


  const shouldShowCodingStudioCard =
    (args.kioskFocused || liveSessionCue?.cueState === "prepare_at_academy") &&
    classGuidanceStage === null;

  const codingStudioCard: WorldHubHudViewModel["codingStudioCard"] =
    shouldShowCodingStudioCard
      ? {
          visible: true,
          title: args.codingStudioAssignment ? "오늘 수업용 실습 경로가 준비되어 있어요" : "아카데미 학습을 3D 코딩 실습으로 이어가요",
          body: args.codingStudioAssignment
            ? `${args.codingStudioAssignment.title} · 현재 ${assignedCurrentLesson?.title ?? "레슨 준비"}${assignedNextLesson ? ` · 다음 ${assignedNextLesson.title}` : ""}`
            : currentCodingLesson
              ? `현재 단계: ${currentCodingLesson.title}${nextCodingLesson ? ` · 다음 ${nextCodingLesson.title}` : ""}`
              : "아카데미에서 정리한 전략을 실행하고, 결과 근거를 남기는 코딩 루프로 이어가 보세요.",
          ctaLabel: args.codingStudioAssignment ? "지정 실습 이어가기" : "코딩 스튜디오 시작",
          hint: args.codingStudioAssignment
            ? assignedNextLesson
              ? `다음 준비: ${assignedNextLesson.title}`
              : "지정 경로를 마무리했어요. 복습 실습도 이어갈 수 있어요."
            : nextCodingLesson
              ? `다음 준비: ${nextCodingLesson.title}`
              : "아카데미 정리 → 스튜디오 실행·수정 → 허브 복귀 회고",
        }
      : {
          visible: false,
          title: "",
          body: "",
          ctaLabel: "",
          hint: "",
        };

  const hasFreshReturn =
    Boolean(args.recentMissionResult) ||
    args.homeAcknowledgement?.origin === "recent-return" ||
    args.ambientFeedback?.kind === "return";
  const returnSummaryCue: WorldHubHudViewModel["returnSummaryCue"] =
    hasFreshReturn && args.homeZoneState !== "away"
      ? {
          visible: true,
          title: "홈으로 돌아와 학습 흐름을 정리했어요",
          body: nextCodingLesson ? `코딩 스튜디오 다음 단계: ${nextCodingLesson.title}` : "다음 실습 또는 모험을 차분히 선택해 이어갈 수 있어요",
          tone: args.homeAcknowledgement?.emphasis === "fresh" || args.ambientFeedback?.kind === "return" ? "warm" : "settled",
        }
      : {
          visible: false,
          title: "",
          body: "",
          tone: "settled",
        };

  return {
    identity: {
      eyebrow: "월드 허브",
      title: args.runtime?.scene.title ?? "숲속 모험 베이스캠프",
      subtitle: args.runtime?.scene.subtitle ?? "오늘의 길을 나서기 전, 따뜻한 숲속 공간",
    },
    homeAnchor,
    adventure: {
      eyebrow: "오늘의 모험",
      title: todaysAdventure?.label ?? "다음 길이 준비되고 있어요",
      detail: todaysAdventure?.summary ?? "장면 준비가 끝나면 다음 모험이 여기에 표시돼요.",
      statusLabel: adventureStatusLabel,
      ctaLabel:
        args.joiningPortalId === todaysAdventure?.id
          ? "출발 중…"
          : todaysAdventure?.entryCue === "unavailable"
            ? "곧 모험이 열려요"
          : `출발 · ${todaysAdventure?.label ?? "모험"}`,
      disabled: adventureDisabled,
    },
    prompt,
    classSessionGuidanceCard,
    portalActionCard,
    codingStudioCard,
    returnSummaryCue,
    sceneBadge: {
      label: runtimeSceneLoading.summaryLabel,
      detail: runtimeSceneLoading.detail,
      tone,
    },
    badgeShelf,
    recentJourney,
    nextAdventureSuggestion,
    homeReadinessCue,
    journeyPathGuidance,
    ambientFeedback: args.ambientFeedback
      ? {
          ...args.ambientFeedback,
          chips:
            args.ambientFeedback.kind === "return"
              ? [
                  args.identitySummary.profile.persistenceLabel ?? "프로필 연동 신호 활성",
                  ...args.ambientFeedback.chips,
                ]
              : args.ambientFeedback.chips,
        }
      : null,
    classCelebration: args.classCelebrationSummary,
    sessionCelebration: args.sessionCelebrationSummary,
    seasonalDecoration: args.seasonalDecorationSummary,
    presentationProgression: args.presentationProgression,
  };
}
