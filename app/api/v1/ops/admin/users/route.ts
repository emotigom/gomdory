import { NextRequest } from "next/server";

import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { withNoStoreHeaders } from "@/lib/api/server/noStoreHeaders";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { isOpsAdmin } from "@/lib/auth/opsAdmin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { routes } from "@/lib/standards/routes";
import { withOps, type WithOpsContext } from "@/lib/ops/withOps";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ROUTE_NAME = routes.api.opsAdmin.users();
const PER_PAGE = 50;

type EntitlementRow = {
  user_id: string;
  plan: "free" | "pro";
  billing_status: string;
  provider: string;
  pro_ends_at: string | null;
  trial_ends_at: string | null;
};

type StorageQuotaRow = {
  owner_id: string;
  quota_bytes: number;
  updated_at: string;
};

type StorageUsageRow = {
  user_id: string;
  bytes_used: number;
  updated_at: string;
};

function parsePage(value: string | null): number {
  if (!value) return 1;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return parsed;
}

function indexBy<T extends { user_id: string }>(rows: T[] | null | undefined) {
  return new Map((rows ?? []).map((row) => [row.user_id, row]));
}

function indexByOwner<T extends { owner_id: string }>(rows: T[] | null | undefined) {
  return new Map((rows ?? []).map((row) => [row.owner_id, row]));
}

async function handleGet(request: NextRequest, _context: unknown, ops: WithOpsContext) {
  let userId: string | null = null;
  try {
    const auth = await requireUserApi();
    userId = auth.user.id;
    if (!isOpsAdmin(auth.user.email)) {
      return jsonErrorWithRequestId(
        "forbidden",
        "운영자 권한이 필요합니다.",
        ops.requestId,
        403,
        { hint: "ops admin only" },
        withNoStoreHeaders(),
      );
    }
  } catch {
    return jsonErrorWithRequestId(
      "unauthorized",
      "로그인이 필요합니다.",
      ops.requestId,
      401,
      undefined,
      withNoStoreHeaders(),
    );
  }

  if (!userId) {
    return jsonErrorWithRequestId(
      "unauthorized",
      "로그인이 필요합니다.",
      ops.requestId,
      401,
      undefined,
      withNoStoreHeaders(),
    );
  }

  const page = parsePage(request.nextUrl.searchParams.get("page"));
  const perPage = PER_PAGE;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
  if (error) {
    return jsonErrorWithRequestId(
      "users_list_failed",
      "사용자 목록을 불러오지 못했습니다.",
      ops.requestId,
      502,
      { route: ROUTE_NAME },
      withNoStoreHeaders(),
    );
  }

  const users = data?.users ?? [];
  const userIds = users.map((user) => user.id);

  if (userIds.length === 0) {
    return jsonOkWithRequestId({ users: [], page, perPage, hasMore: false }, ops.requestId, withNoStoreHeaders());
  }

  const [entitlementsResult, quotaResult, usageResult] = await Promise.all([
    admin
      .from("user_entitlements")
      .select("user_id, plan, billing_status, provider, pro_ends_at, trial_ends_at")
      .in("user_id", userIds)
      .returns<EntitlementRow[]>(),
    admin
      .from("storage_quota")
      .select("owner_id, quota_bytes, updated_at")
      .in("owner_id", userIds)
      .returns<StorageQuotaRow[]>(),
    admin
      .from("storage_usage")
      .select("user_id, bytes_used, updated_at")
      .in("user_id", userIds)
      .returns<StorageUsageRow[]>(),
  ]);

  if (entitlementsResult.error) {
    return jsonErrorWithRequestId(
      "entitlements_failed",
      "요금제 정보를 불러오지 못했습니다.",
      ops.requestId,
      502,
      undefined,
      withNoStoreHeaders(),
    );
  }

  if (quotaResult.error) {
    return jsonErrorWithRequestId(
      "quota_failed",
      "스토리지 할당량을 불러오지 못했습니다.",
      ops.requestId,
      502,
      undefined,
      withNoStoreHeaders(),
    );
  }

  if (usageResult.error) {
    return jsonErrorWithRequestId(
      "usage_failed",
      "스토리지 사용량을 불러오지 못했습니다.",
      ops.requestId,
      502,
      undefined,
      withNoStoreHeaders(),
    );
  }

  const entitlementsByUser = indexBy(entitlementsResult.data);
  const quotasByOwner = indexByOwner(quotaResult.data);
  const usageByUser = indexBy(usageResult.data);

  const responseUsers = users.map((user) => {
    const entitlement = entitlementsByUser.get(user.id) ?? null;
    const quota = quotasByOwner.get(user.id) ?? null;
    const usage = usageByUser.get(user.id) ?? null;

    return {
      id: user.id,
      email: user.email,
      createdAt: user.created_at,
      plan: entitlement
        ? {
            plan: entitlement.plan,
            billing_status: entitlement.billing_status,
            provider: entitlement.provider,
            pro_ends_at: entitlement.pro_ends_at,
            trial_ends_at: entitlement.trial_ends_at,
          }
        : {
            plan: "free",
            billing_status: "free",
            provider: "none",
            pro_ends_at: null,
            trial_ends_at: null,
          },
      storage: {
        usedBytes: usage?.bytes_used ?? 0,
        quotaBytes: quota?.quota_bytes ?? 0,
        updatedAt: usage?.updated_at ?? quota?.updated_at ?? null,
      },
    };
  });

  const hasMore = users.length === perPage;

  return jsonOkWithRequestId({ users: responseUsers, page, perPage, hasMore }, ops.requestId, withNoStoreHeaders());
}

export const GET = withOps(handleGet, { log: true, errorCode: "db_failed" });
