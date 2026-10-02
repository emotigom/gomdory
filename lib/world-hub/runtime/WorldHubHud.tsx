"use client";

import type { ReactNode } from "react";

import type { WorldHubHudViewModel } from "./worldHubHudModel";
import type { WorldHubPortalEntryMicroFeedback } from "./portalEntryMicroFeedback";
import type { WorldHubFirstVisitOnboardingView } from "./worldHubFirstVisitOnboarding";
import type { WorldHubHintDensity, WorldHubHintProminence } from "./worldHubHintDensity";

const BADGE_TONE_CLASSES: Record<WorldHubHudViewModel["sceneBadge"]["tone"], string> = {
  sky: "border-sky-200/20 bg-sky-300/10 text-sky-50",
  amber: "border-amber-200/20 bg-amber-300/10 text-amber-50",
  emerald: "border-emerald-200/20 bg-emerald-300/10 text-emerald-50",
  rose: "border-rose-200/20 bg-rose-300/10 text-rose-50",
};

function HudChip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-white/10 bg-black/15 px-3 py-1.5 text-[11px] text-slate-100/88">
      {children}
    </span>
  );
}


function FirstVisitOnboardingBand(args: {
  onboarding: WorldHubFirstVisitOnboardingView;
  prominence: WorldHubHintProminence;
  onDismiss: () => void;
}) {
  const { onboarding, prominence } = args;
  if (onboarding.phase === "hidden") {
    return null;
  }

  if (onboarding.phase === "compact") {
    const toneClasses =
      prominence === "subtle"
        ? "border-emerald-100/10 bg-[linear-gradient(180deg,rgba(16,185,129,0.1),rgba(15,23,42,0.45))] text-emerald-100/85 opacity-85"
        : "border-emerald-100/25 bg-[linear-gradient(180deg,rgba(16,185,129,0.2),rgba(15,23,42,0.55))] text-emerald-50";
    return (
      <div className="pointer-events-auto absolute left-4 top-4 z-20 max-w-[calc(100%-2rem)] sm:left-5 sm:top-5 lg:left-6 lg:top-6">
        <section className={`rounded-2xl border px-3 py-2 text-[11px] shadow-[0_10px_30px_rgba(2,6,23,0.35)] backdrop-blur-md sm:text-xs ${toneClasses}`}>
          <div className="flex items-center gap-2">
            <span>{onboarding.compactLabel}</span>
            <button
              aria-label={onboarding.dismissLabel}
              className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] text-white/85 transition hover:border-white/40 hover:text-white"
              onClick={args.onDismiss}
              type="button"
            >
              {onboarding.dismissLabel}
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="pointer-events-auto absolute inset-x-4 top-4 z-20 sm:inset-x-5 sm:top-5 lg:inset-x-6 lg:top-6">
      <section className="mx-auto max-w-3xl rounded-[24px] border border-emerald-100/25 bg-[linear-gradient(180deg,rgba(16,185,129,0.2),rgba(15,23,42,0.65))] p-4 text-white shadow-[0_14px_44px_rgba(2,6,23,0.38)] backdrop-blur-md sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-100/80">첫 방문 안내</p>
            <h2 className="mt-1 text-base font-semibold text-white sm:text-lg">{onboarding.title}</h2>
            <p className="mt-1 text-xs leading-5 text-emerald-50/92 sm:text-sm">{onboarding.body}</p>
          </div>
          <button
            aria-label={onboarding.dismissLabel}
            className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/90 transition hover:border-white/45 hover:text-white"
            onClick={args.onDismiss}
            type="button"
          >
            {onboarding.dismissLabel}
          </button>
        </div>
        <ul className="mt-3 grid gap-1.5 text-[11px] text-emerald-50/90 sm:grid-cols-3 sm:gap-2 sm:text-xs">
          {onboarding.controls.map((item) => (
            <li className="rounded-full border border-white/12 bg-black/20 px-3 py-1.5" key={item}>
              {item}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function HomeAcknowledgementCard({
  acknowledgement,
}: {
  acknowledgement: NonNullable<WorldHubHudViewModel["homeAnchor"]["acknowledgement"]>;
}) {
  const toneClasses =
    acknowledgement.emphasis === "fresh"
      ? "border-emerald-200/30 bg-[linear-gradient(180deg,rgba(16,185,129,0.18),rgba(15,23,42,0.2))]"
      : "border-white/10 bg-black/15";

  return (
    <div className={`mt-4 rounded-[22px] border p-3.5 transition ${toneClasses}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-100/80">{acknowledgement.eyebrow}</p>
      <h3 className="mt-1 text-sm font-semibold text-white sm:text-[15px]">{acknowledgement.title}</h3>
      <p className="mt-1 text-xs leading-5 text-slate-100/88 sm:text-sm">{acknowledgement.detail}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <HudChip>{acknowledgement.statusLabel}</HudChip>
        <HudChip>{acknowledgement.completionLabel}</HudChip>
        {acknowledgement.rewardLabel ? <HudChip>{acknowledgement.rewardLabel}</HudChip> : null}
      </div>
    </div>
  );
}

function HomePersonalizationCard({
  personalization,
}: {
  personalization: WorldHubHudViewModel["homeAnchor"]["personalization"];
}) {
  return (
    <div className="mt-4 rounded-[22px] border border-white/10 bg-black/20 p-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-amber-100/80">개인 맞춤 포인트</p>
      <h3 className="mt-1 text-sm font-semibold text-white sm:text-[15px]">{personalization.title}</h3>
      <p className="mt-1 text-xs leading-5 text-slate-100/88 sm:text-sm">{personalization.detail}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {personalization.signals.slice(0, 4).map((signal) => (
          <span
            className={`rounded-full border px-3 py-1.5 text-[11px] ${
              signal.state === "ready" ? "border-emerald-200/35 bg-emerald-300/12 text-emerald-50" : "border-white/10 bg-black/20 text-slate-200/90"
            }`}
            key={signal.id}
            title={`${signal.statusLabel}${signal.projectionValue ? ` · ${signal.projectionValue}` : ""}`}
          >
            {signal.symbol} {signal.label}
          </span>
        ))}
      </div>
      <ul className="mt-3 space-y-1.5 text-[11px] text-slate-200/85">
        {personalization.signals.slice(0, 3).map((signal) => (
          <li className="flex items-start gap-2" key={`${signal.id}-detail`}>
            <span className="mt-0.5 text-[10px] text-slate-400">{signal.symbol}</span>
            <span>
              {signal.statusLabel}
              {signal.projectionValue ? ` · ${signal.projectionValue}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function HomeRepeatVisitCueCard({
  cue,
}: {
  cue: NonNullable<WorldHubHudViewModel["homeAnchor"]["repeatVisitCue"]>;
}) {
  const toneClasses =
    cue.emphasis === "warm"
      ? "border-amber-200/30 bg-amber-300/10"
      : cue.emphasis === "soft"
        ? "border-emerald-200/25 bg-emerald-300/10"
        : "border-white/12 bg-black/20";

  return (
    <div className={`mt-4 rounded-[18px] border p-3 ${toneClasses}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-100/80">{cue.eyebrow}</p>
      <p className="mt-1 text-sm font-semibold text-white">{cue.label}</p>
      <p className="mt-1 text-xs leading-5 text-slate-100/86">{cue.detail}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <HudChip>{cue.chipLabel}</HudChip>
        <HudChip>{cue.totalVisits}회 홈 방문</HudChip>
      </div>
    </div>
  );
}

function AmbientFeedbackCard({ feedback }: { feedback: NonNullable<WorldHubHudViewModel["ambientFeedback"]> }) {
  const toneClasses =
    feedback.tone === "return"
      ? "border-emerald-200/20 bg-[linear-gradient(135deg,rgba(16,185,129,0.22),rgba(22,101,52,0.18))] text-emerald-50 shadow-[0_18px_60px_rgba(5,46,22,0.35)]"
      : "border-amber-200/20 bg-[linear-gradient(135deg,rgba(251,191,36,0.18),rgba(120,53,15,0.16))] text-amber-50 shadow-[0_18px_60px_rgba(120,53,15,0.25)]";

  return (
    <section className={`pointer-events-none max-w-md rounded-[22px] border p-3.5 backdrop-blur-md transition duration-300 ${toneClasses}`}>
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/70">{feedback.eyebrow}</p>
          <h2 className="mt-1 text-sm font-semibold text-white sm:text-[15px]">{feedback.title}</h2>
          <p className="mt-1 text-xs leading-5 text-white/88 sm:text-sm">{feedback.detail}</p>
        </div>
      </div>
      {feedback.chips.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {feedback.chips.slice(0, 2).map((chip) => (
            <HudChip key={chip}>{chip}</HudChip>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function PortalEntryFeedbackCard({ feedback }: { feedback: WorldHubPortalEntryMicroFeedback }) {
  const toneClasses =
    feedback.tone === "warm"
      ? "border-emerald-200/35 bg-[linear-gradient(170deg,rgba(16,185,129,0.22),rgba(15,23,42,0.32))] text-emerald-50"
      : "border-sky-200/25 bg-[linear-gradient(170deg,rgba(56,189,248,0.18),rgba(15,23,42,0.32))] text-sky-50";

  return (
    <section className={`pointer-events-none max-w-sm rounded-2xl border px-4 py-3 shadow-[0_20px_50px_rgba(2,6,23,0.35)] backdrop-blur-md ${toneClasses}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/80">{feedback.eyebrow}</p>
      <p className="mt-1 text-sm font-semibold text-white">{feedback.title}</p>
      <p className="mt-1 text-xs leading-5 text-white/88">{feedback.detail}</p>
      <div className="mt-2">
        <HudChip>{feedback.chipLabel}</HudChip>
      </div>
    </section>
  );
}


function RecentJourneyCard({ recentJourney }: { recentJourney: WorldHubHudViewModel["recentJourney"] }) {
  const toneClasses =
    recentJourney.status === "ready"
      ? "border-violet-200/25 bg-[linear-gradient(165deg,rgba(139,92,246,0.2),rgba(15,23,42,0.35))]"
      : "border-white/10 bg-black/20";

  return (
    <div className={`mt-4 rounded-[22px] border p-3.5 ${toneClasses}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-violet-100/75">{recentJourney.eyebrow}</p>
      <h3 className="mt-1 text-sm font-semibold text-white sm:text-[15px]">{recentJourney.title}</h3>
      <p className="mt-1 text-xs leading-5 text-slate-100/88 sm:text-sm">{recentJourney.detail}</p>
      <ul className="mt-3 space-y-1.5 text-[11px] text-slate-100/86">
        <li>미션 · {recentJourney.missionLabel}</li>
        <li>보상 · {recentJourney.rewardLabel}</li>
        <li>연결감 · {recentJourney.continuityLabel}</li>
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        {recentJourney.chips.slice(0, 2).map((chip) => (
          <HudChip key={chip}>{chip}</HudChip>
        ))}
      </div>
    </div>
  );
}

function NextAdventureSuggestionCard({
  suggestion,
  prominence,
}: {
  suggestion: WorldHubHudViewModel["nextAdventureSuggestion"];
  prominence: WorldHubHudViewModel["presentationProgression"]["suggestionProminence"];
}) {
  const toneClasses =
    prominence === "primary"
      ? "border-emerald-200/35 bg-[linear-gradient(165deg,rgba(16,185,129,0.24),rgba(15,23,42,0.34))]"
      : prominence === "secondary"
        ? "border-emerald-200/30 bg-[linear-gradient(165deg,rgba(16,185,129,0.18),rgba(15,23,42,0.34))]"
        : "border-white/10 bg-black/20 opacity-85";

  return (
    <div className={`mt-4 rounded-[18px] border p-3 ${toneClasses}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-100/80">{suggestion.eyebrow}</p>
      <p className="mt-1 text-sm font-semibold text-white">{suggestion.title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-100/86">{suggestion.detail}</p>
      <p className="mt-2 text-[11px] text-slate-200/82">{suggestion.hint}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <HudChip>{suggestion.chipLabel}</HudChip>
      </div>
    </div>
  );
}


function HomeReadinessCueCard({
  cue,
  prominence,
}: {
  cue: WorldHubHudViewModel["homeReadinessCue"];
  prominence: WorldHubHudViewModel["presentationProgression"]["readinessProminence"];
}) {
  const toneClasses =
    prominence === "primary"
      ? "border-cyan-200/30 bg-cyan-300/10"
      : prominence === "secondary"
        ? "border-emerald-200/25 bg-emerald-300/10"
        : "border-white/12 bg-black/20 opacity-85";

  return (
    <div className={`mt-3 rounded-[16px] border px-3 py-2.5 ${toneClasses}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100/80">{cue.eyebrow}</p>
      <p className="mt-1 text-sm font-semibold text-white">{cue.title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-100/86">{cue.detail}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <HudChip>{cue.chipLabel}</HudChip>
      </div>
    </div>
  );
}

function JourneyPathGuidanceCard({
  guidance,
  prominence,
}: {
  guidance: WorldHubHudViewModel["journeyPathGuidance"];
  prominence: WorldHubHudViewModel["presentationProgression"]["pathGuidanceProminence"];
}) {
  const toneClasses =
    prominence === "primary"
      ? "border-cyan-200/30 bg-cyan-300/10"
      : prominence === "secondary"
        ? "border-emerald-200/25 bg-emerald-300/10"
        : "border-white/12 bg-black/20 opacity-85";

  return (
    <div className={`mt-3 rounded-[16px] border px-3 py-2.5 ${toneClasses}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100/80">{guidance.eyebrow}</p>
      <p className="mt-1 text-sm font-semibold text-white">{guidance.title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-100/86">{guidance.detail}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <HudChip>{guidance.chipLabel}</HudChip>
      </div>
    </div>
  );
}

function PortalActionCard({
  card,
}: {
  card: WorldHubHudViewModel["portalActionCard"];
}) {
  const toneClasses =
    card.prominence === "primary"
      ? "border-cyan-200/35 bg-[linear-gradient(170deg,rgba(34,211,238,0.2),rgba(15,23,42,0.35))]"
      : card.prominence === "secondary"
        ? "border-emerald-200/25 bg-[linear-gradient(170deg,rgba(16,185,129,0.18),rgba(15,23,42,0.34))]"
        : "border-white/12 bg-black/20 opacity-90";

  return (
    <div className={`mt-3 rounded-[18px] border p-3 ${toneClasses}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-100/80">
        {card.mode === "ready" ? "출발 안내" : "포털 안내"}
      </p>
      <p className="mt-1 text-sm font-semibold text-white">{card.title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-100/88">{card.body}</p>
      <p className="mt-2 text-[11px] text-cyan-100/85">{card.actionHint}</p>
    </div>
  );
}


function CodingStudioBridgeCard({
  card,
  onOpenCodingStudio,
}: {
  card: WorldHubHudViewModel["codingStudioCard"];
  onOpenCodingStudio: () => void;
}) {
  if (!card.visible) {
    return null;
  }

  return (
    <div className="mt-3 rounded-[18px] border border-violet-200/30 bg-[linear-gradient(170deg,rgba(129,140,248,0.22),rgba(15,23,42,0.36))] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-100/80">아카데미 실습 연계</p>
      <p className="mt-1 text-sm font-semibold text-white">{card.title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-100/88">{card.body}</p>
      <p className="mt-2 text-[11px] text-violet-100/85">{card.hint}</p>
      <button
        className="mt-3 inline-flex items-center justify-center rounded-xl border border-violet-100/45 bg-violet-300/20 px-3 py-2 text-xs font-semibold text-violet-50 transition hover:border-violet-100/70 hover:bg-violet-300/30"
        onClick={onOpenCodingStudio}
        type="button"
      >
        {card.ctaLabel}
      </button>
    </div>
  );
}

function ClassSessionGuidanceCard({
  card,
}: {
  card: NonNullable<WorldHubHudViewModel["classSessionGuidanceCard"]>;
}) {
  const toneClasses =
    card.prominence === "primary"
      ? "border-indigo-200/35 bg-[linear-gradient(170deg,rgba(99,102,241,0.24),rgba(15,23,42,0.42))]"
      : card.prominence === "secondary"
        ? "border-sky-200/25 bg-[linear-gradient(170deg,rgba(56,189,248,0.16),rgba(15,23,42,0.38))]"
        : "border-white/12 bg-black/20 opacity-90";

  return (
    <section className={`rounded-[22px] border p-3.5 text-left shadow-[0_14px_36px_rgba(2,6,23,0.32)] backdrop-blur-md ${toneClasses}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-indigo-100/80">{card.eyebrow}</p>
      <p className="mt-1 text-sm font-semibold text-white">{card.title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-100/88">{card.body}</p>
      <p className="mt-2 text-[11px] text-indigo-100/85">{card.hint}</p>
      <div className="mt-2">
        <HudChip>{card.chipLabel}</HudChip>
      </div>
    </section>
  );
}

function ReturnSummaryCue({
  cue,
}: {
  cue: WorldHubHudViewModel["returnSummaryCue"];
}) {
  const toneClasses =
    cue.tone === "warm"
      ? "border-amber-200/25 bg-amber-300/10 text-amber-50"
      : "border-emerald-200/20 bg-emerald-300/10 text-emerald-50";
  return (
    <section className={`pointer-events-none max-w-sm rounded-2xl border px-3 py-2.5 backdrop-blur-md ${toneClasses}`}>
      <p className="text-xs font-semibold">{cue.title}</p>
      <p className="mt-1 text-[11px] text-white/88">{cue.body}</p>
    </section>
  );
}

function BadgeShelfCard({ badgeShelf }: { badgeShelf: WorldHubHudViewModel["badgeShelf"] }) {
  return (
    <div
      className={`mt-4 rounded-[22px] border p-3.5 ${
        badgeShelf.recentlyUpdated
          ? "border-emerald-200/30 bg-[linear-gradient(160deg,rgba(16,185,129,0.2),rgba(15,23,42,0.34))]"
          : "border-white/10 bg-black/20"
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-100/75">{badgeShelf.eyebrow}</p>
      <h3 className="mt-1 text-sm font-semibold text-white sm:text-[15px]">{badgeShelf.title}</h3>
      <p className="mt-1 text-xs leading-5 text-slate-100/88 sm:text-sm">{badgeShelf.detail}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {badgeShelf.slots.map((slot) => (
          <span
            className={`rounded-xl border px-3 py-2 text-[11px] ${
              slot.state === "recent"
                ? "border-emerald-200/35 bg-emerald-300/12 text-emerald-50"
                : slot.state === "filled"
                  ? "border-cyan-200/30 bg-cyan-300/12 text-cyan-50"
                  : "border-white/10 bg-black/20 text-slate-200/82"
            }`}
            key={slot.id}
            title={slot.detail}
          >
            {slot.label}
          </span>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-slate-300/82">{badgeShelf.statusLabel}</p>
    </div>
  );
}

export function WorldHubHud(args: {
  viewModel: WorldHubHudViewModel;
  onStartAdventure: () => void;
  onOpenCodingStudio: () => void;
  portalEntryFeedback: WorldHubPortalEntryMicroFeedback | null;
  firstVisitOnboarding: WorldHubFirstVisitOnboardingView;
  onDismissFirstVisitOnboarding: () => void;
  hintDensity: WorldHubHintDensity;
}) {
  const { viewModel, onStartAdventure, onOpenCodingStudio, portalEntryFeedback, firstVisitOnboarding, onDismissFirstVisitOnboarding, hintDensity } = args;
  const progression = viewModel.presentationProgression;
  const showSuggestion = progression.suggestionProminence !== "resting";
  const showReadiness = progression.readinessProminence !== "resting";
  const showPathGuidance = progression.pathGuidanceProminence !== "resting";
  const showPortalAction = hintDensity.portalProminence !== "hidden" && viewModel.portalActionCard.visible;
  const showClassSessionGuidance =
    viewModel.classSessionGuidanceCard?.visible === true && hintDensity.classSessionProminence !== "hidden";
  const showReturnSummary =
    viewModel.returnSummaryCue.visible && hintDensity.primarySurface !== "portal" && hintDensity.homeReturnProminence !== "hidden";

  return (
    <>
      <FirstVisitOnboardingBand
        onboarding={firstVisitOnboarding}
        prominence={hintDensity.onboardingProminence}
        onDismiss={onDismissFirstVisitOnboarding}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center p-4 sm:p-5">
        {hintDensity.showAmbientFeedback && viewModel.ambientFeedback ? <AmbientFeedbackCard feedback={viewModel.ambientFeedback} /> : null}
      </div>
      {hintDensity.showPortalEntryFeedback && portalEntryFeedback ? (
        <div className="pointer-events-none absolute inset-x-0 top-20 z-10 flex justify-center px-4 sm:top-24">
          <PortalEntryFeedbackCard feedback={portalEntryFeedback} />
        </div>
      ) : null}
      {showReturnSummary ? (
        <div className="pointer-events-none absolute left-4 top-20 z-10 sm:left-5 sm:top-24 lg:left-6">
          <ReturnSummaryCue cue={viewModel.returnSummaryCue} />
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-0 z-0 flex flex-col justify-between p-4 sm:p-5 lg:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="max-w-sm rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.76),rgba(15,23,42,0.5))] px-4 py-3.5 text-white shadow-[0_12px_50px_rgba(2,6,23,0.28)] backdrop-blur-md">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-100/75">{viewModel.identity.eyebrow}</p>
            <h1 className="mt-2 text-lg font-semibold tracking-tight text-white sm:text-xl">{viewModel.identity.title}</h1>
            <p className="mt-1 text-sm text-slate-200/88">{viewModel.identity.subtitle}</p>
          </div>

          <div
            className={`rounded-full border px-3 py-2 text-[11px] font-medium shadow-[0_10px_24px_rgba(2,6,23,0.28)] backdrop-blur-md sm:text-xs ${BADGE_TONE_CLASSES[viewModel.sceneBadge.tone]}`}
            title={viewModel.sceneBadge.detail}
          >
            {viewModel.sceneBadge.label}
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)_minmax(0,340px)] lg:items-end">
          <section
            className={`rounded-[26px] border p-4 text-white shadow-[0_10px_36px_rgba(2,6,23,0.28)] backdrop-blur-md transition ${
              viewModel.homeAnchor.emphasis === "warm"
                ? "border-amber-200/30 bg-[linear-gradient(180deg,rgba(120,53,15,0.36),rgba(15,23,42,0.62))] shadow-[0_18px_48px_rgba(251,191,36,0.12)]"
                : viewModel.homeAnchor.emphasis === "soft"
                  ? "border-amber-100/20 bg-[linear-gradient(180deg,rgba(71,85,105,0.82),rgba(15,23,42,0.58))]"
                  : "border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.8),rgba(15,23,42,0.58))]"
            }`}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-100/75">{viewModel.homeAnchor.eyebrow}</p>
            <h2 className="mt-2 text-lg font-semibold text-white">{viewModel.homeAnchor.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-100/92">{viewModel.homeAnchor.detail}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <HudChip>{viewModel.homeAnchor.statusLabel}</HudChip>
              {viewModel.homeAnchor.returnLabel ? <HudChip>Last return · {viewModel.homeAnchor.returnLabel}</HudChip> : null}
            </div>
            {viewModel.homeAnchor.acknowledgement ? (
              <HomeAcknowledgementCard acknowledgement={viewModel.homeAnchor.acknowledgement} />
            ) : null}
            {viewModel.homeAnchor.repeatVisitCue ? <HomeRepeatVisitCueCard cue={viewModel.homeAnchor.repeatVisitCue} /> : null}
            {showSuggestion ? (
              <NextAdventureSuggestionCard
                prominence={progression.suggestionProminence}
                suggestion={viewModel.nextAdventureSuggestion}
              />
            ) : null}
            {showReadiness ? (
              <HomeReadinessCueCard cue={viewModel.homeReadinessCue} prominence={progression.readinessProminence} />
            ) : null}
            {showPathGuidance ? (
              <JourneyPathGuidanceCard
                guidance={viewModel.journeyPathGuidance}
                prominence={progression.pathGuidanceProminence}
              />
            ) : null}
            {showPortalAction ? <PortalActionCard card={viewModel.portalActionCard} /> : null}
            <CodingStudioBridgeCard card={viewModel.codingStudioCard} onOpenCodingStudio={onOpenCodingStudio} />
            <HomePersonalizationCard personalization={viewModel.homeAnchor.personalization} />
            <BadgeShelfCard badgeShelf={viewModel.badgeShelf} />
            <RecentJourneyCard recentJourney={viewModel.recentJourney} />
          </section>

          <section className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.82),rgba(15,23,42,0.62))] p-4 text-white shadow-[0_10px_36px_rgba(2,6,23,0.28)] backdrop-blur-md lg:justify-self-center lg:text-center">
            {showClassSessionGuidance && viewModel.classSessionGuidanceCard ? (
              <div className="mb-3">
                <ClassSessionGuidanceCard card={viewModel.classSessionGuidanceCard} />
              </div>
            ) : null}
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-100/75">{viewModel.prompt.eyebrow}</p>
            <h2 className="mt-2 text-base font-semibold text-white">{viewModel.prompt.label}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-100/92">{viewModel.prompt.detail}</p>
            <p className="mt-2 text-xs text-slate-300/80">{viewModel.prompt.hint}</p>
            {viewModel.classCelebration ? (
              <div className="mt-4 rounded-2xl border border-amber-200/20 bg-amber-300/10 p-3 text-left lg:text-center">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-100/80">{viewModel.classCelebration.eyebrow}</p>
                <p className="mt-1 text-sm font-semibold text-amber-50">{viewModel.classCelebration.title}</p>
                <p className="mt-1 text-xs leading-5 text-amber-100/90">{viewModel.classCelebration.detail}</p>
                <div className="mt-2 flex flex-wrap gap-2 lg:justify-center">
                  {viewModel.classCelebration.chips.slice(0, 2).map((chip) => (
                    <HudChip key={chip}>{chip}</HudChip>
                  ))}
                </div>
              </div>
            ) : null}
            {viewModel.sessionCelebration ? (
              <div className="mt-3 rounded-2xl border border-cyan-200/20 bg-cyan-300/10 p-3 text-left lg:text-center">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100/80">{viewModel.sessionCelebration.eyebrow}</p>
                <p className="mt-1 text-sm font-semibold text-cyan-50">{viewModel.sessionCelebration.title}</p>
                <p className="mt-1 text-xs leading-5 text-cyan-100/90">{viewModel.sessionCelebration.detail}</p>
                <div className="mt-2 flex flex-wrap gap-2 lg:justify-center">
                  {viewModel.sessionCelebration.chips.slice(0, 2).map((chip) => (
                    <HudChip key={chip}>{chip}</HudChip>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <section className="pointer-events-auto rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(23,37,84,0.8),rgba(15,23,42,0.62))] p-4 text-white shadow-[0_12px_50px_rgba(15,23,42,0.35)] backdrop-blur-md">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100/75">{viewModel.adventure.eyebrow}</p>
            <h2 className="mt-2 text-lg font-semibold text-white">{viewModel.adventure.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-200/90">{viewModel.adventure.detail}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <HudChip>{viewModel.adventure.statusLabel}</HudChip>
            </div>
            <button
              aria-label={viewModel.adventure.ctaLabel}
              className="mt-4 flex w-full items-center justify-center rounded-2xl border border-amber-200/30 bg-[linear-gradient(180deg,rgba(251,191,36,0.34),rgba(245,158,11,0.22))] px-4 py-3 text-sm font-semibold text-amber-50 transition hover:border-amber-100/60 hover:bg-[linear-gradient(180deg,rgba(251,191,36,0.42),rgba(245,158,11,0.28))] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={viewModel.adventure.disabled}
              onClick={onStartAdventure}
              type="button"
            >
              {viewModel.adventure.ctaLabel}
            </button>
          </section>
        </div>
      </div>
    </>
  );
}
