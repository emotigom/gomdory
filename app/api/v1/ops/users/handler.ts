import { NextRequest } from "next/server";

import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { withNoStoreHeaders } from "@/lib/api/server/noStoreHeaders";
import { requireOpsAdmin } from "@/lib/auth/requireOpsAdmin";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import type { WithOpsContext } from "@/lib/ops/withOps";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const MAX_RESULTS = 25;

type Dependencies = {
  requireOpsAdminFn?: typeof requireOpsAdmin;
  createAdminClientFn?: typeof createSupabaseAdminClient;
};

export async function handleOpsUsersSearch(
  request: NextRequest,
  _context: unknown,
  ops: WithOpsContext,
  deps?: Dependencies,
) {
  const ensureOpsAdmin = deps?.requireOpsAdminFn ?? requireOpsAdmin;
  const createAdminClient = deps?.createAdminClientFn ?? createSupabaseAdminClient;

  try {
    await ensureOpsAdmin(requireUserApi);
  } catch (error) {
    const status = (error as { code?: string }).code === "forbidden" ? 403 : 401;
    return jsonErrorWithRequestId(
      status === 403 ? "forbidden" : "unauthorized",
      status === 403 ? "운영자 권한이 필요합니다." : "로그인이 필요합니다.",
      ops.requestId,
      status,
      undefined,
      withNoStoreHeaders(),
    );
  }

  const query = (request.nextUrl.searchParams.get("query") ?? "").trim().toLowerCase();
  if (!query) {
    return jsonErrorWithRequestId(
      "invalidRequest",
      "query(email)가 필요합니다.",
      ops.requestId,
      400,
      undefined,
      withNoStoreHeaders(),
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) {
    return jsonErrorWithRequestId(
      "usersListFailed",
      "사용자 목록을 불러오지 못했습니다.",
      ops.requestId,
      502,
      undefined,
      withNoStoreHeaders(),
    );
  }

  const users = (data?.users ?? [])
    .filter((user) => (user.email ?? "").toLowerCase().includes(query))
    .slice(0, MAX_RESULTS)
    .map((user) => ({ id: user.id, email: user.email ?? null, createdAt: user.created_at ?? null }));

  return jsonOkWithRequestId({ users, query, count: users.length }, ops.requestId, withNoStoreHeaders());
}
