"use client";

import { Fragment, useMemo, useState } from "react";

import { buttonTone, cn } from "@/app/_components/uiTokens";
import { formatBytes } from "@/lib/format/bytes";
import { apiFetch } from "@/lib/http/apiFetch";
import { routes } from "@/lib/standards/routes";

const BYTES_PER_GB = 1024 ** 3;
const MAX_QUOTA_BYTES = 10 * 1024 ** 4;

type OpsUser = {
  id: string;
  email: string | null;
  createdAt: string | null;
  plan: {
    plan: string;
    billing_status: string;
    provider: string;
    pro_ends_at: string | null;
    trial_ends_at: string | null;
  };
  storage: {
    usedBytes: number;
    quotaBytes: number;
    updatedAt: string | null;
  };
};

type RowError = {
  message: string;
  requestId?: string | null;
};

const formatGbInput = (bytes: number) => {
  const raw = bytes / BYTES_PER_GB;
  const rounded = Math.round(raw * 10) / 10;
  if (!Number.isFinite(rounded)) return "0";
  return rounded % 1 === 0 ? String(rounded.toFixed(0)) : rounded.toFixed(1);
};

const parseGbInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d+(\.\d)?$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
};

export default function OpsUsersClient({ initialUsers }: { initialUsers: OpsUser[] }) {
  const [users, setUsers] = useState<OpsUser[]>(initialUsers);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [quotaInput, setQuotaInput] = useState<string>("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, RowError | null>>({});

  const maxQuotaGb = useMemo(() => MAX_QUOTA_BYTES / BYTES_PER_GB, []);

  const beginEdit = (user: OpsUser) => {
    setEditingId(user.id);
    setQuotaInput(formatGbInput(user.storage.quotaBytes));
    setRowErrors((prev) => ({ ...prev, [user.id]: null }));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setQuotaInput("");
  };

  const saveQuota = async (user: OpsUser) => {
    const parsedGb = parseGbInput(quotaInput);
    if (parsedGb === null) {
      setRowErrors((prev) => ({
        ...prev,
        [user.id]: { message: "GB 단위로 숫자를 입력해주세요. (소수 1자리까지 허용)" },
      }));
      return;
    }

    const quotaBytes = Math.round(parsedGb * BYTES_PER_GB);
    if (quotaBytes > MAX_QUOTA_BYTES) {
      setRowErrors((prev) => ({
        ...prev,
        [user.id]: { message: `최대 ${maxQuotaGb.toFixed(0)}GB 까지만 설정할 수 있습니다.` },
      }));
      return;
    }

    setSavingId(user.id);
    setRowErrors((prev) => ({ ...prev, [user.id]: null }));

    try {
      const response = await apiFetch(routes.api.opsAdmin.storage.quotaUpdate(), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ownerId: user.id, quotaBytes }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        ownerId?: string;
        quotaBytes?: number;
        requestId?: string;
        error?: { message?: string; code?: string };
        hint?: string;
      };

      if (!response.ok || !payload.ok) {
        const message = payload.error?.message ?? "저장하지 못했습니다.";
        const hint = payload.hint ? ` (${payload.hint})` : "";
        setRowErrors((prev) => ({
          ...prev,
          [user.id]: {
            message: `${message}${hint}`,
            requestId: payload.requestId ?? response.headers.get("x-request-id"),
          },
        }));
        return;
      }

      setUsers((prev) =>
        prev.map((item) =>
          item.id === user.id
            ? {
                ...item,
                storage: {
                  ...item.storage,
                  quotaBytes: payload.quotaBytes ?? quotaBytes,
                  updatedAt: new Date().toISOString(),
                },
              }
            : item,
        ),
      );
      setEditingId(null);
      setQuotaInput("");
    } catch (error) {
      const requestId = (error as { requestId?: string }).requestId;
      const message = (error as { message?: string }).message ?? "저장하지 못했습니다.";
      setRowErrors((prev) => ({
        ...prev,
        [user.id]: {
          message,
          requestId,
        },
      }));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Storage</th>
              <th className="px-4 py-3">Quota</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((user) => {
              const isEditing = editingId === user.id;
              const isSaving = savingId === user.id;
              const rowError = rowErrors[user.id];

              return (
                <Fragment key={user.id}>
                  <tr className="align-top">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{user.email ?? "(no email)"}</div>
                      <div className="text-xs text-slate-500">{user.id}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{user.plan.plan}</div>
                      <div className="text-xs text-slate-500">{user.plan.billing_status}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{formatBytes(user.storage.usedBytes)}</div>
                      <div className="text-xs text-slate-500">used</div>
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                            <input
                              type="number"
                              inputMode="decimal"
                              min={0}
                              step={0.1}
                              value={quotaInput}
                              onChange={(event) => setQuotaInput(event.target.value)}
                              className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm text-slate-900"
                            />
                            GB
                          </label>
                          <button
                            type="button"
                            onClick={() => void saveQuota(user)}
                            disabled={isSaving}
                            className={cn(
                              buttonTone("primary", { size: "sm" }),
                              isSaving ? "cursor-not-allowed opacity-60" : "",
                            )}
                          >
                            {isSaving ? "Saving..." : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            disabled={isSaving}
                            className={cn(
                              buttonTone("secondary", { size: "sm" }),
                              isSaving ? "cursor-not-allowed opacity-60" : "",
                            )}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-900">{formatBytes(user.storage.quotaBytes)}</span>
                          <button
                            type="button"
                            onClick={() => beginEdit(user)}
                            className={buttonTone("secondary", { size: "sm" })}
                          >
                            Edit
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                  {rowError ? (
                    <tr className="bg-rose-50/40">
                      <td colSpan={4} className="px-4 py-3 text-sm text-rose-700">
                        <div className="font-semibold">{rowError.message}</div>
                        {rowError.requestId ? (
                          <div className="text-xs text-rose-600">requestId: {rowError.requestId}</div>
                        ) : null}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
            {users.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-500">
                  표시할 사용자가 없습니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
