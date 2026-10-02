import type { Metadata } from "next";

import { MarketingFaqAccordion } from "../_components/MarketingFaqAccordion";
import { MarketingTrackedLink, MarketingViewTracker } from "../_components/marketingAnalytics";
import {
  commandButtonClass,
  commandDividerClass,
  commandSurfaceClass,
  premiumFocusRingClass,
  subtleSpotlightClass,
} from "../_components/marketingTokens";

const tierCards = [
  {
    name: "Free",
    badge: "먼저 사용해보기",
    status: "무료 시작 가능",
    audience: "개인 교사·소규모 수업",
    summary: "수업 자료 배포와 학생 작품 제출을 바로 시작합니다.",
    ctaHref: "/auth/login?mode=signup",
    ctaLabel: "무료로 수업 열기",
    ctaEvent: "signup_start" as const,
    features: ["학생 로그인 없는 참여", "보드/섹션/카드", "수업 자료 키트", "작품 제출 도우미", "제출 현황"],
  },
  {
    name: "Pro",
    badge: "준비 중",
    status: "Pro 준비 중 / 문의 가능",
    audience: "반복 수업 운영",
    summary: "반복 수업과 더 넓은 저장 공간을 위한 확장 플랜입니다.",
    ctaHref: "/dashboard/billing?intent=demo#upgrade",
    ctaLabel: "개인 Pro 문의",
    ctaEvent: "pricing_plan_select" as const,
    features: ["작품 갤러리", "제출자 활동 도구", "수업 자료 흐름 강화", "반복 운영 지원", "저장 용량 확장 검토"],
  },
  {
    name: "School / Institution",
    badge: "학교 검토",
    status: "학교 도입 문의",
    audience: "학교·기관 담당자",
    summary: "개인정보·보안 자료와 도입 상담을 함께 확인합니다.",
    ctaHref: "/dashboard/billing/institution",
    ctaLabel: "학교 도입 문의",
    ctaEvent: "pricing_plan_select" as const,
    features: ["개인정보 검토 자료", "AI 개인정보 안내", "보안 문의 경로", "접근성 안내", "도입 상담 준비"],
  },
] as const;

const compareRows = [
  { label: "학생 참여", free: "링크/코드로 참여", pro: "반복 수업 흐름 강화", school: "학교 검토 후 운영 범위 협의" },
  { label: "수업 자료", free: "키트와 파일 안내", pro: "자료 흐름 확장", school: "수업 목적에 맞춰 검토" },
  { label: "작품 정리", free: "보드와 제출 현황", pro: "갤러리·활동 도구 강화", school: "운영 정책에 맞춰 안내" },
  { label: "결제 상태", free: "무료 시작", pro: "준비 중 / 문의", school: "견적·계약 절차 준비 중" },
] as const;

const classroomFeatures = ["학생 로그인 없는 참여", "보드/섹션/카드", "수업 자료 키트", "작품 제출 도우미", "제출 현황", "작품 갤러리", "제출자 활동 도구"] as const;
const onboardingSteps = ["개인 교사·소규모 수업에서 먼저 사용", "반복 운영이 필요하면 Pro 문의", "학교는 검토 자료 확인 후 도입 상담"] as const;

const faqs = [
  {
    q: "지금 바로 결제할 수 있나요?",
    a: "Free는 바로 시작할 수 있습니다. Pro와 기관 플랜은 문의 후 진행됩니다.",
  },
  {
    q: "무료로 어떤 수업을 해볼 수 있나요?",
    a: "학생이 링크나 코드로 들어와 자료를 보고, 작품을 카드로 제출하고, 선생님이 제출 현황을 확인하는 기본 수업 흐름을 먼저 확인할 수 있습니다.",
  },
  {
    q: "학생 계정이 필요한가요?",
    a: "학생은 별도 회원가입이나 로그인 없이 참여합니다. 선생님만 수업 생성과 관리를 위해 교사 계정을 사용합니다.",
  },
  {
    q: "학교 도입 검토에는 어떤 자료가 필요한가요?",
    a: "학생 로그인 여부, 개인정보 처리 항목, AI 개인정보 주의 안내, 보안 문의 경로, 접근성 안내를 먼저 확인할 수 있도록 학교 검토 페이지에 연결해 두었습니다.",
  },
] as const;

const pricingCtaBaseClass = `${commandButtonClass} ${premiumFocusRingClass} pricing-cta inline-flex min-w-0 items-center justify-center rounded-md border px-5 py-2 text-center text-sm font-semibold`;
const pricingPrimaryCtaClass = `${pricingCtaBaseClass} pricing-cta-primary border-cyan-200 bg-cyan-200 text-slate-950`;
const pricingSecondaryCtaClass = `${pricingCtaBaseClass} pricing-cta-secondary border-white/30 bg-white/5 text-white`;

export const metadata: Metadata = {
  title: "요금제와 학교 도입",
  description: "개인 교사와 소규모 수업에서 먼저 사용해보고, Pro와 학교 도입은 준비 상태에 맞춰 문의할 수 있는 곰도리 가격 안내입니다.",
  openGraph: {
    title: "곰도리 가격 | 무료 시작과 학교 검토 안내",
    description: "학생 로그인 없는 참여, 수업 자료 키트, 작품 제출, 제출 현황, 갤러리 흐름을 확인하세요.",
  },
};

export default function PricingPage() {
  return (
    <div data-pricing-interaction-scope className="relative isolate overflow-hidden space-y-14 bg-[radial-gradient(circle_at_14%_10%,rgba(56,189,248,0.14),transparent_36%),radial-gradient(circle_at_88%_82%,rgba(37,99,235,0.16),transparent_44%),linear-gradient(180deg,#030712_0%,#061124_46%,#07132a_100%)] px-0 pb-8 pt-2 text-slate-100 sm:space-y-20 sm:pb-12">
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-25 [background-image:linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] [background-size:36px_36px]" aria-hidden />
      <div className="sr-only" data-testid="marketing-pricing-route-public" />
      <div className="sr-only" data-testid="marketing-pricing-public-v1" />
      <MarketingViewTracker eventName="pricing_view" />

      <section className={`${commandDividerClass} ${subtleSpotlightClass("top")} relative overflow-hidden border-y border-cyan-100/15 bg-transparent pb-14 pt-10 sm:pb-18 sm:pt-12`}>
        <div className="relative grid gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
          <div className="space-y-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200">가격과 도입 경로</p>
            <h1 className="text-[clamp(2rem,7vw,4.1rem)] font-semibold leading-[1.04] text-white">무료 수업부터, 필요한 만큼</h1>
            <p className="max-w-2xl text-sm leading-7 text-slate-200 sm:text-base">
              Free는 바로 시작할 수 있습니다. Pro와 기관 플랜은 문의 후 진행됩니다.
            </p>
            <div className="grid gap-2.5 sm:flex sm:flex-wrap">
              <MarketingTrackedLink href="/auth/login?mode=signup" eventName="signup_start" meta={{ location: "pricing_hero", cta_slot: "pricing_primary", cta_kind: "signup", buyer_intent: "teacher", auth_state: "logged_out" }} className={`${pricingPrimaryCtaClass} min-h-[56px] w-full sm:w-auto`}>
                무료로 수업 열기
              </MarketingTrackedLink>
              <MarketingTrackedLink href="/school" eventName="pricing_plan_select" meta={{ location: "pricing_hero", cta_slot: "pricing_secondary", cta_kind: "school_review", buyer_intent: "institution", auth_state: "logged_out" }} className={`${pricingSecondaryCtaClass} min-h-[56px] w-full sm:w-auto`}>
                학교 검토 자료 보기
              </MarketingTrackedLink>
            </div>
          </div>
          <article className="rounded-xl border border-cyan-100/25 bg-slate-950/50 p-5 backdrop-blur">
            <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-200">도입 흐름</p>
            <ol className="mt-3 space-y-2.5 text-sm text-slate-100">
              {onboardingSteps.map((step, index) => (
                <li key={step}>
                  <span className="mr-2 font-semibold text-cyan-200">0{index + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          </article>
        </div>
      </section>

      <section className="space-y-6" aria-label="핵심 플랜 구조">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-200/90">플랜 안내</p>
          <h2 className="text-[clamp(1.55rem,5.2vw,2.55rem)] font-semibold leading-[1.12] text-white">지금 필요한 수업 범위부터 선택하세요</h2>
          <p className="text-sm text-slate-300">무료 수업부터 Pro·기관 도입까지 한눈에 비교하세요.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {tierCards.map((tier) => (
            <article key={tier.name} className={`space-y-3 rounded-xl border p-5 backdrop-blur ${tier.name === "Free" ? "border-cyan-200/50 bg-cyan-200/10" : "border-white/20 bg-slate-950/55"}`}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xl font-semibold text-white">{tier.name}</h3>
                <span className="rounded-full border border-cyan-100/35 bg-cyan-200/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-100">{tier.badge}</span>
              </div>
              <p className="text-sm text-cyan-100">{tier.status}</p>
              <p className="text-sm text-slate-200">{tier.audience}</p>
              <p className="rounded-md border border-white/15 bg-slate-900/70 px-3 py-2 text-sm text-slate-100">{tier.summary}</p>
              <ul className="space-y-1.5 text-sm text-slate-200">
                {tier.features.map((feature) => (
                  <li key={feature}>• {feature}</li>
                ))}
              </ul>
              <MarketingTrackedLink href={tier.ctaHref} eventName={tier.ctaEvent} meta={{
                plan: tier.name,
                location: "pricing_scene_main",
                cta_slot: `pricing_scene_${tier.name.toLowerCase().replaceAll(" / ", "_")}`,
                cta_kind: tier.name === "Free" ? "signup" : tier.name === "Pro" ? "pro_inquiry" : "institution_inquiry",
                buyer_intent: tier.name === "School / Institution" ? "institution" : "teacher",
                auth_state: "logged_out",
              }} className={`${tier.name === "Free" ? pricingPrimaryCtaClass : pricingSecondaryCtaClass} min-h-[54px] w-full px-4`}>
                {tier.ctaLabel}
              </MarketingTrackedLink>
            </article>
          ))}
        </div>
      </section>

      <section className={`${commandSurfaceClass} space-y-4 border border-white/15 bg-slate-950/50 p-4 sm:p-6`}>
        <h2 className="text-2xl font-semibold tracking-tight text-white">실제 기능 중심으로 보기</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {classroomFeatures.map((feature) => (
            <span key={feature} className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100">
              {feature}
            </span>
          ))}
        </div>
      </section>

      <section className={`${commandSurfaceClass} space-y-3 border border-white/15 bg-slate-950/50 p-4 sm:p-6`}>
        <h2 className="text-2xl font-semibold tracking-tight text-white">한눈에 비교하기</h2>
        <p className="text-sm text-slate-300">수업 규모에 맞는 플랜을 확인하세요.</p>
        <div className="overflow-x-auto rounded-lg border border-white/15 bg-white/5">
          <table className="min-w-[680px] w-full text-left text-sm text-slate-100">
            <thead className="border-b border-white/15 bg-white/10">
              <tr><th className="px-4 py-3 font-semibold">항목</th><th className="px-4 py-3 font-semibold">Free</th><th className="px-4 py-3 font-semibold">Pro</th><th className="px-4 py-3 font-semibold">School / Institution</th></tr>
            </thead>
            <tbody>
              {compareRows.map((row) => <tr key={row.label} className="border-b border-white/10 align-top"><td className="px-4 py-3.5 font-semibold text-white">{row.label}</td><td className="px-4 py-3.5 text-slate-200">{row.free}</td><td className="px-4 py-3.5 text-slate-200">{row.pro}</td><td className="px-4 py-3.5 text-slate-200">{row.school}</td></tr>)}
            </tbody>
          </table>
        </div>
      </section>

      <section className={`${commandDividerClass} relative overflow-hidden rounded-xl border border-cyan-100/20 bg-slate-950/60 p-5 sm:p-7`}>
        <div className="grid gap-4 lg:grid-cols-[1.04fr_0.96fr] lg:items-center">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight text-white">먼저 무료로 시작하세요.</h2>
          </div>
          <div className="grid gap-2.5 sm:flex sm:flex-wrap sm:justify-end">
            <MarketingTrackedLink href="/auth/login?mode=signup" eventName="signup_start" meta={{ location: "pricing_final_cta", cta_slot: "final_primary", cta_kind: "signup", buyer_intent: "teacher", auth_state: "logged_out" }} className={`${pricingPrimaryCtaClass} min-h-[52px] w-full sm:w-auto`}>무료로 수업 열기</MarketingTrackedLink>
            <MarketingTrackedLink href="/dashboard/billing?intent=demo#upgrade" eventName="pricing_plan_select" meta={{ plan: "pro", location: "pricing_final_cta", cta_slot: "final_mid", cta_kind: "pro_inquiry", buyer_intent: "teacher", auth_state: "logged_out" }} className={`${pricingSecondaryCtaClass} min-h-[52px] w-full sm:w-auto`}>개인 Pro 문의</MarketingTrackedLink>
            <MarketingTrackedLink href="/dashboard/billing/institution" eventName="pricing_plan_select" meta={{ plan: "school_or_pro", location: "pricing_final_cta", cta_slot: "final_secondary", cta_kind: "institution_inquiry", buyer_intent: "institution", auth_state: "logged_out" }} className={`${pricingSecondaryCtaClass} min-h-[52px] w-full sm:w-auto`}>학교 도입 문의</MarketingTrackedLink>
          </div>
        </div>
      </section>

      <section className="space-y-3" aria-label="FAQ">
        <h2 className="text-2xl font-semibold tracking-tight text-white">가격/도입 FAQ</h2>
        <MarketingFaqAccordion items={faqs} location="pricing" />
      </section>
    </div>
  );
}
