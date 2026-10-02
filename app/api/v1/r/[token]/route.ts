import { NextResponse } from "next/server";

import { isReportShareActive, isValidReportShareToken, getReportShareByToken } from "@/lib/data/sessionReportShares";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SessionReport } from "@/lib/types/sessionReport";

export const dynamic = "force-dynamic";

function jsonError(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  if (!token || !isValidReportShareToken(token)) {
    return jsonError("invalid_token", "유효하지 않은 링크입니다.", 404);
  }

  try {
    const share = await getReportShareByToken(token);
    if (!isReportShareActive(share)) {
      return jsonError("invalid_token", "유효하지 않은 링크입니다.", 404);
    }

    const supabase = createSupabaseAdminClient();
    const { data: session, error } = await supabase
      .from("class_sessions")
      .select("*")
      .eq("id", share?.session_id ?? "")
      .eq("board_id", share?.board_id ?? "")
      .maybeSingle();

    if (error || !session) {
      return jsonError("not_found", "리포트를 찾을 수 없습니다.", 404);
    }

    const sessionRow = session as {
      title?: string | null;
      started_at: string;
      ended_at: string | null;
      report?: SessionReport | null;
    };
    const report = sessionRow.report ?? null;

    return NextResponse.json({
      ok: true,
      data: {
        title: report?.title ?? sessionRow.title ?? "수업 리포트",
        startedAt: sessionRow.started_at,
        endedAt: sessionRow.ended_at,
        report,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "리포트를 불러오지 못했습니다.";
    return jsonError("report_fetch_failed", message, 502);
  }
}
