"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";

import Image from "next/image";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { buttonTone, cn, hairlineBorderClass, surface } from "@/app/_components/uiTokens";
import { trackMarketingFunnelEvent } from "@/lib/analytics/marketingFunnel";
import { apiFetch } from "@/lib/http/apiFetch";

type DemoLinks = {
  boardId: string;
  shareCode: string;
  studentUrl: string;
  projectorUrl: string;
  remoteUrl: string;
};

type FirstRunQuickstartProps = {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
  onRequestCreateBoard: () => void;
};

type StepState = {
  demoReady: boolean;
  studentViewed: boolean;
  projectorOpened: boolean;
  remoteOpened: boolean;
};

const INITIAL_STEPS: StepState = {
  demoReady: false,
  studentViewed: false,
  projectorOpened: false,
  remoteOpened: false,
};

export function FirstRunQuickstart({ open, onClose, onComplete, onRequestCreateBoard }: FirstRunQuickstartProps) {
  const [expanded, setExpanded] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [links, setLinks] = useState<DemoLinks | null>(null);
  const [steps, setSteps] = useState<StepState>(INITIAL_STEPS);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setExpanded(false);
      setLinks(null);
      setSteps(INITIAL_STEPS);
      setQrDataUrl(null);
      setQrError(null);
      setLoading(false);
      return;
    }
    setError(null);
    setLinks(null);
    setSteps(INITIAL_STEPS);
    setQrDataUrl(null);
    setQrError(null);
    setCopied(false);
    setExpanded(true);
  }, [open]);

  useEffect(() => {
    if (!links?.studentUrl) {
      setQrDataUrl(null);
      setQrError(null);
      return;
    }
    let cancelled = false;
    const generate = async () => {
      try {
        const { toDataURL } = await import("qrcode");
        const dataUrl = await toDataURL(links.studentUrl);
        if (cancelled) return;
        setQrDataUrl(dataUrl);
      } catch (qrGenerationError) {
        if (cancelled) return;
        const message =
          qrGenerationError instanceof Error ? qrGenerationError.message : "QR 코드를 생성하지 못했습니다.";
        setQrError(message);
      }
    };
    void generate();
    return () => {
      cancelled = true;
    };
  }, [links?.studentUrl]);

  useEffect(() => {
    if (steps.demoReady && steps.studentViewed && steps.projectorOpened) {
      trackMarketingFunnelEvent("first_value_path_complete", {
        location: "dashboard_first_run_panel",
        path_id: "demo_to_student_participation",
      });
      onComplete();
      setTimeout(() => setExpanded(false), 600);
    }
  }, [onComplete, steps.demoReady, steps.projectorOpened, steps.studentViewed]);

  const handleStartDemo = async () => {
    trackMarketingFunnelEvent("first_value_start", {
      location: "dashboard_first_run_panel",
      cta_slot: "first_run_demo_start",
      cta_kind: "demo_board_create",
      buyer_intent: "teacher",
      auth_state: "logged_in",
    });
    setLoading(true);
    setError(null);
    setSteps(INITIAL_STEPS);
    setLinks(null);
    setQrDataUrl(null);
    setQrError(null);

    try {
      const response = await apiFetch(apiV1Path("onboarding/demo"), { method: "POST" });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean } & Partial<DemoLinks> & {
        message?: string;
      };

      if (!response.ok || !payload?.ok || !payload.boardId || !payload.studentUrl || !payload.projectorUrl) {
        const message = payload?.message ?? "데모 보드를 준비하지 못했습니다.";
        throw new Error(message);
      }

      const nextLinks: DemoLinks = {
        boardId: payload.boardId,
        shareCode: payload.shareCode ?? "",
        studentUrl: payload.studentUrl,
        projectorUrl: payload.projectorUrl,
        remoteUrl: payload.remoteUrl ?? "",
      };
      setLinks(nextLinks);
      setSteps((prev) => ({ ...prev, demoReady: true }));
    } catch (startError) {
      const message = startError instanceof Error ? startError.message : "데모를 준비하지 못했습니다.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!links?.studentUrl) return;
    try {
      await navigator.clipboard.writeText(links.studentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (copyError) {
      console.error("copy failed", copyError);
      setCopied(false);
    }
  };

  const markStudentViewed = () => {
    trackMarketingFunnelEvent("activation_step_complete", { location: "dashboard_first_run_panel", activation_step: "student_view_open" });
    setSteps((prev) => ({ ...prev, studentViewed: true }));
  };
  const markProjector = () => {
    trackMarketingFunnelEvent("activation_step_complete", { location: "dashboard_first_run_panel", activation_step: "projector_open" });
    setSteps((prev) => ({ ...prev, projectorOpened: true }));
  };
  const markRemote = () => {
    trackMarketingFunnelEvent("activation_step_complete", { location: "dashboard_first_run_panel", activation_step: "remote_open" });
    setSteps((prev) => ({ ...prev, remoteOpened: true }));
  };

  const completedCount = useMemo(
    () => [steps.demoReady, steps.studentViewed, steps.projectorOpened, steps.remoteOpened].filter(Boolean).length,
    [steps.demoReady, steps.projectorOpened, steps.remoteOpened, steps.studentViewed],
  );

  if (!open) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-3xl border border-emerald-200 p-5 shadow-md backdrop-blur",
        hairlineBorderClass,
        "border-emerald-200",
        surface.activation,
      )}
      data-testid="first-run-panel"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">First Run</p>
          <h3 className="text-2xl font-semibold text-emerald-950">1분 시작하기</h3>
          <p className="text-sm text-emerald-800">데모 보드 생성 → 공유 안내 → 프로젝터/리모컨 열기까지 3클릭.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className={buttonTone("secondary", { size: "sm" })}
            data-interactive="true"
          >
            {expanded ? "접기" : "펼치기"}
          </button>
          <button
            type="button"
            onClick={() => {
              trackMarketingFunnelEvent("activation_step_skip", { location: "dashboard_first_run_panel", activation_step: "first_run_panel_close" });
              onClose();
            }}
            className={buttonTone("ghost", { size: "sm", muted: true })}
            data-interactive="true"
          >
            닫기
          </button>
        </div>
      </div>

      {expanded ? (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <StepCard
              step="STEP 1"
              title="데모 수업 열기"
              description="자동으로 보드/공유코드/세션을 준비합니다."
              done={steps.demoReady}
            >
              <button
                type="button"
                onClick={handleStartDemo}
                disabled={loading}
                className={buttonTone("primary", { size: "md", tone: "emerald" })}
                data-testid="start-demo-button"
                data-interactive="true"
              >
                {loading ? "준비 중..." : "데모 보드 만들기"}
              </button>
            </StepCard>
            <StepCard
              step="STEP 2"
              title="학생 접속 안내"
              description="코드/링크/QR을 바로 보여주세요."
              done={steps.studentViewed}
            >
              <button
                type="button"
                onClick={markStudentViewed}
                disabled={!links}
                className={buttonTone("secondary", { size: "md" })}
                data-interactive="true"
              >
                {links ? "학생 안내 보기" : "먼저 데모 실행"}
              </button>
            </StepCard>
            <StepCard
              step="STEP 3"
              title="프로젝터 화면"
              description="HUD/발표 화면을 띄워 바로 시연합니다."
              done={steps.projectorOpened}
            >
              <button
                type="button"
                disabled={!links?.projectorUrl}
                onClick={() => {
                  if (!links?.projectorUrl) return;
                  window.open(links.projectorUrl, "_blank", "noopener,noreferrer");
                  markProjector();
                }}
                className={buttonTone("secondary", { size: "md", muted: true })}
                data-interactive="true"
              >
                프로젝터 열기
              </button>
            </StepCard>
            <StepCard
              step="STEP 4"
              title="리모컨(선택)"
              description="폰에서 바로 슬라이드/HUD 제어."
              done={steps.remoteOpened}
            >
              <button
                type="button"
                disabled={!links?.remoteUrl}
                onClick={() => {
                  if (!links?.remoteUrl) return;
                  window.open(links.remoteUrl, "_blank", "noopener,noreferrer");
                  markRemote();
                }}
                className={buttonTone("ghost", { size: "md", muted: true })}
                data-interactive="true"
              >
                리모컨 열기
              </button>
            </StepCard>
          </div>

          {error ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-semibold">데모 생성이 지연되고 있어요.</p>
              <p className="mt-1">잠시 후 다시 시도하거나 새 보드를 직접 만들어주세요.</p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    trackMarketingFunnelEvent("onboarding_cta_click", {
                      location: "dashboard_first_run_error",
                      cta_slot: "first_run_error_create_board",
                      cta_kind: "create_board",
                      buyer_intent: "teacher",
                      auth_state: "logged_in",
                    });
                    trackMarketingFunnelEvent("first_board_create_click", {
                      location: "dashboard_first_run_error",
                      cta_slot: "first_run_error_create_board",
                    });
                    onRequestCreateBoard();
                  }}
                  className={buttonTone("primary", { size: "sm", tone: "indigo" })}
                  data-interactive="true"
                >
                  새 보드 만들기
                </button>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className={buttonTone("secondary", { size: "sm" })}
                  data-interactive="true"
                >
                  다시 시도
                </button>
              </div>
            </div>
          ) : null}

          {links ? (
            <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/80 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-indigo-900">학생 접속 링크</p>
                  <span className="text-xs font-semibold text-indigo-700">{links.shareCode}</span>
                </div>
                <p className="mt-1 text-sm text-indigo-800">gkrry.com/{links.shareCode}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    readOnly
                    value={links.studentUrl}
                    className="min-h-[44px] flex-1 rounded-xl border border-indigo-100 bg-white px-3 text-sm font-medium text-indigo-900 shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={handleCopy}
                    className={cn(buttonTone("secondary", { size: "sm" }), "min-h-[44px] min-w-[84px]")}
                  >
                    {copied ? "복사됨" : "복사"}
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-indigo-700">
                  <a
                    href={links.studentUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={markStudentViewed}
                    className="font-semibold underline decoration-indigo-300"
                  >
                    학생 화면 미리보기
                  </a>
                  <span aria-hidden="true">•</span>
                  <a
                    href={links.projectorUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={markProjector}
                    className="font-semibold underline decoration-indigo-300"
                  >
                    프로젝터 열기
                  </a>
                  {links.remoteUrl ? (
                    <>
                      <span aria-hidden="true">•</span>
                      <a
                        href={links.remoteUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={markRemote}
                        className="font-semibold underline decoration-indigo-300"
                      >
                        리모컨 열기
                      </a>
                    </>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-indigo-100 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-700">학생 QR</p>
                {qrError ? <p className="text-xs text-rose-600">{qrError}</p> : null}
                {qrDataUrl ? (
                  <Image src={qrDataUrl} alt="학생 링크 QR" width={208} height={208} unoptimized className="h-48 w-48" />
                ) : (
                  <p className="text-xs text-slate-500">QR 코드 생성 중...</p>
                )}
                <p className="text-xs text-slate-500">{links.shareCode}</p>
              </div>
            </div>
          ) : null}

          <div className="flex items-center justify-between rounded-2xl bg-emerald-50/90 px-4 py-3 text-sm font-semibold text-emerald-900 ring-1 ring-emerald-100">
            <span>완료 체크 {completedCount}/4</span>
            <span className="text-xs text-emerald-700">완료 시 자동으로 접힙니다. 다시보기는 언제든 가능합니다.</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StepCard({
  step,
  title,
  description,
  done,
  children,
}: {
  step: string;
  title: string;
  description: string;
  done: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-emerald-50/70 p-4 transition-[border-color,box-shadow,background-color] duration-200",
        done ? "border-emerald-300 bg-emerald-100 shadow-[0_18px_70px_-62px_rgba(5,150,105,0.7)]" : "border-emerald-100",
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">{step}</p>
      <p className="mt-1 text-lg font-semibold text-emerald-950">{title}</p>
      <p className="mt-1 text-xs text-emerald-800">{description}</p>
      <div className="mt-3">{children}</div>
      {done ? (
        <div className="mt-2 text-[12px] font-semibold text-emerald-700" aria-live="polite">
          완료됨
        </div>
      ) : null}
    </div>
  );
}
