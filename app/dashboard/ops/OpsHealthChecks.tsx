"use client";
import { apiV1Path, unsafeApiPath } from "@/lib/standards/pathTypes";

import { useMemo, useState } from "react";

import { apiFetch } from "@/lib/http/apiFetch";

type CheckResult = {
  name: string;
  path: string;
  status: "idle" | "running" | "ok" | "fail";
  ms?: number;
  requestId?: string | null;
  statusCode?: number;
};

const CHECKS = [
  { name: "System Diag", path: apiV1Path("system/diag"), expectOkField: true },
  { name: "Ops Ping", path: apiV1Path("ops/ping"), expectOkField: true },
  { name: "UI Slow (optional)", path: apiV1Path("ops/ui-slow"), expectOkField: false },
];

type HealthCheckPayload = {
  ok?: boolean;
  requestId?: string;
};

function parsePayload(value: unknown): HealthCheckPayload | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  return {
    ok: typeof record.ok === "boolean" ? record.ok : undefined,
    requestId: typeof record.requestId === "string" ? record.requestId : undefined,
  };
}

function statusTone(status: CheckResult["status"]) {
  if (status === "ok") return "text-emerald-700";
  if (status === "fail") return "text-red-600";
  if (status === "running") return "text-amber-600";
  return "text-slate-500";
}

export default function OpsHealthChecks() {
  const initialState = useMemo(
    () =>
      CHECKS.reduce<Record<string, CheckResult>>((acc, check) => {
        acc[check.path] = { name: check.name, path: check.path, status: "idle" };
        return acc;
      }, {}),
    [],
  );
  const [results, setResults] = useState<Record<string, CheckResult>>(initialState);
  const [busy, setBusy] = useState(false);

  const runCheck = async (check: (typeof CHECKS)[number]) => {
    setResults((prev) => ({
      ...prev,
      [check.path]: { ...prev[check.path], status: "running" },
    }));
    const started = performance.now();
    try {
      const response = await apiFetch(unsafeApiPath(check.path), { cache: "no-store" });
      const elapsed = Math.round(performance.now() - started);
      const requestId = response.headers.get("x-request-id");
      const rawPayload = await response.clone().json().catch(() => null);
      const payload = parsePayload(rawPayload);
      const okField = check.expectOkField ? payload?.ok !== false : true;
      const ok = response.ok && okField;
      setResults((prev) => ({
        ...prev,
        [check.path]: {
          ...prev[check.path],
          status: ok ? "ok" : "fail",
          ms: elapsed,
          requestId: requestId ?? payload?.requestId ?? null,
          statusCode: response.status,
        },
      }));
    } catch {
      const elapsed = Math.round(performance.now() - started);
      setResults((prev) => ({
        ...prev,
        [check.path]: {
          ...prev[check.path],
          status: "fail",
          ms: elapsed,
          requestId: null,
        },
      }));
    }
  };

  const runAll = async () => {
    if (busy) return;
    setBusy(true);
    for (const check of CHECKS) {
      await runCheck(check);
    }
    setBusy(false);
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={runAll}
        className="min-h-[44px] rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm"
      >
        Health Check 실행
      </button>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs text-slate-500">
            <tr>
              <th className="py-2">endpoint</th>
              <th className="py-2">status</th>
              <th className="py-2">ms</th>
              <th className="py-2">requestId</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {CHECKS.map((check) => {
              const result = results[check.path];
              return (
                <tr key={check.path}>
                  <td className="py-2 text-slate-700">{check.path}</td>
                  <td className={`py-2 font-semibold ${statusTone(result.status)}`}>
                    {result.status === "idle" ? "대기" : result.status === "running" ? "실행 중" : result.status}
                  </td>
                  <td className="py-2 text-slate-600">
                    {typeof result.ms === "number" ? `${result.ms}ms` : "-"}
                  </td>
                  <td className="py-2 text-sky-700">{result.requestId ?? "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
