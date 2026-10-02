"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import type { MissionRoomRuntimeInputs, MissionRoomRouteSeed } from "@/lib/world-hub/mission/contracts";
import { useMissionRoomController } from "@/lib/world-hub/mission/runtime/useMissionRoomController";

function toneForAvailability(availability: MissionRoomRuntimeInputs["handoff"]["portalAvailability"]) {
  switch (availability) {
    case "available":
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
    case "queued":
      return "border-amber-400/30 bg-amber-400/10 text-amber-200";
    default:
      return "border-white/10 bg-white/5 text-slate-300";
  }
}

function toneForSceneLoading(stage: MissionRoomRuntimeInputs["sceneLoading"]["stage"]) {
  switch (stage) {
    case "ready":
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
    case "partial-ready":
      return "border-amber-400/30 bg-amber-400/10 text-amber-200";
    case "fallback":
      return "border-cyan-400/30 bg-cyan-400/10 text-cyan-200";
    case "unavailable":
      return "border-rose-400/30 bg-rose-400/10 text-rose-200";
    default:
      return "border-white/10 bg-white/5 text-slate-300";
  }
}

function toneForLifecycle(status: MissionRoomRuntimeInputs["gameplay"]["lifecycle"]["status"]) {
  switch (status) {
    case "completed":
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
    case "active":
      return "border-cyan-400/30 bg-cyan-400/10 text-cyan-200";
    case "queued":
      return "border-amber-400/30 bg-amber-400/10 text-amber-200";
    case "failed":
      return "border-rose-400/30 bg-rose-400/10 text-rose-200";
    default:
      return "border-white/10 bg-white/5 text-slate-300";
  }
}

function MissionSceneContainer(args: {
  runtime: MissionRoomRuntimeInputs;
  onAdvanceObjective: () => void;
  advancingObjective: boolean;
  onReturnToHub: () => void;
  returningToHub: boolean;
}) {
  const { runtime, onAdvanceObjective, advancingObjective, onReturnToHub, returningToHub } = args;
  const isCompleted = runtime.gameplay.lifecycle.status === "completed";

  return (
    <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,_rgba(8,15,34,0.98),_rgba(2,6,23,0.98))] p-6 shadow-2xl shadow-slate-950/40">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-cyan-300/80">{runtime.scene.scene.containerLabel}</p>
          <h2 className="mt-2 text-xl font-semibold text-white">{runtime.scene.title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{runtime.scene.scene.containerSummary}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full border px-3 py-1 text-xs font-medium ${toneForLifecycle(runtime.gameplay.lifecycle.status)}`}
          >
            {runtime.gameplay.lifecycle.label}
          </span>
          <span
            className={`rounded-full border px-3 py-1 text-xs font-medium ${toneForSceneLoading(runtime.sceneLoading.stage)}`}
          >
            {runtime.sceneLoading.summaryLabel}
          </span>
          <span
            className="rounded-full border px-3 py-1 text-xs font-medium text-slate-100"
            style={{ borderColor: `${runtime.scene.accent}66`, backgroundColor: `${runtime.scene.accent}1a` }}
          >
            {runtime.bootstrap.roomLabel}
          </span>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-950/70 p-6">
          <div className="absolute inset-x-0 top-0 h-24 opacity-70" style={{ background: `radial-gradient(circle at top, ${runtime.scene.accent}44, transparent 70%)` }} />
          <div className="relative space-y-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Placeholder Scene</p>
              <h3 className="mt-2 text-lg font-semibold text-white">{runtime.scene.scene.placeholderTitle}</h3>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">{runtime.scene.scene.placeholderBody}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Environment</p>
                <p className="mt-2 font-medium text-white">{runtime.scene.environmentLabel}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Mission Type</p>
                <p className="mt-2 font-medium text-white">{runtime.scene.missionTypeLabel}</p>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Gameplay seam</p>
                  <p className="mt-2 font-medium text-white">{runtime.gameplay.source.label}</p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                  seq {runtime.gameplay.source.diagnostics.sequence}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-300">{runtime.gameplay.lifecycle.detail}</p>
              <p className="mt-2 text-xs leading-5 text-slate-400">{runtime.sceneLoading.detail}</p>
            </div>
          </div>
        </div>

        <aside className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-4">
          <div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Current objective</p>
                <h3 className="mt-2 text-base font-semibold text-white">{runtime.gameplay.objective.label}</h3>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-medium ${toneForLifecycle(runtime.gameplay.lifecycle.status)}`}>
                {runtime.gameplay.objective.stepIndex}/{runtime.gameplay.objective.totalSteps}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-300">{runtime.gameplay.objective.detail}</p>
            <p className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-500">Mission briefing</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">{runtime.scene.objectiveLabel}</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Progress</p>
              <p className="text-xs text-slate-400">{runtime.gameplay.progress.percent}%</p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-cyan-300 transition-[width] duration-300"
                style={{ width: `${runtime.gameplay.progress.percent}%` }}
              />
            </div>
            <p className="mt-3 font-medium text-white">{runtime.gameplay.progress.statusLabel}</p>
            <p className="mt-2 text-sm text-slate-300">{runtime.bootstrap.connectionLabel}</p>
            <p className="mt-2 text-sm text-slate-300">Objective state: {runtime.bootstrap.objectiveState}</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Live session guidance</p>
            <p className="mt-2 font-medium text-white">{runtime.liveSession.title}</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">{runtime.liveSession.detail}</p>
            <p className="mt-2 text-xs text-slate-400">{runtime.liveSession.hint}</p>
            <p className="mt-2 text-xs text-slate-500">
              mode {runtime.liveSession.status} · mission start {runtime.liveSession.missionStart}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Completion result</p>
            <p className="mt-2 font-medium text-white">{runtime.completion.result.label}</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">{runtime.completion.result.detail}</p>
            <p className="mt-2 text-xs text-slate-400">
              outcome {runtime.completion.outcome.status}
              {runtime.completion.metadata.completedAtIso ? ` · ${runtime.completion.metadata.completedAtIso}` : " · pending"}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Reward summary</p>
            <p className="mt-2 font-medium text-white">{runtime.completion.rewards.summary.summary.label}</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">{runtime.completion.rewards.summary.summary.detail}</p>
            <p className="mt-2 text-xs text-slate-400">
              source {runtime.completion.rewards.summary.source.kind} · fallback {runtime.completion.rewards.summary.fallback.mode}
            </p>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              {runtime.completion.rewards.summary.inventoryUpdates.map((placeholder) => (
                <li key={placeholder.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <span className="font-medium text-white">{placeholder.label}</span>
                  <span className="text-slate-400"> · {placeholder.target} · {placeholder.status}</span>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{placeholder.detail}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <button
              className="inline-flex w-full items-center justify-center rounded-full border border-cyan-300/40 bg-cyan-300/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-300/70 hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-slate-500"
              disabled={advancingObjective || isCompleted || returningToHub}
              onClick={onAdvanceObjective}
              type="button"
            >
              {isCompleted
                ? "Local objective stub complete"
                : advancingObjective
                  ? "Advancing objective…"
                  : runtime.gameplay.objective.callToAction ?? "Advance objective"}
            </button>

            <button
              className="inline-flex w-full items-center justify-center rounded-full border border-emerald-300/40 bg-emerald-300/10 px-4 py-2 text-sm font-medium text-emerald-100 transition hover:border-emerald-300/70 hover:bg-emerald-300/15 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-slate-500"
              disabled={!isCompleted || advancingObjective || returningToHub}
              onClick={onReturnToHub}
              type="button"
            >
              {returningToHub ? "Returning to world hub…" : runtime.completion.result.nextActionLabel ?? runtime.scene.returnLabel}
            </button>
          </div>
        </aside>
      </div>
    </section>
  );
}

function MissionSessionMetadataPanel({ runtime }: { runtime: MissionRoomRuntimeInputs }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Session metadata</p>
      <dl className="mt-4 grid gap-3">
        <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3">
          <dt className="text-xs uppercase tracking-[0.2em] text-slate-500">Authority</dt>
          <dd className="mt-1 font-medium text-white">{runtime.session.authority.authorityKind}</dd>
          <dd className="mt-1 text-xs text-slate-400">
            owner {runtime.session.authority.ownerId ?? "unassigned"} · epoch {runtime.session.authority.authorityEpochIso ?? "pending"}
          </dd>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3">
          <dt className="text-xs uppercase tracking-[0.2em] text-slate-500">Gameplay state source</dt>
          <dd className="mt-1 font-medium text-white">
            {runtime.gameplay.source.kind} · {runtime.gameplay.source.diagnostics.progressionMode}
          </dd>
          <dd className="mt-1 text-xs text-slate-400">
            owner {runtime.gameplay.source.diagnostics.owner} · transitions {runtime.gameplay.source.diagnostics.transitionCount}
          </dd>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3">
          <dt className="text-xs uppercase tracking-[0.2em] text-slate-500">Completion seam</dt>
          <dd className="mt-1 font-medium text-white">
            {runtime.completion.source.kind} · {runtime.completion.result.kind}
          </dd>
          <dd className="mt-1 text-xs text-slate-400">
            validation {runtime.completion.metadata.validationState} · rewards {runtime.completion.rewards.summary.status}
          </dd>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3">
          <dt className="text-xs uppercase tracking-[0.2em] text-slate-500">Presence channel</dt>
          <dd className="mt-1 font-medium text-white">
            {runtime.session.presence.status} · {runtime.session.presence.transport}
          </dd>
          <dd className="mt-1 text-xs text-slate-400">{runtime.session.presence.channelKey ?? "No reserved channel"}</dd>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3">
          <dt className="text-xs uppercase tracking-[0.2em] text-slate-500">Join reservation</dt>
          <dd className="mt-1 font-medium text-white">{runtime.session.reservation.status}</dd>
          <dd className="mt-1 text-xs text-slate-400">
            activation {runtime.session.reservation.activationState} · join ticket {runtime.session.reservation.hasJoinTicket ? "reserved" : "none"}
          </dd>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3">
          <dt className="text-xs uppercase tracking-[0.2em] text-slate-500">Presence adapter</dt>
          <dd className="mt-1 font-medium text-white">
            {runtime.presence.adapterKind} · {runtime.presence.diagnostics.mode}
          </dd>
          <dd className="mt-1 text-xs text-slate-400">
            channel {runtime.presence.channelKey ?? "none"} · peers {runtime.presence.peerCount} · source {runtime.presence.diagnostics.sourceKind}
          </dd>
          <dd className="mt-1 text-xs text-slate-500">observed {runtime.presence.diagnostics.observedAtIso ?? "pending"}</dd>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3">
          <dt className="text-xs uppercase tracking-[0.2em] text-slate-500">Asset delivery</dt>
          <dd className="mt-1 flex flex-wrap items-center gap-2 font-medium text-white">
            <span>{runtime.assets.source.label} · {runtime.assets.source.diagnostics.deliveryMode}</span>
            <span className={`rounded-full border px-3 py-1 text-xs font-medium ${toneForSceneLoading(runtime.sceneLoading.stage)}`}>
              {runtime.sceneLoading.summaryLabel}
            </span>
          </dd>
          <dd className="mt-1 text-xs text-slate-400">
            manifest {runtime.assets.manifestVersion} · ready {runtime.sceneLoading.diagnostics.readyAssetCount}/{runtime.sceneLoading.diagnostics.totalAssetCount}
          </dd>
          <dd className="mt-2 text-xs leading-5 text-slate-400">{runtime.sceneLoading.detail}</dd>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3">
          <dt className="text-xs uppercase tracking-[0.2em] text-slate-500">Bootstrap diagnostics</dt>
          <dd className="mt-1 font-medium text-white">
            {runtime.bootstrapSource.diagnostics.strategy} · requested {runtime.bootstrapSource.diagnostics.requestedMode}
          </dd>
          <dd className="mt-1 text-xs text-slate-400">
            resolved {runtime.bootstrapSource.diagnostics.resolvedMode} · endpoint {runtime.bootstrapSource.diagnostics.endpoint ?? "local-only"}
          </dd>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3">
          <dt className="text-xs uppercase tracking-[0.2em] text-slate-500">Access policy</dt>
          <dd className="mt-1 font-medium text-white">{runtime.policy.entry.label}</dd>
          <dd className="mt-1 text-xs text-slate-400">
            {runtime.policy.source.label} · {runtime.policy.diagnostics.adapterKind} · {runtime.policy.diagnostics.scopeAlignment}
          </dd>
        </div>
      </dl>
    </section>
  );
}

export default function MissionRoomRuntime({ routeSeed }: { routeSeed: MissionRoomRouteSeed }) {
  const router = useRouter();
  const controller = useMissionRoomController({
    routeSeed,
    navigateToHub: (route) => router.push(route),
  });

  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        {routeSeed.mode === "local-fallback" ? (
          <div className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100">
            유효한 mission handoff 가 없어 로컬 fallback bootstrap 으로 진입했습니다. reason: {routeSeed.fallbackReason}
          </div>
        ) : null}

        {controller.runtime ? (
          <MissionSceneContainer
            runtime={controller.runtime}
            onAdvanceObjective={() => {
              void controller.advanceObjective();
            }}
            advancingObjective={controller.advancingObjective}
            onReturnToHub={() => {
              void controller.returnToHub();
            }}
            returningToHub={controller.returningToHub}
          />
        ) : (
          <div className="grid min-h-[420px] gap-4 place-items-center rounded-[28px] border border-white/10 bg-slate-950/70 px-6 text-center text-sm text-slate-300">
            <p>
              {controller.loading
                ? "Mission runtime booting…"
                : controller.policy?.entry.detail ?? controller.errorText ?? "Mission runtime unavailable."}
            </p>
            {!controller.loading ? (
              <button
                className="rounded-full border border-white/15 px-4 py-2 text-sm text-slate-100 transition hover:border-cyan-300/60 hover:text-white"
                onClick={() => {
                  void controller.reload();
                }}
                type="button"
              >
                Retry local mission bootstrap
              </button>
            ) : null}
          </div>
        )}
      </div>

      <aside className="space-y-4">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Runtime status</p>
          <p className="mt-2 font-medium text-white">{controller.statusText}</p>
          {controller.runtime ? (
            <ul className="mt-4 space-y-2 text-sm text-slate-300">
              <li>Config source → {controller.runtime.source.label}</li>
              <li>Launch mode → {controller.runtime.handoff.launchMode}</li>
              <li>Bootstrap handoff mode → {controller.runtime.handoff.bootstrapMode}</li>
              <li>Bootstrap source → {controller.runtime.bootstrapSource.label}</li>
              <li>Gameplay source → {controller.runtime.gameplay.source.label}</li>
              <li>Gameplay lifecycle → {controller.runtime.gameplay.lifecycle.status}</li>
              <li>Objective progress → {controller.runtime.gameplay.progress.completedObjectives}/{controller.runtime.gameplay.progress.totalObjectives}</li>
              <li>Completion outcome → {controller.runtime.completion.outcome.status}</li>
              <li>Completion result kind → {controller.runtime.completion.result.kind}</li>
              <li>Reward placeholders → {controller.runtime.completion.rewards.summary.summary.placeholderCount}</li>
              <li>Asset source → {controller.runtime.assets.source.label}</li>
              <li>Scene loading stage → {controller.runtime.sceneLoading.stage}</li>
              <li>Assets ready → {controller.runtime.sceneLoading.diagnostics.readyAssetCount}/{controller.runtime.sceneLoading.diagnostics.totalAssetCount}</li>
              <li>Presence adapter → {controller.runtime.presence.adapterKind}</li>
              <li>Presence diagnostics → {controller.runtime.presence.diagnostics.sourceKind} / {controller.runtime.presence.diagnostics.mode}</li>
              <li>Presence observed at → {controller.runtime.presence.diagnostics.observedAtIso ?? "pending"}</li>
              <li>Projected peers → {controller.runtime.presence.peers.map((peer) => peer.label).join(", ") || "none"}</li>
              <li>Requested room mode → {controller.runtime.bootstrap.requestedMode}</li>
              <li>Room authority → {controller.runtime.bootstrap.authority}</li>
              <li>Policy source → {controller.runtime.policy.source.label}</li>
              <li>Policy entry → {controller.runtime.policy.entry.label}</li>
              {controller.runtime.source.fallbackReason ? <li>Config fallback reason → {controller.runtime.source.fallbackReason}</li> : null}
              {controller.runtime.bootstrapSource.fallbackReason ? <li>Bootstrap fallback reason → {controller.runtime.bootstrapSource.fallbackReason}</li> : null}
              {controller.runtime.assets.source.fallbackReason ? <li>Asset fallback reason → {controller.runtime.assets.source.fallbackReason}</li> : null}
              {controller.runtime.source.detail ? <li>Config source detail → {controller.runtime.source.detail}</li> : null}
              {controller.runtime.bootstrapSource.detail ? <li>Bootstrap source detail → {controller.runtime.bootstrapSource.detail}</li> : null}
              {controller.runtime.assets.source.detail ? <li>Asset source detail → {controller.runtime.assets.source.detail}</li> : null}
              <li>Scene loading detail → {controller.runtime.sceneLoading.detail}</li>
            </ul>
          ) : controller.policy ? (
            <ul className="mt-4 space-y-2 text-sm text-slate-300">
              <li>Policy source → {controller.policy.source.label}</li>
              <li>Policy entry → {controller.policy.entry.label}</li>
              <li>Policy resolution → {controller.policy.resolution}</li>
              <li>Policy scope alignment → {controller.policy.diagnostics.scopeAlignment}</li>
              {controller.policy.source.fallbackReason ? <li>Policy fallback reason → {controller.policy.source.fallbackReason}</li> : null}
              {controller.policy.source.detail ? <li>Policy detail → {controller.policy.source.detail}</li> : null}
            </ul>
          ) : null}
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Mission metadata</p>
              <h2 className="mt-1 text-lg font-semibold text-white">{controller.runtime?.scene.title ?? routeSeed.missionId}</h2>
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs font-medium ${controller.runtime ? toneForAvailability(controller.runtime.handoff.portalAvailability) : "border-white/10 bg-white/5 text-slate-300"}`}>
              {controller.runtime?.scene.statusLabel ?? "Pending"}
            </span>
          </div>
          <p className="mt-3 leading-6 text-slate-300">{controller.runtime?.scene.summary ?? controller.policy?.entry.detail ?? "Mission scene config 를 준비하는 중입니다."}</p>
          {controller.runtime ? (
            <dl className="mt-4 grid gap-3">
              {controller.runtime.scene.metadata.map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/10 bg-slate-950/50 p-3">
                  <dt className="text-xs uppercase tracking-[0.2em] text-slate-500">{item.label}</dt>
                  <dd className="mt-1 font-medium text-white">{item.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Navigation</p>
          <p className="mt-2 leading-6 text-slate-300">
            Mission runtime 은 현재 world-hub 경계 안에서만 동작합니다. 완료 전에는 안전한 직접 복귀를 유지하고, 완료 후에는 typed result handoff 로 허브에 복귀합니다.
          </p>
          {controller.runtime?.completion.outcome.status === "completed" ? (
            <button
              className="mt-4 inline-flex rounded-full border border-emerald-300/40 bg-emerald-300/10 px-4 py-2 text-sm font-medium text-emerald-100 transition hover:border-emerald-300/70 hover:bg-emerald-300/15 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-slate-500"
              disabled={controller.returningToHub}
              onClick={() => {
                void controller.returnToHub();
              }}
              type="button"
            >
              {controller.returningToHub ? "Returning to world hub…" : controller.runtime.completion.result.nextActionLabel ?? controller.runtime.scene.returnLabel}
            </button>
          ) : (
            <Link className="mt-4 inline-flex rounded-full border border-white/15 px-4 py-2 text-sm text-slate-100 transition hover:border-cyan-300/60 hover:text-white" href={routeSeed.returnHubPath}>
              {controller.runtime?.scene.returnLabel ?? "Return to world hub"}
            </Link>
          )}
        </section>

        {controller.runtime ? <MissionSessionMetadataPanel runtime={controller.runtime} /> : null}
      </aside>
    </section>
  );
}
