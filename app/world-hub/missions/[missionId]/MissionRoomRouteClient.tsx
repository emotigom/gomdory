"use client";

import dynamic from "next/dynamic";

import type { MissionRoomRouteSeed } from "@/lib/world-hub/mission/contracts";

const MissionRoomRuntime = dynamic(() => import("@/lib/world-hub/mission/runtime/MissionRoomRuntime"), {
  ssr: false,
  loading: () => (
    <section className="grid min-h-[480px] place-items-center rounded-3xl border border-white/10 bg-slate-950/70 p-8 text-sm text-slate-300">
      Mission runtime 을 준비하는 중입니다…
    </section>
  ),
});

export function MissionRoomRouteClient({ routeSeed }: { routeSeed: MissionRoomRouteSeed }) {
  return <MissionRoomRuntime routeSeed={routeSeed} />;
}
