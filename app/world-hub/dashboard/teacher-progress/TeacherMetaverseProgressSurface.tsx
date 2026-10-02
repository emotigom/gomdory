import Link from "next/link";

import { DashboardEmptyState, DashboardPanel } from "@/app/dashboard/_components/dashboardUi";
import { cn } from "@/app/_components/uiTokens";
import type {
  TeacherDashboardMetaverseSource,
  TeacherDashboardMetaverseSummary,
  TeacherDashboardStudentActivity,
} from "@/lib/world-hub/dashboard/contracts";
import type { MetaverseResolvedLaunchControlState } from "@/lib/world-hub/launch/contracts";

function formatTimestamp(value: string | null) {
  if (!value) {
    return "No activity yet";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(value));
}

function ActivityBadge({ status }: { status: TeacherDashboardStudentActivity["status"] }) {
  const label = status === "active" ? "Active" : "No activity";
  const tone =
    status === "active"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-slate-200 bg-slate-100 text-slate-600";

  return <span className={cn("rounded-full border px-2 py-1 text-[11px] font-semibold", tone)}>{label}</span>;
}

function DiagnosticBadge({ source }: { source: TeacherDashboardMetaverseSource }) {
  const isFallback = source.kind === "deterministic-local-preview";

  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        isFallback ? "border-amber-200 bg-amber-50 text-amber-700" : "border-sky-200 bg-sky-50 text-sky-700",
      )}
    >
      {isFallback ? "Preview fallback" : "Supabase summary"}
    </span>
  );
}

function LaunchStateBadge({ launchControls }: { launchControls: MetaverseResolvedLaunchControlState }) {
  const tone =
    launchControls.hubEntry.status === "blocked"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : launchControls.metadata.state === "mission-overrides"
        ? "border-violet-200 bg-violet-50 text-violet-700"
        : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-semibold", tone)}>{launchControls.metadata.stateLabel}</span>;
}

function SummaryMetric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ui-ink-soft)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[var(--ui-ink)]">{value}</p>
      {detail ? <p className="mt-1 text-xs text-[var(--ui-ink-soft)]">{detail}</p> : null}
    </div>
  );
}

export default function TeacherMetaverseProgressSurface({
  classId,
  classTitle,
  summary,
  launchControls,
}: {
  classId: string;
  classTitle: string;
  summary: TeacherDashboardMetaverseSummary;
  launchControls: MetaverseResolvedLaunchControlState;
}) {
  const isPreviewFallback = summary.source.kind === "deterministic-local-preview";
  const hasRecentCompletions = summary.recentMissionCompletions.length > 0;
  const hasStudentActivity = summary.studentActivity.length > 0;
  const hasMissionOverrides = launchControls.missionOverrides.length > 0;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10" data-page-marker="dashboard-class-metaverse-progress">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-600">Teacher Metaverse Progress</p>
          <h1 className="text-3xl font-semibold text-[var(--ui-ink)]">{classTitle}</h1>
          <p className="max-w-3xl text-sm text-[var(--ui-ink-soft)]">
            Read-only mission progress summary for the current class-scoped metaverse slice. This surface intentionally stays
            narrow, privacy-safe, and adapter-driven.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LaunchStateBadge launchControls={launchControls} />
          <DiagnosticBadge source={summary.source} />
          <Link
            href={`/dashboard/classes/${classId}`}
            className="inline-flex min-h-11 items-center rounded-[var(--ui-radius-sm)] border border-[var(--ui-border)] px-4 text-sm font-semibold text-[var(--ui-ink)] transition hover:bg-[var(--ui-surface-muted)]"
          >
            Back to class hub
          </Link>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryMetric
          label="Students in scope"
          value={String(summary.aggregates.studentCount)}
          detail={summary.scope.context === "classroom" ? "Class-scoped student references" : "Preview-safe local scope"}
        />
        <SummaryMetric
          label="Launch state"
          value={launchControls.metadata.stateLabel}
          detail={launchControls.hubEntry.detail ?? launchControls.metadata.summary}
        />
        <SummaryMetric
          label="Mission overrides"
          value={String(launchControls.missionOverrides.length)}
          detail={hasMissionOverrides ? "Stable resolved release overrides" : "Missions inherit default availability"}
        />
        <SummaryMetric
          label="Recently active"
          value={String(summary.aggregates.activeStudentCount)}
          detail={
            summary.aggregates.latestActivityAtIso
              ? `Latest activity ${formatTimestamp(summary.aggregates.latestActivityAtIso)}`
              : "No recent metaverse activity yet"
          }
        />
      </section>

      {isPreviewFallback ? (
        <DashboardPanel className="border-amber-200 bg-amber-50/70 p-5">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-amber-900">Preview fallback active</p>
            <p className="text-sm text-amber-800">{summary.source.detail}</p>
            <p className="text-xs text-amber-700">
              This keeps teacher previews deterministic until class-scoped metaverse progress records are available.
            </p>
          </div>
        </DashboardPanel>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr,1fr]">
        <DashboardPanel className="space-y-4 p-5">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[var(--ui-ink)]">Launch controls snapshot</p>
            <p className="text-sm text-[var(--ui-ink-soft)]">
              Stable resolved launch state only. Raw backend control payloads stay behind the adapter seam.
            </p>
          </div>
          <div className="space-y-3 rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] p-4 text-sm text-[var(--ui-ink-soft)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-[var(--ui-ink)]">{launchControls.hubEntry.label}</p>
                <p className="mt-1">{launchControls.metadata.summary}</p>
              </div>
              <LaunchStateBadge launchControls={launchControls} />
            </div>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.14em]">Scope</dt>
                <dd className="mt-1">
                  {launchControls.scope.classId ?? "Preview scope"} · {launchControls.scope.worldId}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.14em]">Hub entry</dt>
                <dd className="mt-1">{launchControls.hubEntry.status}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.14em]">Preview mode</dt>
                <dd className="mt-1">{launchControls.preview.mode}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.14em]">Overrides</dt>
                <dd className="mt-1">{launchControls.diagnostics.missionOverrideCount}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.14em]">Resolution</dt>
                <dd className="mt-1">{launchControls.resolution}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.14em]">Snapshot key</dt>
                <dd className="mt-1">{launchControls.diagnostics.snapshotKey ?? "none"}</dd>
              </div>
            </dl>
          </div>
          {hasMissionOverrides ? (
            <ul className="space-y-3">
              {launchControls.missionOverrides.map((override) => (
                <li key={override.missionId} className="rounded-2xl border border-[var(--ui-border)] p-4 text-sm text-[var(--ui-ink-soft)]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[var(--ui-ink)]">{override.missionId}</p>
                      <p className="mt-1">{override.detail ?? override.decision.detail ?? "Mission override resolved."}</p>
                    </div>
                    <span
                      className={cn(
                        "rounded-full border px-2 py-1 text-[11px] font-semibold",
                        override.decision.status === "blocked"
                          ? "border-rose-200 bg-rose-50 text-rose-700"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700",
                      )}
                    >
                      {override.decision.label}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-2xl border border-dashed border-[var(--ui-border)] p-4 text-sm text-[var(--ui-ink-soft)]">
              No mission-specific launch overrides are active. Missions currently inherit their default resolved availability.
            </p>
          )}
        </DashboardPanel>

        <DashboardPanel className="space-y-4 p-5">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[var(--ui-ink)]">Recent mission completions</p>
            <p className="text-sm text-[var(--ui-ink-soft)]">Recent completion summaries only. No raw mission payloads are shown here.</p>
          </div>
          {hasRecentCompletions ? (
            <ul className="space-y-3">
              {summary.recentMissionCompletions.map((completion) => (
                <li key={`${completion.studentId}:${completion.missionId}:${completion.completedAtIso}`} className="rounded-2xl border border-[var(--ui-border)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--ui-ink)]">{completion.missionTitle}</p>
                      <p className="mt-1 text-sm text-[var(--ui-ink-soft)]">
                        {completion.studentLabel} completed this mission with {completion.percentComplete}% progress.
                      </p>
                    </div>
                    <span className="rounded-full border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-2 py-1 text-[11px] font-semibold text-[var(--ui-ink-soft)]">
                      {completion.resultLabel}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[var(--ui-ink-soft)]">
                    <span>{completion.completionLabel}</span>
                    <span>Completed {formatTimestamp(completion.completedAtIso)}</span>
                    <span>Persistence: {completion.persistenceStatus}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <DashboardEmptyState
              icon={<span className="text-2xl">🛰️</span>}
              title="No mission completions yet"
              description="Recent mission completions will appear here after students finish a metaverse mission in this class scope."
            />
          )}
        </DashboardPanel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
        <DashboardPanel className="space-y-4 p-5">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[var(--ui-ink)]">Recent student activity</p>
            <p className="text-sm text-[var(--ui-ink-soft)]">Privacy-safe labels keep this surface read-only and classroom-ready.</p>
          </div>
          {hasStudentActivity ? (
            <ul className="space-y-3">
              {summary.studentActivity.map((entry) => (
                <li key={entry.studentId} className="rounded-2xl border border-[var(--ui-border)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--ui-ink)]">{entry.studentLabel}</p>
                      <p className="mt-1 text-sm text-[var(--ui-ink-soft)]">
                        {entry.status === "active" && entry.missionTitle
                          ? `${entry.missionTitle} · ${formatTimestamp(entry.lastActivityAtIso)}`
                          : "No metaverse activity recorded yet."}
                      </p>
                    </div>
                    <ActivityBadge status={entry.status} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <DashboardEmptyState
              icon={<span className="text-2xl">👩‍🚀</span>}
              title="No students in metaverse scope"
              description="This class has no student references wired into the metaverse summary scope yet, so the page stays in a safe empty state."
            />
          )}
        </DashboardPanel>

        <DashboardPanel className="space-y-4 p-5">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[var(--ui-ink)]">Mission and world aggregates</p>
            <p className="text-sm text-[var(--ui-ink-soft)]">Stable count summaries for quick teacher review.</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ui-ink-soft)]">Missions</p>
              {summary.aggregates.missions.length > 0 ? (
                <ul className="space-y-3">
                  {summary.aggregates.missions.map((mission) => (
                    <li key={mission.missionId} className="rounded-2xl border border-[var(--ui-border)] p-4 text-sm text-[var(--ui-ink-soft)]">
                      <p className="font-semibold text-[var(--ui-ink)]">{mission.missionTitle}</p>
                      <p className="mt-1">{mission.completionCount} completion(s) · {mission.uniqueStudentCount} student(s)</p>
                      <p className="mt-1 text-xs">Latest completion {formatTimestamp(mission.latestCompletedAtIso)}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-2xl border border-dashed border-[var(--ui-border)] p-4 text-sm text-[var(--ui-ink-soft)]">No mission aggregates yet.</p>
              )}
            </div>
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ui-ink-soft)]">Worlds</p>
              {summary.aggregates.worlds.length > 0 ? (
                <ul className="space-y-3">
                  {summary.aggregates.worlds.map((world) => (
                    <li key={world.worldId} className="rounded-2xl border border-[var(--ui-border)] p-4 text-sm text-[var(--ui-ink-soft)]">
                      <p className="font-semibold text-[var(--ui-ink)]">{world.worldId}</p>
                      <p className="mt-1">{world.completionCount} completion(s) · {world.uniqueStudentCount} student(s)</p>
                      <p className="mt-1 text-xs">Latest completion {formatTimestamp(world.latestCompletedAtIso)}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-2xl border border-dashed border-[var(--ui-border)] p-4 text-sm text-[var(--ui-ink-soft)]">No world aggregates yet.</p>
              )}
            </div>
          </div>
        </DashboardPanel>
      </div>

      <DashboardPanel className="space-y-4 p-5">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[var(--ui-ink)]">Source and fallback diagnostics</p>
          <p className="text-sm text-[var(--ui-ink-soft)]">Small operational context for preview and support workflows.</p>
        </div>
        <div className="grid gap-6 xl:grid-cols-[1fr,1fr]">
          <div className="space-y-3 rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] p-4 text-sm text-[var(--ui-ink-soft)]">
            <div>
              <p className="font-semibold text-[var(--ui-ink)]">{summary.source.label}</p>
              <p className="mt-1">{summary.source.detail}</p>
            </div>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.14em]">Read status</dt>
                <dd className="mt-1">{summary.source.diagnostics.readStatus}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.14em]">Classroom context</dt>
                <dd className="mt-1">{summary.source.diagnostics.classroomContext}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.14em]">Queried students</dt>
                <dd className="mt-1">{summary.source.diagnostics.queriedStudentCount}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.14em]">Matched students</dt>
                <dd className="mt-1">{summary.source.diagnostics.matchedStudentCount}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.14em]">Fallback reason</dt>
                <dd className="mt-1">{summary.source.fallbackReason ?? "none"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.14em]">Synced at</dt>
                <dd className="mt-1">{formatTimestamp(summary.source.diagnostics.syncedAtIso)}</dd>
              </div>
            </dl>
          </div>
          <div className="space-y-3 rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] p-4 text-sm text-[var(--ui-ink-soft)]">
            <div>
              <p className="font-semibold text-[var(--ui-ink)]">{launchControls.source.label}</p>
              <p className="mt-1">{launchControls.source.detail}</p>
            </div>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.14em]">Scope context</dt>
                <dd className="mt-1">{launchControls.diagnostics.scopeContext}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.14em]">Fallback reason</dt>
                <dd className="mt-1">{launchControls.source.fallbackReason ?? "none"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.14em]">Adapter kind</dt>
                <dd className="mt-1">{launchControls.diagnostics.adapterKind}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.14em]">Preview fallback</dt>
                <dd className="mt-1">{launchControls.preview.fallback}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.14em]">Updated at</dt>
                <dd className="mt-1">{formatTimestamp(launchControls.metadata.updatedAtIso)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.14em]">Evaluated at</dt>
                <dd className="mt-1">{formatTimestamp(launchControls.diagnostics.evaluatedAtIso)}</dd>
              </div>
            </dl>
          </div>
        </div>
        <div className="rounded-2xl border border-dashed border-[var(--ui-border)] p-4 text-xs text-[var(--ui-ink-soft)]">
          Future teacher launch consoles, scheduled world access, moderated mission release workflows, and class-scoped dashboards can extend
          these diagnostics without changing the stable launch-control shape that feeds the current UI.
        </div>
      </DashboardPanel>
    </main>
  );
}
