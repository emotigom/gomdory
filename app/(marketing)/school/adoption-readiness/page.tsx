import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "도입 문의·견적·계약 준비 현황",
  description: "학교와 기관이 곰도리 도입 문의 전에 확인할 수 있는 공개용 준비 현황 안내입니다.",
  alternates: { canonical: "/school/adoption-readiness" },
};

const reviewMaterials = [
  ["학교 검토 자료", "/school"],
  ["개인정보 처리 항목 안내", "/edu/compliance/privacy-data"],
  ["AI 개인정보 보호 안내", "/legal/ai-privacy"],
  ["보안 문의", "/legal/security"],
  ["학교·에듀집 검토 안내", "/legal/certification-readiness"],
] as const;

const inquiryItems = [
  "기관 유형과 예상 사용 규모",
  "수업 유형과 파일럿 운영 희망 기간",
  "개인정보·보안 검토에서 확인해야 할 항목",
  "게스트 코드 참여와 계정 기반 운영 중 선호 흐름",
  "Google Workspace 또는 로스터 연동 필요 여부",
  "견적·계약·세금계산서·구매 검토 자료 필요 여부",
] as const;

const availableItems = [
  "학교 검토를 위한 공개 안내 페이지",
  "학습지원 소프트웨어 등록 현황 안내",
  "학생 개인정보 최소화 원칙 안내",
  "교사 주도 수업 보드와 게스트 참여 흐름 설명",
  "파일럿과 도입 논의를 위한 공개 문의 경로",
] as const;

const preparingItems = [
  "견적서와 이용 신청서 양식",
  "계약·구매 검토용 공개 자료 패키지",
  "세금계산서와 결제 운영 절차",
  "기관 관리자, 로스터 연동, SSO 등 기관 기능",
  "정식 SLA와 외부 보안 검토 증빙",
] as const;

const schoolTextLinkClass =
  "school-text-link rounded-sm font-semibold underline underline-offset-4 transition-colors focus-visible:outline-none";
const schoolUtilityLinkClass = `${schoolTextLinkClass} inline-flex text-sm font-medium text-slate-200`;
const schoolCtaBaseClass =
  "school-interaction-control inline-flex min-h-11 max-w-full items-center justify-center rounded-lg border px-4 py-2 text-center text-sm font-semibold transition-[background-color,border-color,box-shadow,color,transform] duration-150 ease-out focus-visible:outline-none";
const schoolPrimaryCtaClass = `${schoolCtaBaseClass} school-cta-primary border-cyan-300/30 bg-cyan-950/30 text-cyan-100`;
const schoolSecondaryCtaClass = `${schoolCtaBaseClass} school-cta-secondary border-slate-600 bg-slate-950/50 text-slate-100`;
const schoolReviewLinkClass =
  "school-interaction-control school-link-card min-w-0 rounded-xl border border-cyan-300/25 bg-cyan-950/25 p-4 text-sm font-semibold text-cyan-100 transition-[background-color,border-color,box-shadow,color,transform] duration-150 ease-out focus-visible:outline-none";

export default function AdoptionReadinessPage() {
  return (
    <div data-school-interaction-scope className="bg-[var(--theme-bg)] px-6 py-14 text-slate-100">
      <main className="mx-auto max-w-5xl space-y-8">
        <header className="space-y-4">
          <Link href="/school" className={schoolUtilityLinkClass}>
            ← 학교 검토 자료로 돌아가기
          </Link>
          <p className="text-sm font-semibold text-cyan-200">공개용 도입 문의 안내</p>
          <h1 className="max-w-4xl text-3xl font-bold leading-tight sm:text-4xl">도입 문의·견적·계약 준비 현황</h1>
          <p className="max-w-4xl text-base leading-8 text-slate-200">
            이 페이지는 학교와 기관 담당자가 곰도리 도입 문의 전에 확인할 수 있는 공개용 안내입니다. 조달 승인, 계약 보장, 가격 확정, 견적 확약을 뜻하지 않습니다.
          </p>
          <p className="rounded-xl border border-amber-300/50 bg-amber-950/30 px-4 py-3 text-sm leading-6 text-amber-100">
            도입 문의 단계에서는 학생 실명, 전화번호, 주소, 주민등록번호 같은 학생 개인식별정보를 요청하지 않습니다.
          </p>
        </header>

        <section className="rounded-2xl border border-cyan-300/25 bg-slate-900/70 p-6">
          <h2 className="text-2xl font-semibold text-white">현재 안내 방식</h2>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            학교·기관 도입 문의는 공개된 신뢰·보안·운영 안내를 바탕으로 단계적으로 답변합니다. 공식 전용 문의 채널과 계약 관련 서식은 운영 정책 정비에 맞춰 준비 중입니다.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/contact" className={schoolPrimaryCtaClass}>
              문의하기
            </Link>
            <Link href="/school" className={schoolSecondaryCtaClass}>
              학교 검토 자료 보기
            </Link>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-6">
            <h2 className="text-2xl font-semibold text-white">현재 제공 가능한 것</h2>
            <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-300">
              {availableItems.map((item) => (
                <li key={item} className="rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2">
                  {item}
                </li>
              ))}
            </ul>
          </article>
          <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-6">
            <h2 className="text-2xl font-semibold text-white">준비 중인 것</h2>
            <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-300">
              {preparingItems.map((item) => (
                <li key={item} className="rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2">
                  {item}
                </li>
              ))}
            </ul>
          </article>
        </section>

        <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-6">
          <h2 className="text-2xl font-semibold text-white">문의 시 준비하면 좋은 정보</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {inquiryItems.map((item) => (
              <p key={item} className="rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm text-slate-300">
                {item}
              </p>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-cyan-300/25 bg-slate-900/70 p-6">
          <h2 className="text-2xl font-semibold text-white">함께 볼 공개 자료</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {reviewMaterials.map(([label, href]) => (
              <Link key={href} href={href} className={schoolReviewLinkClass}>
                {label}
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
