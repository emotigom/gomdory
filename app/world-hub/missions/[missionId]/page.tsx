import { notFound } from "next/navigation";

import { WORLD_HUB_MISSION_HANDOFF_QUERY_KEY, parseMissionRouteSeedFromSearchParams } from "@/lib/world-hub/mission/handoff";

import { MissionRoomRouteClient } from "./MissionRoomRouteClient";

export default async function WorldHubMissionPage({
  params,
  searchParams,
}: {
  params: Promise<{ missionId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ missionId }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const routeSeed = parseMissionRouteSeedFromSearchParams({
    missionId,
    handoffParam: resolvedSearchParams[WORLD_HUB_MISSION_HANDOFF_QUERY_KEY],
  });

  if (routeSeed.mode === "local-fallback" && !routeSeed.portal) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#0f172a,_#020617_60%)] px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-slate-950/30 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300/90">Mission Runtime</p>
              <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
                {routeSeed.mode === "validated-handoff" ? routeSeed.handoff.portal.label : routeSeed.portal?.label ?? missionId}
              </h1>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-200">
              {routeSeed.mode === "validated-handoff" ? "validated handoff" : `fallback: ${routeSeed.fallbackReason}`}
            </span>
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Mission route 를 local bootstrap 기반의 작은 typed runtime surface 로 승격한 단계입니다. handoff payload 를 검증한 뒤
            scene config 를 파생하고, worker-backed room bootstrap 이 비활성화되거나 실패해도 안전한 로컬 미션 셸을 렌더링합니다.
          </p>
        </header>

        <MissionRoomRouteClient routeSeed={routeSeed} />
      </div>
    </main>
  );
}
