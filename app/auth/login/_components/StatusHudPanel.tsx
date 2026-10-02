"use client";

import { useEffect, useMemo, useState } from "react";

import { statusLabel, statusTone } from "@/lib/status/statusFormatting";
import type { ServiceStatusItem, StatusSnapshot } from "@/lib/status/statusTypes";
import { HUD_STATUS_ASSETS } from "@/lib/theme/hudStatusAssets";

const POLL_INTERVAL_MS = 60_000;

const publicServiceLabel = (service: ServiceStatusItem) => {
  const source = `${service.id} ${service.label}`.toLowerCase();
  if (source.includes("auth")) return "로그인";
  if (source.includes("database")) return "수업 데이터";
  if (source.includes("api")) return "보드 연결";
  return "서비스 연결";
};

export default function StatusHudPanel() {
  const [snapshot, setSnapshot] = useState<StatusSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hideShellPanel, setHideShellPanel] = useState(false);

  useEffect(() => {
    let active = true;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const load = async () => {
      try {
        const response = await fetch("/api/status/summary", { cache: "no-store" });
        if (!response.ok) throw new Error("status fetch failed");
        const payload = (await response.json()) as StatusSnapshot;
        if (active) setSnapshot(payload);
      } catch {
        if (active) {
          setSnapshot(null);
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void load();
    intervalId = setInterval(() => void load(), POLL_INTERVAL_MS);

    return () => {
      active = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  const stamp = useMemo(() => {
    const source = snapshot?.updatedAt;
    if (!source) return "확인 대기";
    const formatted = new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(source));
    return `${formatted} 갱신`;
  }, [snapshot?.updatedAt]);

  const coreServices = useMemo(
    () => (snapshot?.services ?? []).filter((service) => service.role !== "external"),
    [snapshot?.services],
  );
  const hasCoreIssue = coreServices.some((service) => service.level !== "operational");

  const renderServiceRows = (services: ServiceStatusItem[]) =>
    services.map((service) => (
      <div key={service.id} className="hud-status-service-row">
        <span>{publicServiceLabel(service)}</span>
        <span className={`hud-status-pill tone-${statusTone(service.level)}`}>{statusLabel(service.level)}</span>
      </div>
    ));

  return (
    <section className="hud-status-panel" aria-live="polite">
      <div className="hud-status-panel__frame">
        <div className="hud-status-panel__bg" aria-hidden>
          {hideShellPanel ? null : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={HUD_STATUS_ASSETS.shellPanel}
              alt=""
              aria-hidden="true"
              loading="lazy"
              decoding="async"
              draggable={false}
              onError={() => setHideShellPanel(true)}
              className="h-full w-full object-cover pointer-events-none select-none"
            />
          )}
        </div>
        <div className="hud-status-panel__content">
          <header className="hud-status-panel__header">
            <p className="hud-status-panel__eyebrow">CONNECTION CHECK / 연결 점검표</p>
            <h2 className="hud-status-panel__title">{snapshot?.headline ?? "연결 상태 확인 중"}</h2>
            <p className="hud-status-panel__stamp">
              {isLoading ? "연결 상태를 확인하고 있습니다." : "로그인 준비 상태를 확인했습니다."}
            </p>
            {snapshot ? <p className="hud-status-panel__stamp">{stamp}</p> : null}
          </header>

          {isLoading ? (
            <div className="hud-status-skeleton" aria-label="상태 불러오는 중" />
          ) : (
            <>
              <div className="space-y-2">
                <p className="hud-status-section-label">로그인 서비스</p>
                {renderServiceRows(coreServices)}
              </div>

              <div className="hud-status-incidents mt-4">
                <p>{hasCoreIssue ? "로그인이 원활하지 않으면 잠시 후 다시 시도해 주세요." : "로그인 준비가 완료되었습니다."}</p>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
