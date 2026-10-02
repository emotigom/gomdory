"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { buttonTone, cn, hairlineBorderClass, surface } from "@/app/_components/uiTokens";
import { trackMarketingFunnelEvent } from "@/lib/analytics/marketingFunnel";
import { setGuidedPathSelection } from "@/lib/dashboard/guidedPath";

const RECOMMENDATION_DISMISS_KEY = "gomdori:dashboard:activation-recommendation-dismissed:v1";

export function EmptyDashboardState({
  onCreate,
  showDemoCta = false,
}: {
  onCreate: () => void;
  showDemoCta?: boolean;
}) {
  const [recommendationDismissed, setRecommendationDismissed] = useState(false);

  useEffect(() => {
    try {
      setRecommendationDismissed(window.localStorage.getItem(RECOMMENDATION_DISMISS_KEY) === "1");
    } catch {
      setRecommendationDismissed(false);
    }
  }, []);

  useEffect(() => {
    const options = ["blank_board", "template_start", "first_lesson", "student_participation", "pro_evaluation", "institution_adoption"];
    options.forEach((optionId) => {
      trackMarketingFunnelEvent("guided_start_option_view", {
        location: "dashboard_empty_state",
        option_id: optionId,
      });
    });
  }, []);

  const dismissRecommendation = () => {
    trackMarketingFunnelEvent("activation_recommendation_dismissed", {
      location: "dashboard_empty_state",
      component: "guided_start_recommendation",
    });
    try {
      window.localStorage.setItem(RECOMMENDATION_DISMISS_KEY, "1");
    } catch {
      // ignore storage errors
    }
    setRecommendationDismissed(true);
  };

  const trackPathSelection = (optionId: string, destination: string) => {
    if (optionId === "blank_board" || optionId === "template_start" || optionId === "first_lesson") {
      setGuidedPathSelection(optionId, "dashboard_empty_state");
      trackMarketingFunnelEvent("guided_path_next_click", {
        path_id: optionId,
        location: "dashboard_empty_state",
        step_id: "path_entry",
        next_action: destination,
      });
    }
    trackMarketingFunnelEvent("guided_start_option_click", {
      location: "dashboard_empty_state",
      option_id: optionId,
      destination,
    });
    trackMarketingFunnelEvent("recommended_path_selected", {
      location: "dashboard_empty_state",
      option_id: optionId,
      destination,
    });
  };

  return (
    <div
      className={cn(
        "rounded-[36px] p-7 backdrop-blur",
        hairlineBorderClass,
        surface.command,
      )}
      data-empty-dashboard
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-indigo-700">첫 수업까지 가장 빠른 경로</p>
          <h2 className="text-2xl font-bold text-slate-900">보드 생성 → 공유 → 참여 시작</h2>
          <p className="text-sm text-slate-600">랜딩/가격 페이지에서 약속한 “빠른 첫 수업”을 대시보드에서 그대로 이어갑니다.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              trackMarketingFunnelEvent("empty_state_primary_click", {
                location: "dashboard_empty_state",
                cta_slot: "empty_primary_create_board",
                cta_kind: "create_board",
                buyer_intent: "teacher",
                auth_state: "logged_in",
              });
              trackMarketingFunnelEvent("first_board_create_click", {
                location: "dashboard_empty_state",
                cta_slot: "empty_primary_create_board",
                buyer_intent: "teacher",
                auth_state: "logged_in",
              });
              onCreate();
            }}
            aria-label="새 보드 만들기"
            className={buttonTone("primary", { size: "lg", tone: "indigo" })}
          >
            새 보드 만들기
          </button>
          <Link
            href="/dashboard/first-lesson"
            onClick={() =>
              trackMarketingFunnelEvent("onboarding_cta_click", {
                location: "dashboard_empty_state",
                cta_slot: "empty_secondary_first_lesson",
                cta_kind: "onboarding",
                buyer_intent: "teacher",
                auth_state: "logged_in",
              })
            }
            aria-label="첫 수업 60초"
            data-interactive="true"
            className={buttonTone("secondary", { size: "lg" })}
          >
            첫 수업 60초
          </Link>
          {showDemoCta ? (
            <Link
              href="/demo/gallery"
              aria-label="데모 갤러리 보기"
              data-interactive="true"
              className={buttonTone("secondary", { size: "lg" })}
            >
              데모 보기
            </Link>
          ) : null}
        </div>
      </div>

      <ol className="mt-6 grid gap-4 md:grid-cols-3">
        <li className="flex gap-3 rounded-2xl bg-indigo-50/90 px-4 py-3 ring-1 ring-indigo-100 shadow-[0_20px_80px_-70px_rgba(79,70,229,0.7)]">
          <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">1</span>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-indigo-900">보드 만들기</p>
            <p className="text-sm text-indigo-800">Primary 버튼을 눌러 첫 보드를 생성합니다.</p>
            <button
              type="button"
              onClick={() => {
                trackMarketingFunnelEvent("first_value_start", {
                  location: "dashboard_empty_state",
                  cta_slot: "empty_step_1",
                  cta_kind: "create_board",
                  buyer_intent: "teacher",
                  auth_state: "logged_in",
                });
                trackMarketingFunnelEvent("activation_step_complete", {
                  location: "dashboard_empty_state",
                  activation_step: "first_board_create_click",
                });
                onCreate();
              }}
              aria-label="새 보드 만들기"
              className={buttonTone("primary", { size: "md", tone: "emerald" })}
            >
              새 보드 만들기
            </button>
          </div>
        </li>
        <li className="flex gap-3 rounded-2xl bg-white/90 px-4 py-3 ring-1 ring-slate-200">
          <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-white">2</span>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-900">공유코드 확인</p>
            <p className="text-sm text-slate-700">보드 생성 후 자동으로 공유코드가 생깁니다.</p>
            <p className="text-xs font-semibold text-slate-500">보드가 생성되면 여기서 바로 확인할 수 있어요.</p>
          </div>
        </li>
        <li className="flex gap-3 rounded-2xl bg-white/90 px-4 py-3 ring-1 ring-slate-200">
          <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-white">3</span>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-900">학생 화면 확인</p>
            <p className="text-sm text-slate-700">보드 생성 후 사용 가능</p>
            <p className="text-xs font-semibold text-slate-500">생성 후 상단 도구에서 바로 열 수 있습니다.</p>
          </div>
        </li>
      </ol>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">추천: 30초 시작</p>
          <p className="mt-1 text-sm font-semibold text-emerald-900">지금 보드를 하나 만들고 공유코드를 확인하세요.</p>
          <p className="text-xs text-emerald-800">첫 “학생 참여 화면 열기”까지 이어지면 실제 수업 전환 준비가 끝납니다.</p>
        </div>
        <Link
          href="/dashboard/templates"
          className={buttonTone("secondary", { size: "lg" })}
          onClick={() =>
            trackMarketingFunnelEvent("first_template_use_click", {
              location: "dashboard_empty_state",
              cta_slot: "empty_template_path",
              cta_kind: "template_gallery",
              buyer_intent: "teacher",
              auth_state: "logged_in",
            })
          }
        >
          템플릿으로 바로 시작
        </Link>
      </div>
      {!recommendationDismissed ? (
        <section className="mt-4 rounded-3xl border border-slate-200/90 bg-white/90 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Guided Start</p>
              <h3 className="text-base font-semibold text-slate-900">처음이라면 이렇게 시작하세요</h3>
              <p className="text-sm text-slate-600">한 번에 하나만 고르세요. 선택한 경로에 맞춰 바로 다음 행동으로 이어집니다.</p>
            </div>
            <button
              type="button"
              onClick={dismissRecommendation}
              className={buttonTone("ghost", { size: "sm", muted: true })}
              data-interactive="true"
            >
              닫기
            </button>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <button
              type="button"
              onClick={() => {
                trackPathSelection("blank_board", "create_board");
                onCreate();
              }}
              className="rounded-xl border border-emerald-200 bg-emerald-50/90 px-3 py-3 text-left shadow-[0_16px_70px_-62px_rgba(5,150,105,0.7)]"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700">추천 1</p>
              <p className="mt-1 text-sm font-semibold text-emerald-900">빈 보드로 바로 시작</p>
              <p className="mt-1 text-xs text-emerald-800">직접 구성이 빠른 수업에 적합 · 결과: 즉시 공유코드 생성</p>
            </button>
            <Link
              href="/dashboard/templates"
              onClick={() => trackPathSelection("template_start", "templates")}
              className="rounded-xl border border-indigo-200 bg-indigo-50/80 px-3 py-3 shadow-[0_16px_70px_-62px_rgba(79,70,229,0.62)]"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-indigo-700">가장 빠른 시작</p>
              <p className="mt-1 text-sm font-semibold text-indigo-900">템플릿으로 수업 준비</p>
              <p className="mt-1 text-xs text-indigo-800">구조를 바로 가져와 수정만 진행 · 결과: 준비 시간 단축</p>
            </Link>
            <Link
              href="/dashboard/first-lesson"
              onClick={() => trackPathSelection("first_lesson", "first_lesson")}
              className="rounded-xl border border-sky-200 bg-sky-50/80 px-3 py-3"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-700">첫 수업 흐름</p>
              <p className="mt-1 text-sm font-semibold text-sky-900">첫 수업 가이드로 진행</p>
              <p className="mt-1 text-xs text-sky-800">순서대로 따라가며 시작 · 결과: 참여 확인까지 연결</p>
            </Link>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            <Link
              href="/dashboard/first-lesson"
              onClick={() => trackPathSelection("student_participation", "first_lesson")}
              className={cn(buttonTone("secondary", { size: "sm" }), "justify-start")}
            >
              학생 참여까지 이어가려면
            </Link>
            <Link
              href="/dashboard/billing?intent=demo#upgrade"
              onClick={() => trackPathSelection("pro_evaluation", "billing_pro")}
              className={cn(buttonTone("secondary", { size: "sm" }), "justify-start")}
            >
              반복 수업이 많다면 Pro 검토
            </Link>
            <Link
              href="/dashboard/billing/institution"
              onClick={() => trackPathSelection("institution_adoption", "institution_billing")}
              className={cn(buttonTone("secondary", { size: "sm" }), "justify-start")}
            >
              여러 교사가 함께 쓰려면 기관 도입
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
