"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { buttonTone, cn, hairlineBorderClass, surface } from "@/app/_components/uiTokens";
import { trackMarketingFunnelEvent } from "@/lib/analytics/marketingFunnel";
import { setGuidedPathSelection } from "@/lib/dashboard/guidedPath";

const DISMISS_KEY = "gomdori:dashboard:onboarding:dismissed:v1";

type OnboardingGuideBannerProps = {
  onCreate: () => void;
  dismissed: boolean;
  onDismiss: () => void;
};

export function useOnboardingGuideState() {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(DISMISS_KEY);
      setDismissed(stored === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore storage errors
    }
    setDismissed(true);
  };

  const reset = () => {
    try {
      window.localStorage.removeItem(DISMISS_KEY);
    } catch {
      // ignore storage errors
    }
    setDismissed(false);
  };

  return { dismissed, dismiss, reset } as const;
}

export function OnboardingGuideBanner({ onCreate, dismissed, onDismiss }: OnboardingGuideBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const trackRecommendedAction = (optionId: string, destination: string) => {
    if (optionId === "blank_board" || optionId === "template_start" || optionId === "first_lesson") {
      setGuidedPathSelection(optionId, "dashboard_onboarding_banner");
      trackMarketingFunnelEvent("guided_path_next_click", {
        path_id: optionId,
        location: "dashboard_onboarding_banner",
        step_id: "path_entry",
        next_action: destination,
      });
    }
    trackMarketingFunnelEvent("guided_start_option_click", {
      location: "dashboard_onboarding_banner",
      option_id: optionId,
      destination,
    });
    trackMarketingFunnelEvent("recommended_path_selected", {
      location: "dashboard_onboarding_banner",
      option_id: optionId,
      destination,
    });
  };

  useEffect(() => {
    if (!expanded) return;
    trackMarketingFunnelEvent("guided_path_step_view", {
      location: "dashboard_onboarding_banner",
      step_id: "guided_paths_expanded",
      path_id: "all",
    });
  }, [expanded]);

  if (dismissed) {
    return null;
  }

  return (
    <div
      className={cn(
        "mt-3 rounded-2xl p-4 text-indigo-900 backdrop-blur",
        hairlineBorderClass,
        "border-indigo-100",
        surface.activation,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold">30초 시작 가이드</p>
          <p className="text-sm text-indigo-800">보드 만들기 → 공유 코드 확인 → 발표/HUD 또는 리모컨 열기 → 첫 참여 확인</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className={buttonTone("secondary", { size: "sm" })}
            data-interactive="true"
          >
            {expanded ? "간단히" : "자세히"}
          </button>
          <button
            type="button"
            onClick={() => {
              trackMarketingFunnelEvent("activation_step_skip", {
                location: "dashboard_onboarding_banner",
                activation_step: "guide_banner_dismiss",
              });
              onDismiss();
            }}
            className={buttonTone("ghost", { size: "sm", muted: true })}
            data-interactive="true"
          >
            닫기
          </button>
        </div>
      </div>
      {expanded ? (
        <div className="mt-3 space-y-3">
          <div className="grid gap-2 rounded-xl border border-indigo-100 bg-white/90 p-3 md:grid-cols-3">
            <button
              type="button"
              onClick={() => {
                trackRecommendedAction("blank_board", "create_board");
                onCreate();
              }}
              className={cn(buttonTone("primary", { size: "sm", tone: "indigo" }), "justify-center")}
              data-interactive="true"
            >
              추천 경로: 빈 보드 시작
            </button>
            <Link
              href="/dashboard/templates"
              onClick={() => trackRecommendedAction("template_start", "templates")}
              className={cn(buttonTone("secondary", { size: "sm" }), "justify-center")}
              data-interactive="true"
            >
              가장 빠른 시작: 템플릿
            </Link>
            <Link
              href="/dashboard/first-lesson"
              onClick={() => trackRecommendedAction("first_lesson", "first_lesson")}
              className={cn(buttonTone("secondary", { size: "sm" }), "justify-center")}
              data-interactive="true"
            >
              첫 수업 흐름 따라가기
            </Link>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl bg-white/90 p-3 ring-1 ring-cyan-100">
              <p className="text-xs font-semibold text-indigo-800">1. 보드 만들기</p>
              <p className="text-sm text-indigo-900">새 보드 만들기를 눌러 제목 입력 후 Enter 또는 Ctrl/Cmd + Enter로 제출하세요.</p>
            </div>
            <div className="rounded-xl bg-white/90 p-3 ring-1 ring-cyan-100">
              <p className="text-xs font-semibold text-indigo-800">2. 공유코드 확인</p>
              <p className="text-sm text-indigo-900">보드 생성 후 자동으로 공유코드가 발급됩니다. 필요 시 QR로 바로 안내하세요.</p>
            </div>
            <div className="rounded-xl bg-white/90 p-3 ring-1 ring-cyan-100">
              <p className="text-xs font-semibold text-indigo-800">3. 발표/HUD 또는 리모컨</p>
              <p className="text-sm text-indigo-900">Clean/Focus 모드에서 발표/HUD 혹은 리모컨을 열어 진행을 시작하세요. 첫 참여 확인이 “시작 완료”입니다.</p>
              <button
                type="button"
                onClick={() => {
                  trackRecommendedAction("blank_board", "create_board");
                  trackMarketingFunnelEvent("onboarding_cta_click", {
                    location: "dashboard_onboarding_banner",
                    cta_slot: "onboarding_banner_step3_create",
                    cta_kind: "create_board",
                    buyer_intent: "teacher",
                    auth_state: "logged_in",
                  });
                  trackMarketingFunnelEvent("first_board_create_click", {
                    location: "dashboard_onboarding_banner",
                    cta_slot: "onboarding_banner_step3_create",
                    buyer_intent: "teacher",
                    auth_state: "logged_in",
                  });
                  onCreate();
                }}
                className={buttonTone("primary", { size: "sm", tone: "indigo" })}
                data-interactive="true"
                data-testid="onboarding-guide-create-board"
              >
                새 보드 만들기
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
