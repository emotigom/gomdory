export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse, type NextRequest } from "next/server";

import { jsonError, jsonOk } from "@/lib/api/server/response";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { isOpsOwner } from "@/lib/auth/opsOwners";
import { withRequestContext, type RequestContext } from "@/lib/api/server/requestContext";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Dependencies = {
  requireUserApiFn?: typeof requireUserApi;
  isOpsOwnerFn?: typeof isOpsOwner;
  createAdminClientFn?: typeof createSupabaseAdminClient;
};

type OpsEventRow = {
  id: string;
  ts: string;
  level: string;
  kind: string;
  route: string | null;
  request_id: string | null;
  status: number | null;
  duration_ms: number | null;
  meta: Record<string, unknown> | null;
  sample_rate: number | null;
};

async function handleGet(
  request: NextRequest,
  _context: unknown,
  requestContext: RequestContext,
  deps?: Dependencies,
) {
  const ensureUser = deps?.requireUserApiFn ?? requireUserApi;
  const checkOwner = deps?.isOpsOwnerFn ?? isOpsOwner;
  const createAdminClient = deps?.createAdminClientFn ?? createSupabaseAdminClient;

  let userEmail: string | null = null;

  try {
    const { user } = await ensureUser();
    userEmail = user.email ?? null;
  } catch {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  if (!checkOwner(userEmail)) {
    return jsonError("not_found", "Not found", 404, { requestId: requestContext.requestId });
  }

  const url = new URL(request.url);
  const kind = url.searchParams.get("kind");
  const level = url.searchParams.get("level");
  const route = url.searchParams.get("route");
  const cursor = url.searchParams.get("cursor");

  const client = createAdminClient();
  let query = client
    .from("ops_events")
    .select("id, ts, level, kind, route, request_id, status, duration_ms, meta, sample_rate")
    .order("ts", { ascending: false })
    .limit(50);

  if (kind) {
    query = query.eq("kind", kind);
  }
  if (level) {
    query = query.eq("level", level);
  }
  if (route) {
    query = query.eq("route", route);
  }
  if (cursor) {
    query = query.lt("ts", cursor);
  }

  const { data, error } = await query;
  if (error) {
    return jsonError("ops_events_failed", "Unable to fetch ops events", 500, {
      requestId: requestContext.requestId,
    });
  }

  const events = (data ?? []) as OpsEventRow[];
  const nextCursor = events.length > 0 ? events[events.length - 1]?.ts ?? null : null;

  return jsonOk({ events, nextCursor });
}

export const GET = withRequestContext(handleGet);
