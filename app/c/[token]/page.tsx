import { headers } from "next/headers";
import { notFound } from "next/navigation";

import PageMarker from "@/app/_components/PageMarker";
import ReplayClient from "@/app/dashboard/boards/[boardId]/replay/[sessionId]/ReplayClient";
import { apiV1Path } from "@/lib/standards/pathTypes";
import { getHostFromHeaders } from "@/lib/routing/host";
import type { SessionEventType } from "@/lib/types/sessionEvents";

function formatClock(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export default async function PublicClipPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const headerList = await headers();
  const host = getHostFromHeaders(headerList);
  const protocol = headerList.get("x-forwarded-proto") ?? "https";
  const baseUrl = host ? `${protocol}://${host}` : null;

  const response = baseUrl
    ? await fetch(`${baseUrl}${apiV1Path(`c/${token}`)}`, { cache: "no-store" }).catch(() => null)
    : null;

  if (!response || !response.ok) {
    return notFound();
  }

  const payload = (await response.json().catch(() => null)) as
    | {
        ok: true;
        meta: {
          title: string | null;
          mode: "safe" | "full";
          clipStartTs: string;
          clipEndTs: string;
          createdAt: string;
          expiresAt: string | null;
          revokedAt: string | null;
        };
        payload: {
          session: { started_at: string; ended_at: string | null; status: string };
          events: Array<{ ts: string; type: SessionEventType; payload: Record<string, unknown> }>;
          bookmarks: Array<{ id: string; ts: string; note: string | null }>;
        };
      }
    | { ok?: false; error?: { message?: string } }
    | null;

  if (!payload || payload.ok !== true) {
    return notFound();
  }

  const clipStartMs = Date.parse(payload.meta.clipStartTs);
  const clipEndMs = Date.parse(payload.meta.clipEndTs);
  const clipDurationMs =
    Number.isFinite(clipStartMs) && Number.isFinite(clipEndMs)
      ? Math.max(0, clipEndMs - clipStartMs)
      : 0;

  return (
    <div className="space-y-6">
      <PageMarker page="public" view="clip" />
      <div data-page-marker="public_clip" className="sr-only" />
      <section className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Replay v2 Clip</p>
            <h1 className="mt-2 text-xl font-semibold text-slate-900">{payload.meta.title ?? "수업 클립"}</h1>
            <p className="text-sm text-slate-600">읽기 전용 · 공유된 클립 범위만 재생됩니다.</p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              payload.meta.mode === "safe" ? "bg-sky-100 text-sky-700" : "bg-rose-100 text-rose-700"
            }`}
          >
            {payload.meta.mode === "safe" ? "Safe 모드" : "Full 모드"}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span>
            클립 범위 {new Date(payload.meta.clipStartTs).toLocaleTimeString("ko-KR")} ~{" "}
            {new Date(payload.meta.clipEndTs).toLocaleTimeString("ko-KR")}
          </span>
          <span>길이 {formatClock(clipDurationMs)}</span>
        </div>
      </section>
      <ReplayClient
        boardId="public"
        sessionId={token}
        session={payload.payload.session}
        events={payload.payload.events}
        report={null}
        hasLiveSession={false}
        readOnly
        clipTitle={payload.meta.title}
        clipMode={payload.meta.mode}
        initialBookmarks={payload.payload.bookmarks}
      />
    </div>
  );
}
