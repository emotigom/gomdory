import { NextRequest } from "next/server";

import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { withNoStoreHeaders } from "@/lib/api/server/noStoreHeaders";
import { requireOpsAdmin } from "@/lib/auth/requireOpsAdmin";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import type { WithOpsContext } from "@/lib/ops/withOps";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const DEFAULT_FLAGS = {
  webllmEnabled: true,
  netsaverEnabled: false,
  netsaverMode: "lease_only",
  netsaverP2pTier: "meta",
  maxBytes: 10 * 1024 * 1024,
  updatedAt: null,
} as const;

const DEFAULT_PER_PAGE = 50;
const MAX_PER_PAGE = 100;
const MAX_FILTER_PAGES = 10;

type Dependencies = {
  requireOpsAdminFn?: typeof requireOpsAdmin;
  createAdminClientFn?: typeof createSupabaseAdminClient;
};

type FeatureFlagRow = {
  user_id: string;
  webllm_enabled: boolean | null;
  netsaver_enabled: boolean | null;
  netsaver_mode: "lease_only" | "auto" | null;
  netsaver_p2p_tier: "meta" | "small_shards" | "wasm" | null;
  max_bytes: number | null;
  updated_at: string | null;
};

function parsePositiveInt(value: string | null, fallback: number, max?: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  if (max && parsed > max) return max;
  return parsed;
}

export async function handleFeatureFlagsGet(
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
    const code = status === 403 ? "forbidden" : "unauthorized";
    const message = status === 403 ? "운영자 권한이 필요합니다." : "로그인이 필요합니다.";

    return jsonErrorWithRequestId(code, message, ops.requestId, status, undefined, withNoStoreHeaders());
  }

  const page = parsePositiveInt(request.nextUrl.searchParams.get("page"), 1);
  const perPage = parsePositiveInt(request.nextUrl.searchParams.get("perPage"), DEFAULT_PER_PAGE, MAX_PER_PAGE);
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();

  const admin = createAdminClient();
  let listUsers: Array<{ id: string; email?: string | null; createdAt?: string | null }> = [];
  let hasMore = false;

  if (!query) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      return jsonErrorWithRequestId(
        "users_list_failed",
        "사용자 목록을 불러오지 못했습니다.",
        ops.requestId,
        502,
        undefined,
        withNoStoreHeaders(),
      );
    }

    listUsers = (data?.users ?? []).map((user) => ({ id: user.id, email: user.email, createdAt: user.created_at }));
    hasMore = (data?.users ?? []).length === perPage;
  } else {
    const collected: typeof listUsers = [];
    let nextPage = page;

    for (let i = 0; i < MAX_FILTER_PAGES; i += 1) {
      const { data, error } = await admin.auth.admin.listUsers({ page: nextPage, perPage });
      if (error) {
        return jsonErrorWithRequestId(
          "users_list_failed",
          "사용자 목록을 불러오지 못했습니다.",
          ops.requestId,
          502,
          undefined,
          withNoStoreHeaders(),
        );
      }

      const users = data?.users ?? [];
      const matches = users.filter((user) => (user.email ?? "").toLowerCase().includes(query));
      for (const user of matches) {
        collected.push({ id: user.id, email: user.email, createdAt: user.created_at });
      }

      if (collected.length >= perPage + 1) {
        hasMore = true;
        break;
      }

      if (users.length < perPage) {
        hasMore = false;
        break;
      }

      nextPage += 1;
      hasMore = i + 1 >= MAX_FILTER_PAGES;
    }

    listUsers = collected.slice(0, perPage);
  }

  const userIds = listUsers.map((user) => user.id);
  if (userIds.length === 0) {
    return jsonOkWithRequestId(
      { users: [], flagsByUserId: {}, page, perPage, hasMore },
      ops.requestId,
      withNoStoreHeaders(),
    );
  }

  const { data: flagsRows, error: flagsError } = await admin
    .from("edu_feature_flags")
    .select("user_id, webllm_enabled, netsaver_enabled, netsaver_mode, netsaver_p2p_tier, max_bytes, updated_at")
    .in("user_id", userIds)
    .returns<FeatureFlagRow[]>();

  if (flagsError) {
    return jsonErrorWithRequestId(
      "feature_flags_failed",
      "기능 플래그를 불러오지 못했습니다.",
      ops.requestId,
      502,
      undefined,
      withNoStoreHeaders(),
    );
  }

  const flagsByUserId = Object.fromEntries(
    userIds.map((userId) => {
      const row = (flagsRows ?? []).find((item) => item.user_id === userId);
      return [
        userId,
        {
          webllmEnabled: row?.webllm_enabled ?? DEFAULT_FLAGS.webllmEnabled,
          netsaverEnabled: row?.netsaver_enabled ?? DEFAULT_FLAGS.netsaverEnabled,
          netsaverMode: row?.netsaver_mode ?? DEFAULT_FLAGS.netsaverMode,
          netsaverP2pTier: row?.netsaver_p2p_tier ?? DEFAULT_FLAGS.netsaverP2pTier,
          maxBytes: row?.max_bytes ?? DEFAULT_FLAGS.maxBytes,
          updatedAt: row?.updated_at ?? DEFAULT_FLAGS.updatedAt,
        },
      ];
    }),
  );

  const users = listUsers.map((user) => ({ id: user.id, email: user.email ?? null, createdAt: user.createdAt ?? null }));

  return jsonOkWithRequestId(
    { users, flagsByUserId, page, perPage, hasMore },
    ops.requestId,
    withNoStoreHeaders(),
  );
}
