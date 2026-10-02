import { NextRequest } from "next/server";

import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUser } from "@/lib/auth/requireUser";
import { withNoStoreHeaders } from "@/lib/api/server/noStoreHeaders";
import { jsonOk } from "@/lib/api/server/response";
import { todayKst } from "@/lib/edu/dateKst";
import { buildEduCodeHash } from "@/lib/edu/opsEvent";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EDU_COLUMNS, EDU_RPC, EDU_TABLES } from "@/lib/standards/eduDb";

const LESSON_KEYS = ["P1", "P2", "P3", "P4"] as const;

const DEFAULT_ITEMS = LESSON_KEYS.map((lessonKey) => ({
  lessonKey,
  attend: 0,
  done: 0,
  rate: 0,
}));

export async function GET(request: NextRequest) {
  await requireUser("/dashboard");

  const { searchParams } = new URL(request.url);
  const boardId = searchParams.get("boardId")?.trim() ?? "";

  if (!boardId) {
    return Response.json(
      { ok: false, error: "boardId is required" },
      withNoStoreHeaders({ status: 400 }),
    );
  }

  const supabase = createSupabaseServerClient();
  const { data: role, error: roleError } = await supabase.rpc(EDU_RPC.boardRole, { bid: boardId });
  const boardRole = normalizeBoardRole(role);

  if (roleError || !boardRole) {
    return Response.json(
      { ok: false, error: "board not found" },
      withNoStoreHeaders({ status: 404 }),
    );
  }

  if (boardRole === "viewer") {
    return Response.json(
      { ok: false, error: "forbidden" },
      withNoStoreHeaders({ status: 403 }),
    );
  }

  const dayBucket = todayKst();
  const admin = createSupabaseAdminClient();
  const { data: classRow } = await admin
    .from(EDU_TABLES.classes)
    .select(EDU_COLUMNS.shareCode)
    .eq(EDU_COLUMNS.boardId, boardId)
    .maybeSingle();

  const shareCode = typeof classRow?.[EDU_COLUMNS.shareCode] === "string" ? classRow[EDU_COLUMNS.shareCode] : "";

  if (!shareCode) {
    return jsonOk({ items: DEFAULT_ITEMS, dayBucket, hasClass: false }, withNoStoreHeaders());
  }

  const codeHash = await buildEduCodeHash(boardId, shareCode);
  if (!codeHash) {
    return jsonOk({ items: DEFAULT_ITEMS, dayBucket, hasClass: false }, withNoStoreHeaders());
  }

  const [{ data: completionRows }, { data: attendanceRows }] = await Promise.all([
    admin
      .from(EDU_TABLES.lessonCompletionsDaily)
      .select(`${EDU_COLUMNS.lessonKey}, ${EDU_COLUMNS.uniqueAnonCount}`)
      .eq(EDU_COLUMNS.codeHash, codeHash)
      .eq(EDU_COLUMNS.dayBucket, dayBucket),
    admin
      .from(EDU_TABLES.lessonAttendanceDaily)
      .select(`${EDU_COLUMNS.lessonKey}, ${EDU_COLUMNS.uniqueAnonCount}`)
      .eq(EDU_COLUMNS.codeHash, codeHash)
      .eq(EDU_COLUMNS.dayBucket, dayBucket),
  ]);

  const completions = new Map<string, number>();
  for (const row of completionRows ?? []) {
    const lessonKeyValue =
      typeof row?.[EDU_COLUMNS.lessonKey] === "string" ? (row[EDU_COLUMNS.lessonKey] as string) : "";
    if (LESSON_KEYS.includes(lessonKeyValue as (typeof LESSON_KEYS)[number])) {
      completions.set(
        lessonKeyValue,
        typeof row?.[EDU_COLUMNS.uniqueAnonCount] === "number" ? row[EDU_COLUMNS.uniqueAnonCount] : 0,
      );
    }
  }

  const attendance = new Map<string, number>();
  for (const row of attendanceRows ?? []) {
    const lessonKeyValue =
      typeof row?.[EDU_COLUMNS.lessonKey] === "string" ? (row[EDU_COLUMNS.lessonKey] as string) : "";
    if (LESSON_KEYS.includes(lessonKeyValue as (typeof LESSON_KEYS)[number])) {
      attendance.set(
        lessonKeyValue,
        typeof row?.[EDU_COLUMNS.uniqueAnonCount] === "number" ? row[EDU_COLUMNS.uniqueAnonCount] : 0,
      );
    }
  }

  const items = LESSON_KEYS.map((lessonKey) => {
    const attend = attendance.get(lessonKey) ?? 0;
    const done = completions.get(lessonKey) ?? 0;
    const rate = attend > 0 ? Math.round((done / attend) * 100) : 0;
    return { lessonKey, attend, done, rate };
  });

  return jsonOk({ items, dayBucket, hasClass: true }, withNoStoreHeaders());
}
