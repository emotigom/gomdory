"use client";

import { useCallback, useEffect, useState } from "react";

import { buttonTone } from "@/app/_components/uiTokens";
import { formatBytes } from "@/lib/format/bytes";
import { routes } from "@/lib/standards/routes";

type FeatureFlags = {
  webllmEnabled: boolean;
  netsaverEnabled: boolean;
  netsaverMode: "leaseOnly" | "auto";
  netsaverP2pTier: "meta" | "smallShards" | "wasm";
  maxBytes: number;
  updatedAt: string | null;
};

type GatingInfo = {
  effectiveWebllmEnabled: boolean;
  reasons: string[];
  gatingMode: "userOnly" | "pilotAllowlist" | "disabled";
  allowlistDecision: "allowed" | "blocked" | "notApplicable";
  userFlagsPresent: boolean;
  globalWebllmEnabled: boolean;
};

type OpsUser = { id: string; email: string | null; createdAt: string | null };

type SearchResponse = {
  ok?: boolean;
  users?: OpsUser[];
  requestId?: string;
  error?: { message?: string };
};

type EduFlagsResponse = {
  ok?: boolean;
  user?: { id: string; email: string | null };
  featureFlags?: FeatureFlags;
  gating?: GatingInfo;
  requestId?: string;
  error?: { message?: string };
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString("ko-KR");
}

export default function UsersClient({ currentUserId }: { currentUserId: string }) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<OpsUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<OpsUser | null>(null);
  const [flags, setFlags] = useState<FeatureFlags | null>(null);
  const [gating, setGating] = useState<GatingInfo | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setUsers([]);
      setSelectedUser(null);
      setFlags(null);
      setGating(null);
      return;
    }

    setLoading(true);
    try {
      const url = new URL(routes.api.opsAdmin.userSearch(), window.location.origin);
      url.searchParams.set("query", q.trim());
      const response = await fetch(url.toString());
      const payload = (await response.json()) as SearchResponse;
      if (!response.ok || !payload.ok) {
        setUsers([]);
        setMessage(payload.error?.message ?? "검색에 실패했습니다.");
        return;
      }
      setUsers(payload.users ?? []);
      setSelectedUser((payload.users ?? [])[0] ?? null);
      setMessage(null);
    } catch {
      setUsers([]);
      setMessage("검색에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFlags = useCallback(async (userId: string) => {
    try {
      const response = await fetch(routes.api.opsAdmin.userEduFlags(userId));
      const payload = (await response.json()) as EduFlagsResponse;
      if (!response.ok || !payload.ok || !payload.featureFlags || !payload.gating) {
        setFlags(null);
        setGating(null);
        setMessage(payload.error?.message ?? "플래그 조회에 실패했습니다.");
        return;
      }
      setFlags(payload.featureFlags);
      setGating(payload.gating);
      setMessage(null);
    } catch {
      setFlags(null);
      setGating(null);
      setMessage("플래그 조회에 실패했습니다.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadSearch(query), 250);
    return () => window.clearTimeout(timer);
  }, [loadSearch, query]);

  useEffect(() => {
    if (!selectedUser) return;
    void loadFlags(selectedUser.id);
  }, [loadFlags, selectedUser]);

  const applyPreset = () => {
    if (!flags) return;
    setFlags({ ...flags, webllmEnabled: true });
  };

  const saveFlags = async () => {
    if (!selectedUser || !flags) return;
    setSaving(true);
    try {
      const response = await fetch(routes.api.opsAdmin.userEduFlags(selectedUser.id), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          webllmEnabled: flags.webllmEnabled,
          netsaverEnabled: flags.netsaverEnabled,
          netsaverMode: flags.netsaverMode,
          netsaverP2pTier: flags.netsaverEnabled ? flags.netsaverP2pTier : null,
          maxBytes: flags.maxBytes,
        }),
      });
      const payload = (await response.json()) as EduFlagsResponse;
      if (!response.ok || !payload.ok || !payload.featureFlags || !payload.gating) {
        setMessage(payload.error?.message ?? "저장 실패");
        return;
      }
      setFlags(payload.featureFlags);
      setGating(payload.gating);
      setMessage("저장되었습니다.");
    } catch {
      setMessage("저장 실패");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">Edu Feature Flags 관리</h2>
        <p className="text-sm text-slate-500">이메일로 사용자를 검색하고 WebLLM/NetSaver 플래그를 수정하세요.</p>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="email 검색"
          className="w-full max-w-md rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
      </div>

      {loading ? <p className="text-sm text-slate-500">검색 중...</p> : null}

      <div className="flex flex-wrap gap-2">
        {users.map((user) => (
          <button
            key={user.id}
            type="button"
            onClick={() => setSelectedUser(user)}
            className={`rounded-xl border px-3 py-2 text-left text-sm ${
              selectedUser?.id === user.id ? "border-sky-400 bg-sky-50" : "border-slate-200 bg-white"
            }`}
          >
            <p className="font-semibold text-slate-900">{user.email ?? "(no email)"}</p>
            <p className="text-xs text-slate-500">{user.id}</p>
          </button>
        ))}
      </div>

      {selectedUser && flags ? (
        <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-900">{selectedUser.email ?? "(no email)"}</p>
              <p className="text-xs text-slate-500">created: {formatDate(selectedUser.createdAt)}</p>
              {selectedUser.id === currentUserId ? <p className="text-xs font-semibold text-sky-600">내 계정</p> : null}
            </div>
            <button type="button" className={buttonTone("secondary", { size: "sm" })} onClick={applyPreset}>
              Enable WebLLM for this user
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm">
              WebLLM
              <input
                type="checkbox"
                checked={flags.webllmEnabled}
                onChange={(event) => setFlags({ ...flags, webllmEnabled: event.target.checked })}
              />
            </label>
            <label className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm">
              NetSaver
              <input
                type="checkbox"
                checked={flags.netsaverEnabled}
                onChange={(event) => setFlags({ ...flags, netsaverEnabled: event.target.checked })}
              />
            </label>
            <label className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
              mode
              <select
                value={flags.netsaverMode}
                onChange={(event) => setFlags({ ...flags, netsaverMode: event.target.value as FeatureFlags["netsaverMode"] })}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1"
              >
                <option value="leaseOnly">leaseOnly</option>
                <option value="auto">auto</option>
              </select>
            </label>
            <label className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
              tier
              <select
                value={flags.netsaverP2pTier}
                onChange={(event) => setFlags({ ...flags, netsaverP2pTier: event.target.value as FeatureFlags["netsaverP2pTier"] })}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1"
                disabled={!flags.netsaverEnabled}
              >
                <option value="meta">meta</option>
                <option value="smallShards">smallShards</option>
                <option value="wasm">wasm</option>
              </select>
            </label>
            <label className="rounded-xl border border-slate-200 px-3 py-2 text-sm md:col-span-2">
              maxBytes
              <input
                type="number"
                min={1}
                value={flags.maxBytes}
                onChange={(event) => setFlags({ ...flags, maxBytes: Math.max(1, Number(event.target.value) || 1) })}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1"
              />
              <p className="text-xs text-slate-500">{formatBytes(flags.maxBytes)}</p>
            </label>
          </div>

          {gating ? (
            <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
              <p>global env: {String(gating.globalWebllmEnabled)}</p>
              <p>gating mode: {gating.gatingMode}</p>
              <p>allowlist: {gating.allowlistDecision}</p>
              <p>user flags row: {String(gating.userFlagsPresent)}</p>
              <p>effective webllm: {String(gating.effectiveWebllmEnabled)}</p>
              <p>reasons: {gating.reasons.join(", ")}</p>
            </div>
          ) : null}

          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">updatedAt: {formatDate(flags.updatedAt)}</p>
            <button
              type="button"
              onClick={() => void saveFlags()}
              className={buttonTone("primary", { size: "sm", tone: "sky" })}
              disabled={saving}
            >
              {saving ? "저장 중" : "저장"}
            </button>
          </div>
        </div>
      ) : null}

      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
    </section>
  );
}
