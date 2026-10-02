"use client";

import dynamic from "next/dynamic";

import type { WorldHubMissionResultReturnEnvelope } from "@/lib/world-hub/mission/resultHandoff";

const WorldHubRuntime = dynamic(() => import("@/lib/world-hub/runtime/WorldHubRuntime"), {
  ssr: false,
  loading: () => (
    <section className="grid min-h-[640px] place-items-center rounded-3xl border border-white/10 bg-slate-950/70 p-8 text-sm text-slate-300">
      월드 허브 런타임을 준비하는 중입니다…
    </section>
  ),
});

export function WorldHubRouteClient(args: {
  recentMissionResult: WorldHubMissionResultReturnEnvelope | null;
  launchClassId: string | null;
}) {
  return <WorldHubRuntime launchClassId={args.launchClassId} recentMissionResult={args.recentMissionResult} />;
}
