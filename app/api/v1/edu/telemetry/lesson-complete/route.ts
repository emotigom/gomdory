import { NextRequest } from "next/server";

import { withNoStoreHeaders } from "@/lib/api/server/noStoreHeaders";
import { jsonOk } from "@/lib/api/server/response";
import { todayKst } from "@/lib/edu/dateKst";
import { getEduJoinSession } from "@/lib/edu/joinSession";
import { buildEduCodeHash } from "@/lib/edu/opsEvent";
import { checkRateLimit } from "@/lib/safety/rateLimit";
import { EDU_COLUMNS, EDU_TABLES } from "@/lib/standards/eduDb";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const MAX_ANON_HASHES = 500;
const LESSON_KEY_REGEX = /^[A-Za-z0-9_-]{2,12}$/;
const HASH_REGEX = /^[a-f0-9]{8,64}$/i;

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as
    | {
        lessonKey?: unknown;
        anonIdHash?: unknown;
        jt?: unknown;
        codeHash?: unknown;
        ts?: unknown;
      }
    | null;

  if (!payload) {
    return jsonOk({ skipped: true }, withNoStoreHeaders());
  }

  const lessonKey = typeof payload.lessonKey === "string" ? payload.lessonKey.trim() : "";
  const anonIdHash = typeof payload.anonIdHash === "string" ? payload.anonIdHash.trim() : "";

  if (!lessonKey || !LESSON_KEY_REGEX.test(lessonKey) || !anonIdHash || !HASH_REGEX.test(anonIdHash)) {
    return jsonOk({ skipped: true }, withNoStoreHeaders());
  }

  const supabase = createSupabaseAdminClient();

  let codeHash = typeof payload.codeHash === "string" ? payload.codeHash.trim() : "";

  if (!codeHash) {
    const joinToken = typeof payload.jt === "string" ? payload.jt.trim() : "";
    if (!joinToken) {
      return jsonOk({ skipped: true }, withNoStoreHeaders());
    }
    const joinSession = await getEduJoinSession(joinToken);
    if (!joinSession?.shareCode) {
      return jsonOk({ skipped: true }, withNoStoreHeaders());
    }

    let boardId = joinSession.boardId ?? null;

    if (!boardId) {
      const { data } = await supabase
        .from(EDU_TABLES.classes)
        .select(EDU_COLUMNS.boardId)
        .eq(EDU_COLUMNS.shareCode, joinSession.shareCode)
        .maybeSingle();
      boardId = (data?.[EDU_COLUMNS.boardId] as string | null) ?? null;
    }

    if (!boardId) {
      return jsonOk({ skipped: true }, withNoStoreHeaders());
    }

    codeHash = (await buildEduCodeHash(boardId, joinSession.shareCode)) ?? "";
  }

  if (!codeHash || !HASH_REGEX.test(codeHash)) {
    return jsonOk({ skipped: true }, withNoStoreHeaders());
  }

  try {
    const rateLimitResult = await checkRateLimit(
      supabase as unknown as Parameters<typeof checkRateLimit>[0],
      {
        key: `edu:lesson-complete:${codeHash}`,
        windowSeconds: 60,
        limit: 10,
      },
    );
    if (!rateLimitResult.ok) {
      return jsonOk({ rateLimited: true }, withNoStoreHeaders());
    }
  } catch {
    // ignore rate limit failures
  }

  const dayBucket = todayKst();

  const { data: existing } = await supabase
    .from(EDU_TABLES.lessonCompletionsDaily)
    .select(`${EDU_COLUMNS.anonHashes}, ${EDU_COLUMNS.uniqueAnonCount}`)
    .eq(EDU_COLUMNS.codeHash, codeHash)
    .eq(EDU_COLUMNS.lessonKey, lessonKey)
    .eq(EDU_COLUMNS.dayBucket, dayBucket)
    .maybeSingle();

  const existingHashes = Array.isArray(existing?.[EDU_COLUMNS.anonHashes])
    ? (existing?.[EDU_COLUMNS.anonHashes] as unknown[]).filter((value) => typeof value === "string")
    : [];

  if (existingHashes.includes(anonIdHash)) {
    return jsonOk({}, withNoStoreHeaders());
  }

  const now = new Date().toISOString();
  const existingCount =
    typeof existing?.[EDU_COLUMNS.uniqueAnonCount] === "number"
      ? (existing?.[EDU_COLUMNS.uniqueAnonCount] as number)
      : 0;
  const baseCount = Math.max(0, existingCount, existingHashes.length);
  const shouldAppend = existingHashes.length < MAX_ANON_HASHES;
  const nextHashes = shouldAppend ? [...existingHashes, anonIdHash] : existingHashes;
  const nextCount = baseCount + 1;

  await supabase
    .from(EDU_TABLES.lessonCompletionsDaily)
    .upsert(
      {
        [EDU_COLUMNS.codeHash]: codeHash,
        [EDU_COLUMNS.lessonKey]: lessonKey,
        [EDU_COLUMNS.dayBucket]: dayBucket,
        [EDU_COLUMNS.uniqueAnonCount]: nextCount,
        [EDU_COLUMNS.anonHashes]: nextHashes,
        [EDU_COLUMNS.updatedAt]: now,
      },
      {
        onConflict: [EDU_COLUMNS.codeHash, EDU_COLUMNS.lessonKey, EDU_COLUMNS.dayBucket].join(","),
      },
    );

  return jsonOk({}, withNoStoreHeaders());
}
