export const dynamic = "force-dynamic";

import Link from "next/link";

import OpsFilterBar from "../_components/OpsFilterBar";
import OpsTable from "../_components/OpsTable";
import { bulkUserBanAction, bulkUserUnbanAction } from "../adminActions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isOpsAdmin } from "@/lib/auth/opsAdmin";

import ResetUiPrefsButton from "./ResetUiPrefsButton";

type UserAuditRow = {
  id: string;
  actor_user_id: string | null;
  action: string;
  request_id: string | null;
  created_at: string;
};

type UserRow = {
  id: string;
  email: string | null;
  created_at: string;
  banned_until?: string | null;
};

type Entitlement = {
  user_id: string;
  billing_status: string;
};

type UiPrefsRow = {
  user_id: string;
  class_prefs?: {
    teacherUiPrefs?: {
      theme?: string;
      backgroundMode?: string;
      fontFamily?: string;
      baseFontSize?: number;
    };
    teacherUiCustomPresetsV2?: unknown;
  } | null;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return date.toLocaleString("ko-KR");
}

function resolveSystemJobsSection(action: string) {
  if (action.startsWith("ui_prefs_")) {
    return {
      anchor: "ui-prefs-audit",
      extraParams: new URLSearchParams({ auditAction: "ui_prefs_*", auditWindow: "24h" }),
    };
  }
  if (action.startsWith("dashboard_quick_create_")) {
    return {
      anchor: "quick-create-audit",
      extraParams: new URLSearchParams({ quickCreateWindow: "24h" }),
    };
  }
  if (action.startsWith("community_")) {
    return {
      anchor: "community-moderation-audit",
      extraParams: new URLSearchParams(),
    };
  }
  return null;
}

function buildRequestIdHref(action: string, requestId: string) {
  const section = resolveSystemJobsSection(action);
  if (!section) return "";

  const params = section.extraParams;
  params.set("q", requestId);
  if (action.startsWith("dashboard_quick_create_")) {
    params.set("quickCreateRequestId", requestId);
  }

  return `/dashboard/ops/system-jobs?${params.toString()}#${section.anchor}`;
}

export default async function OpsUsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const q = String(params.q ?? "").trim().toLowerCase();
  const status = String(params.status ?? "all");
  const role = String(params.role ?? "all");

  const admin = createSupabaseAdminClient();
  const usersRes = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const usersRaw = (usersRes.data?.users ?? []) as UserRow[];
  const userIds = usersRaw.map((item) => item.id);

  const entitlements = userIds.length
    ? await admin.from("user_entitlements").select("user_id, billing_status").in("user_id", userIds).returns<Entitlement[]>()
    : { data: [] as Entitlement[] };

  const uiPrefs = userIds.length
    ? await admin
        .from("user_ui_prefs")
        .select("user_id, class_prefs")
        .in("user_id", userIds)
        .returns<UiPrefsRow[]>()
    : { data: [] as UiPrefsRow[] };

  const entitlementMap = new Map((entitlements.data ?? []).map((item) => [item.user_id, item.billing_status]));
  const uiPrefsMap = new Map((uiPrefs.data ?? []).map((item) => [item.user_id, item.class_prefs]));

  let recentAuditByActor = new Map<string, UserAuditRow[]>();
  let recentAuditError = "";

  try {
    if (userIds.length) {
      const { data, error } = await admin
        .from("audit_logs")
        .select("id, actor_user_id, action, request_id, created_at")
        .in("actor_user_id", userIds)
        .or("action.like.ui_prefs_%,action.like.dashboard_quick_create_%,action.like.community_%")
        .order("created_at", { ascending: false })
        .limit(4000)
        .returns<UserAuditRow[]>();

      if (error) {
        recentAuditError = error.message;
      } else {
        const map = new Map<string, UserAuditRow[]>();
        for (const row of data ?? []) {
          const actorId = row.actor_user_id;
          if (!actorId) continue;
          const list = map.get(actorId) ?? [];
          if (list.length >= 20) continue;
          list.push(row);
          map.set(actorId, list);
        }
        recentAuditByActor = map;
      }
    }
  } catch (error) {
    recentAuditError = error instanceof Error ? error.message : "알 수 없는 오류";
  }

  const filtered = usersRaw.filter((user) => {
    const email = (user.email ?? "").toLowerCase();
    const isBanned = Boolean(user.banned_until);
    const isAdmin = isOpsAdmin(user.email);
    const billingStatus = entitlementMap.get(user.id) ?? "free";

    if (q && !email.includes(q) && !user.id.includes(q)) return false;
    if (status === "active" && isBanned) return false;
    if (status === "banned" && !isBanned) return false;
    if (status === "pro" && !billingStatus.includes("pro")) return false;
    if (role === "ops_admin" && !isAdmin) return false;
    if (role === "member" && isAdmin) return false;
    return true;
  });

  return (
    <main className="space-y-4">
      <OpsFilterBar title="Users 관리" description="검색/상태/권한 필터 + 대량 정지/해제">
        <form className="flex flex-wrap items-end gap-2" action="/dashboard/ops/users">
          <label className="min-w-0 text-xs text-slate-600">
            검색
            <input name="q" defaultValue={q} className="dashboard-ops-input ml-1 w-48 max-w-full rounded-lg border border-slate-200 px-2 py-1 text-sm" />
          </label>
          <label className="min-w-0 text-xs text-slate-600">
            상태
            <select name="status" defaultValue={status} className="dashboard-ops-input ml-1 max-w-full rounded-lg border border-slate-200 px-2 py-1 text-sm">
              <option value="all">전체</option>
              <option value="active">활성</option>
              <option value="banned">정지</option>
              <option value="pro">Pro</option>
            </select>
          </label>
          <label className="min-w-0 text-xs text-slate-600">
            권한
            <select name="role" defaultValue={role} className="dashboard-ops-input ml-1 max-w-full rounded-lg border border-slate-200 px-2 py-1 text-sm">
              <option value="all">전체</option>
              <option value="ops_admin">운영자</option>
              <option value="member">일반</option>
            </select>
          </label>
          <button className="dashboard-ops-control rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold">적용</button>
        </form>
      </OpsFilterBar>

      <form className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <button formAction={bulkUserBanAction} className="dashboard-ops-control rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
            선택 사용자 정지
          </button>
          <button formAction={bulkUserUnbanAction} className="dashboard-ops-control rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
            선택 사용자 정지 해제
          </button>
        </div>
        <OpsTable>
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2">선택</th>
              <th className="px-3 py-2">이메일</th>
              <th className="px-3 py-2">상태</th>
              <th className="px-3 py-2">권한</th>
              <th className="px-3 py-2">UI prefs</th>
              <th className="px-3 py-2">가입일</th>
              <th className="px-3 py-2">액션</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => {
              const isBanned = Boolean(user.banned_until);
              const userRole = isOpsAdmin(user.email) ? "ops_admin" : "member";
              const classPrefs = uiPrefsMap.get(user.id) ?? null;
              const teacherUiPrefs = classPrefs?.teacherUiPrefs;
              const presets = Array.isArray(classPrefs?.teacherUiCustomPresetsV2)
                ? classPrefs.teacherUiCustomPresetsV2.length
                : 0;

              return (
                <tr key={user.id} className="dashboard-ops-row border-t border-slate-100 align-top">
                  <td className="px-3 py-2"><input type="checkbox" name="userIds" value={user.id} className="dashboard-ops-input h-4 w-4 rounded border-slate-300 text-slate-900" /></td>
                  <td className="min-w-0 px-3 py-2">
                    <p className="max-w-[18rem] truncate font-semibold text-slate-900">{user.email ?? "(no email)"}</p>
                    <p className="max-w-[18rem] break-all text-xs text-slate-500">{user.id}</p>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {isBanned ? <span className="inline-flex whitespace-nowrap rounded bg-rose-50 px-2 py-1 text-rose-700">정지</span> : <span className="inline-flex whitespace-nowrap rounded bg-emerald-50 px-2 py-1 text-emerald-700">활성</span>}
                  </td>
                  <td className="max-w-32 break-words px-3 py-2 text-xs text-slate-700">{userRole}</td>
                  <td className="min-w-0 px-3 py-2 text-xs text-slate-700">
                    <p className="max-w-40 truncate">theme: {teacherUiPrefs?.theme ?? "—"}</p>
                    <p className="max-w-40 truncate">bg: {teacherUiPrefs?.backgroundMode ?? "—"}</p>
                    <p className="max-w-40 truncate">font: {teacherUiPrefs?.fontFamily ?? "—"}</p>
                    <p className="max-w-40 truncate">size: {teacherUiPrefs?.baseFontSize ?? "—"}</p>
                    <p>presets: {presets}</p>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">{formatDate(user.created_at)}</td>
                  <td className="px-3 py-2 align-top">
                    <ResetUiPrefsButton userId={user.id} />
                    <div className="dashboard-ops-card mt-2 min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-2">
                      <p className="text-[11px] font-semibold text-slate-700">최근 audit actions (요약)</p>
                      {recentAuditError ? (
                        <p className="mt-1 text-xs text-amber-700">데이터 접근 불가</p>
                      ) : (
                        <ul className="mt-1 space-y-1 text-[11px] text-slate-600">
                          {(recentAuditByActor.get(user.id) ?? []).slice(0, 20).map((row) => {
                            const requestId = row.request_id?.trim();
                            const href = requestId ? buildRequestIdHref(row.action, requestId) : "";
                            return (
                              <li key={row.id} className="dashboard-ops-row rounded border border-slate-200 bg-white px-2 py-1">
                                <p className="max-w-56 truncate font-medium text-slate-700">{row.action}</p>
                                <p className="text-slate-500">{formatDate(row.created_at)}</p>
                                {requestId && href ? (
                                  <a className="dashboard-ops-text-link block max-w-56 break-all text-[11px] text-sky-700 underline" href={href}>
                                    request_id: {requestId}
                                  </a>
                                ) : (
                                  <p className="max-w-56 break-all text-slate-400">request_id: {requestId ?? "—"}</p>
                                )}
                              </li>
                            );
                          })}
                          {(recentAuditByActor.get(user.id) ?? []).length === 0 ? <li className="text-slate-500">최근 로그 없음</li> : null}
                        </ul>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 ? (
              <tr className="dashboard-ops-row border-t border-slate-100">
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-500">
                  <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
                    <p>조건에 맞는 사용자가 없습니다.</p>
                    <Link href="/dashboard/ops/users" className="dashboard-ops-control rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
                      필터 초기화
                    </Link>
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </OpsTable>
      </form>
    </main>
  );
}
