import { headers } from "next/headers";
import Link from "next/link";

import { requireUser } from "@/lib/auth/requireUser";
import { isDashboardCustomPageRenderV1Enabled } from "@/lib/dashboard/featureFlags";
import { getRequestContext, logAudit } from "@/lib/data/audit";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DASHBOARD_LAYOUT_TEMPLATES } from "@/lib/teacherPrefs/layoutTemplates";
import {
  buildTeacherPrefsCssVars,
  DASHBOARD_CUSTOM_PAGE_RENDER_ACTION,
  resolveCustomPagePrefs,
} from "@/lib/teacherPrefs/customPageRender";

type PageProps = {
  searchParams: Promise<{ template?: string; preset?: string }>;
};

export default async function DashboardMePage({ searchParams }: PageProps) {
  const requestHeaders = await headers();
  const requestId = getOrCreateRequestId(requestHeaders);

  if (!isDashboardCustomPageRenderV1Enabled()) {
    return (
      <main className="mx-auto mt-10 max-w-2xl rounded-xl border border-slate-200 bg-slate-50 p-6 text-slate-800">
        <div data-testid="dashboard-custom-page-render-v1-disabled" hidden />
        <h1 className="text-lg font-semibold">미리보기 준비중</h1>
        <p className="mt-2 text-sm">지금은 플래그가 꺼져 있어요. 운영에서 스냅샷을 확인해 주세요.</p>
        <p className="mt-3 text-xs">
          <Link className="underline underline-offset-2" href="/dashboard/ops/system-jobs">
            ops/system-jobs feature snapshot 보기
          </Link>
        </p>
      </main>
    );
  }

  const ctx = getRequestContext(requestHeaders);
  const { user } = await requireUser("/dashboard/me");

  const params = await searchParams;

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("user_ui_prefs")
      .select("class_prefs")
      .eq("user_id", user.id)
      .maybeSingle<{ class_prefs?: Record<string, unknown> | null }>();

    if (error) {
      throw new Error(error.message || "UI_PREFS_LOAD_FAILED");
    }

    const resolved = resolveCustomPagePrefs(data?.class_prefs, {
      templateId: params.template,
      presetId: params.preset,
    });

    const cssVars = buildTeacherPrefsCssVars(resolved.prefs);

    void logAudit({
      action: DASHBOARD_CUSTOM_PAGE_RENDER_ACTION,
      targetType: "user",
      targetId: user.id,
      ctx,
      meta: { source: resolved.source },
    });

    return (
      <main className="min-h-[70vh]" style={cssVars}>
        <div data-testid="dashboard-custom-page-render-v1-enabled" hidden />
        <section
          className="mx-auto mt-8 max-w-4xl rounded-2xl border border-slate-200/70 p-8"
          style={{
            background: "var(--dashboard-background-fill)",
            color: "var(--dashboard-foreground)",
            borderRadius: "var(--dashboard-card-radius)",
            fontFamily: "var(--dashboard-font-family)",
            fontSize: "var(--dashboard-font-size)",
          }}
        >
          <p className="text-xs uppercase tracking-[0.2em] opacity-80">Custom Page Preview</p>
          <h1 className="mt-2 text-3xl font-semibold">내 커스텀 페이지</h1>
          <p className="mt-3 text-sm opacity-90">저장된 teacher_ui_prefs + preset/template 토큰 조합으로 렌더링됩니다.</p>
          <div className="mt-8 grid gap-4 md:grid-cols-3" style={{ lineHeight: "calc(1.5 * var(--dashboard-density))" }}>
            {[
              { label: "현재 소스", value: resolved.source },
              { label: "프리셋", value: resolved.presetName ?? "없음" },
              { label: "템플릿 수", value: String(DASHBOARD_LAYOUT_TEMPLATES.length) },
            ].map((item) => (
              <article
                key={item.label}
                className="rounded-xl border border-white/40 bg-white/75 p-4 text-slate-900"
                style={{ borderRadius: "var(--dashboard-card-radius)" }}
              >
                <p className="text-xs text-slate-500">{item.label}</p>
                <p className="mt-1 text-base font-semibold">{item.value}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    );
  } catch {
    const opsCustomPageRenderAuditHref = (() => {
      const params = new URLSearchParams({ q: requestId });
      return `/dashboard/ops/system-jobs?${params.toString()}#dashboard-custom-page-render-audit`;
    })();

    return (
      <main className="mx-auto mt-10 max-w-2xl rounded-xl border border-amber-300 bg-amber-50 p-6 text-amber-950">
        <div data-testid="dashboard-custom-page-render-v1-fallback" hidden />
        <h1 className="text-lg font-semibold">커스텀 페이지를 준비하지 못했습니다.</h1>
        <p className="mt-2 text-sm">환경 변수 또는 DB 연결 상태를 확인한 뒤 다시 시도해 주세요.</p>
        <p className="mt-3 text-xs">
          <Link className="underline underline-offset-2" href={opsCustomPageRenderAuditHref}>
            ops custom page render audit에서 request_id로 바로 검색
          </Link>
        </p>
        <details className="mt-3 rounded-lg border border-amber-200 bg-white/40 px-3 py-2 text-xs text-amber-950">
          <summary className="cursor-pointer font-semibold">request_id 보기</summary>
          <code className="mt-2 block select-text rounded bg-white/80 px-2 py-1">{requestId}</code>
        </details>
      </main>
    );
  }
}
