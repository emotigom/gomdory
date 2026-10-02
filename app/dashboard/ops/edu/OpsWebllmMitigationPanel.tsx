"use client";

import { useMemo, useState } from "react";

type EnvRow = {
  key: string;
  present: boolean;
};

type EffectiveState = {
  hardDisable: boolean;
  enabled: boolean;
  labs: boolean;
  prefetch: boolean;
};

type OpsWebllmMitigationPanelProps = {
  envRows: EnvRow[];
  effective: EffectiveState;
  runtimeCanMutate: boolean;
};

const trueValues = ["1", "true", "yes", "on"] as const;

function toEnvLine(key: string, nextValue: boolean) {
  return `${key}=${nextValue ? "true" : "false"}`;
}

export default function OpsWebllmMitigationPanel({ envRows, effective, runtimeCanMutate }: OpsWebllmMitigationPanelProps) {
  const [targetDisable, setTargetDisable] = useState<boolean>(effective.hardDisable);
  const [copied, setCopied] = useState(false);

  const copyText = useMemo(() => {
    const value = targetDisable ? "true" : "false";
    return [
      "# WebLLM hard disable (ops emergency toggle)",
      toEnvLine("EDU_WEBLLM_HARD_DISABLE", targetDisable),
      toEnvLine("NEXT_PUBLIC_EDU_WEBLLM_HARD_DISABLE", targetDisable),
      "# redeploy or restart runtime to apply",
      `# accepted true values: ${trueValues.join(", ")}`,
      `# current effective hardDisable=${String(effective.hardDisable)}`,
      `# requested hardDisable=${value}`,
    ].join("\n");
  }, [effective.hardDisable, targetDisable]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="dashboard-ops-card rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">WebLLM one-click mitigation</h2>
          <p className="text-sm text-slate-500">문제 발생 시 3-step 복구 첫 단계로 hard disable을 빠르게 적용합니다.</p>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
          admin only
        </span>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="dashboard-ops-card space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-700">EDU_WEBLLM_HARD_DISABLE</p>
            <label className="dashboard-ops-control inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700">
              <input
                type="checkbox"
                className="dashboard-ops-input h-4 w-4"
                checked={targetDisable}
                onChange={(event) => setTargetDisable(event.target.checked)}
              />
              {targetDisable ? "ON (disable)" : "OFF (enable)"}
            </label>
          </div>

          <p className="text-xs text-slate-500">현재 실효값: {String(effective.hardDisable)} · 요청값: {String(targetDisable)}</p>

          {runtimeCanMutate ? (
            <p className="text-xs text-emerald-700">런타임 변경 지원 환경입니다. 바로 토글 적용 API를 연결하세요.</p>
          ) : (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <p className="font-semibold">현재 런타임은 env mutation을 지원하지 않습니다.</p>
              <p className="mt-1">아래 값을 배포 환경 변수에 반영한 뒤 재배포/재시작 하세요.</p>
            </div>
          )}

          <div className="rounded-md border border-slate-200 bg-white p-3">
            <p className="mb-2 text-xs font-semibold text-slate-600">Copyable mitigation text</p>
            <pre className="overflow-x-auto whitespace-pre-wrap text-[11px] leading-relaxed text-slate-700">{copyText}</pre>
            <button
              type="button"
              onClick={handleCopy}
              className="dashboard-ops-control mt-2 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <h3 className="text-sm font-semibold text-slate-800">Effective values (env names only)</h3>
          <div className="mt-2 space-y-1 text-xs text-slate-700">
            <p>NEXT_PUBLIC_EDU_WEBLLM_ENABLE: {String(effective.enabled)}</p>
            <p>NEXT_PUBLIC_EDU_WEBLLM_LABS: {String(effective.labs)}</p>
            <p>NEXT_PUBLIC_EDU_WEBLLM_PREFETCH: {String(effective.prefetch)}</p>
            <p>EDU_WEBLLM_HARD_DISABLE: {String(effective.hardDisable)}</p>
          </div>

          <div className="mt-3 rounded-md border border-slate-200 bg-white p-2">
            <p className="text-xs font-semibold text-slate-700">Key envs presence</p>
            <ul className="mt-1 space-y-1 text-[11px] text-slate-600">
              {envRows.map((row) => (
                <li key={row.key} className="dashboard-ops-row flex items-center justify-between gap-2 rounded border border-transparent px-1 py-0.5">
                  <span className="min-w-0 truncate font-mono">{row.key}</span>
                  <span>{row.present ? "present" : "missing"}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
