"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";

import Link from "next/link";
import { useState } from "react";

import { buttonTone, cn } from "@/app/_components/uiTokens";
import { apiFetch } from "@/lib/http/apiFetch";

export type UpgradeRequestItem = {
  id: string;
  createdAt: string;
  userId: string;
  orgName: string;
  contactEmail: string;
  seats: number | null;
  message: string;
  status: string;
};

type PlanForm = {
  userId: string;
  plan: "free" | "pro";
  expiresAt: string;
  note: string;
};

export default function OpsBillingClient({ initialRequests }: { initialRequests: UpgradeRequestItem[] }) {
  const [requests, setRequests] = useState<UpgradeRequestItem[]>(initialRequests);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [statusSaving, setStatusSaving] = useState<string | null>(null);

  const [planForm, setPlanForm] = useState<PlanForm>({
    userId: "",
    plan: "free",
    expiresAt: "",
    note: "",
  });
  const [planMessage, setPlanMessage] = useState<string | null>(null);
  const [planSaving, setPlanSaving] = useState(false);

  const updateStatus = async (id: string, status: string) => {
    setStatusSaving(id);
    setRequestError(null);
    try {
      const response = await apiFetch(apiV1Path(`ops/billing/requests/${id}`), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = (await response.json()) as { ok?: boolean; status?: string };
      if (!json.ok || !json.status) {
        setRequestError("상태를 업데이트하지 못했습니다.");
        return;
      }
      setRequests((prev) => prev.map((item) => (item.id === id ? { ...item, status: json.status! } : item)));
    } catch (error) {
      console.error(error);
      setRequestError("상태를 업데이트하지 못했습니다.");
    } finally {
      setStatusSaving(null);
    }
  };

  const fetchPlan = async () => {
    if (!planForm.userId) {
      setPlanMessage("user_id를 입력해주세요.");
      return;
    }
    setPlanSaving(true);
    setPlanMessage(null);
    try {
      const response = await apiFetch(apiV1Path(`ops/billing/users/${planForm.userId}`));
      const json = (await response.json()) as {
        ok?: boolean;
        plan?: "free" | "pro";
        expiresAt?: string | null;
        note?: string;
      };
      if (!json.ok) {
        setPlanMessage("플랜 정보를 불러오지 못했습니다.");
        return;
      }
      setPlanForm((prev) => ({
        ...prev,
        plan: (json.plan as "free" | "pro") ?? "free",
        expiresAt: json.expiresAt ?? "",
        note: json.note ?? "",
      }));
      setPlanMessage("조회 완료");
    } catch (error) {
      console.error(error);
      setPlanMessage("플랜 정보를 불러오지 못했습니다.");
    } finally {
      setPlanSaving(false);
    }
  };

  const savePlan = async () => {
    if (!planForm.userId) {
      setPlanMessage("user_id를 입력해주세요.");
      return;
    }
    setPlanSaving(true);
    setPlanMessage(null);
    try {
      const response = await apiFetch(apiV1Path(`ops/billing/users/${planForm.userId}`), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          plan: planForm.plan,
          expiresAt: planForm.expiresAt || null,
          note: planForm.note,
        }),
      });
      const json = (await response.json()) as { ok?: boolean; plan?: string };
      if (!json.ok) {
        setPlanMessage("저장하지 못했습니다.");
        return;
      }
      setPlanMessage("저장 완료");
    } catch (error) {
      console.error(error);
      setPlanMessage("저장하지 못했습니다.");
    } finally {
      setPlanSaving(false);
    }
  };

  return (
    <div className="min-w-0 space-y-6">
      <section className="dashboard-ops-card min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500">Upgrade Requests</p>
            <h2 className="break-words text-xl font-bold text-slate-900">업그레이드 요청 처리</h2>
            <p className="break-words text-sm text-slate-600">new/contacted/approved 상태를 즉시 반영합니다.</p>
          </div>
        </div>
        {requestError ? (
          <div className="dashboard-ops-card mt-3 flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">
            <p className="min-w-0 break-words">{requestError}</p>
            <Link
              href="/dashboard/ops/billing"
              className="dashboard-ops-control shrink-0 rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800"
            >
              새로고침
            </Link>
          </div>
        ) : null}
        <div className="mt-4 min-w-0 overflow-x-auto rounded-xl border border-slate-100">
          <table className="min-w-[760px] divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-slate-500">
                <th className="px-3 py-2">상태</th>
                <th className="px-3 py-2">기관</th>
                <th className="px-3 py-2">연락</th>
                <th className="px-3 py-2">메시지</th>
                <th className="px-3 py-2">요청 ID</th>
                <th className="px-3 py-2">변경</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests.map((req) => (
                <tr key={req.id} className="dashboard-ops-row align-top">
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        "dashboard-ops-billing-status inline-flex max-w-full items-center rounded-full px-3 py-1 text-xs font-semibold leading-none",
                        req.status === "approved"
                          ? "bg-emerald-100 text-emerald-700"
                          : req.status === "contacted"
                            ? "bg-indigo-100 text-indigo-700"
                            : req.status === "rejected"
                              ? "bg-rose-100 text-rose-700"
                              : "bg-slate-100 text-slate-700",
                      )}
                    >
                      {req.status}
                    </span>
                  </td>
                  <td className="min-w-0 px-3 py-2">
                    <div className="max-w-[12rem] break-words font-semibold text-slate-900">{req.orgName || "—"}</div>
                    <div className="text-xs text-slate-500">{req.seats ? `${req.seats} seats` : "seats n/a"}</div>
                  </td>
                  <td className="min-w-0 px-3 py-2">
                    <div className="max-w-[14rem] break-all font-semibold text-slate-900">{req.contactEmail}</div>
                    <div className="max-w-[14rem] break-all text-xs text-slate-500">{req.userId}</div>
                  </td>
                  <td className="min-w-0 px-3 py-2">
                    <p className="max-w-xs whitespace-pre-wrap break-words text-sm text-slate-700">{req.message || "—"}</p>
                  </td>
                  <td className="min-w-0 px-3 py-2 text-xs font-semibold text-slate-500">
                    <span className="block max-w-[12rem] break-all">{req.id}</span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      {["contacted", "approved", "rejected"].map((status) => (
                        <button
                          key={status}
                          type="button"
                          disabled={statusSaving === req.id}
                          onClick={() => void updateStatus(req.id, status)}
                          className={cn("dashboard-ops-control shrink-0", buttonTone("secondary", { size: "sm" }))}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-500">
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
                      <p className="break-words">접수된 요청이 없습니다.</p>
                      <Link
                        href="/dashboard/ops/billing"
                        className="dashboard-ops-control rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                      >
                        새로고침
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="dashboard-ops-card min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500">User Plans</p>
            <h2 className="break-words text-xl font-bold text-slate-900">플랜 토글 / 만료 설정</h2>
            <p className="break-words text-sm text-slate-600">user_id 기준으로 조회/저장합니다.</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="dashboard-ops-row min-w-0 space-y-1 rounded-lg border border-transparent p-1 text-sm font-semibold text-slate-700">
            user_id
            <input
              type="text"
              value={planForm.userId}
              onChange={(event) => setPlanForm({ ...planForm, userId: event.target.value })}
              className="dashboard-ops-input w-full min-w-0 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900 shadow-inner"
              placeholder="uuid"
            />
          </label>
          <label className="dashboard-ops-row min-w-0 space-y-1 rounded-lg border border-transparent p-1 text-sm font-semibold text-slate-700">
            plan
            <select
              value={planForm.plan}
              onChange={(event) => setPlanForm({ ...planForm, plan: event.target.value as "free" | "pro" })}
              className="dashboard-ops-input w-full min-w-0 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900 shadow-inner"
            >
              <option value="free">free</option>
              <option value="pro">pro</option>
            </select>
          </label>
          <label className="dashboard-ops-row min-w-0 space-y-1 rounded-lg border border-transparent p-1 text-sm font-semibold text-slate-700">
            expires_at (옵션)
            <input
              type="text"
              value={planForm.expiresAt}
              onChange={(event) => setPlanForm({ ...planForm, expiresAt: event.target.value })}
              placeholder="YYYY-MM-DDTHH:mm:ssZ"
              className="dashboard-ops-input w-full min-w-0 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900 shadow-inner"
            />
          </label>
          <label className="dashboard-ops-row min-w-0 space-y-1 rounded-lg border border-transparent p-1 text-sm font-semibold text-slate-700">
            note
            <input
              type="text"
              value={planForm.note}
              onChange={(event) => setPlanForm({ ...planForm, note: event.target.value })}
              className="dashboard-ops-input w-full min-w-0 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900 shadow-inner"
            />
          </label>
        </div>

        {planMessage ? (
          <p className="dashboard-ops-card mt-3 min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
            {planMessage}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void fetchPlan()}
            disabled={planSaving}
            className={cn("dashboard-ops-control shrink-0", buttonTone("secondary", { size: "md" }))}
          >
            조회
          </button>
          <button
            type="button"
            onClick={() => void savePlan()}
            disabled={planSaving}
            className={cn("dashboard-ops-control shrink-0", buttonTone("primary", { size: "md", tone: "indigo" }))}
          >
            저장
          </button>
        </div>
      </section>
    </div>
  );
}
