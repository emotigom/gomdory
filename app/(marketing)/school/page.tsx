import type { Metadata } from "next";
import Link from "next/link";
import { registrationCaution } from "@/lib/trust/registrationStatus";

export const metadata: Metadata = {
  title: "학교 검토 자료",
  description: "학교 담당자와 정보부장이 곰도리 수업 운영, 학생 로그인, 개인정보, AI 개인정보, 보안 문의 자료를 확인할 수 있는 안내입니다.",
  alternates: { canonical: "/school" },
};

const questionCards = [
  {
    q: "학생 로그인이 필요한가요?",
    a: "학생은 별도 회원가입이나 로그인 없이 링크 또는 코드로 참여합니다. 교사만 계정으로 수업을 만들고 관리합니다.",
  },
  {
    q: "어떤 개인정보를 다루나요?",
    a: "학생 이메일, 구글 계정, 전화번호를 기본적으로 요구하지 않고 닉네임과 수업 결과물 중심으로 운영합니다. 자세한 항목은 개인정보 처리 항목 안내에서 확인할 수 있습니다.",
  },
  {
    q: "AI 서비스에 개인정보를 입력해도 되나요?",
    a: "학생이 생성형 AI에 실명, 연락처, 학교명 등 직접 식별 정보를 입력하지 않도록 지도하는 안내를 유지합니다.",
  },
  {
    q: "수업 자료와 학생 작품은 어떻게 관리되나요?",
    a: "교사가 수업 보드와 자료 키트를 준비하고, 학생 작품은 카드·제출 현황·작품 갤러리 흐름으로 확인합니다.",
  },
  {
    q: "보안 문의는 어디로 하나요?",
    a: "보안 관련 문의와 취약점 제보 경로는 보안 안내 페이지와 운영자 연락처를 통해 확인할 수 있습니다.",
  },
] as const;

const reviewLinks = [
  ["개인정보처리방침", "/legal/privacy"],
  ["개인정보 처리 항목 안내", "/edu/compliance/privacy-data"],
  ["AI 개인정보 보호 안내", "/legal/ai-privacy"],
  ["아동·청소년 보호 안내", "/legal/child-safety"],
  ["보안 문의", "/legal/security"],
  ["접근성 안내", "/legal/accessibility"],
  ["학습지원 SW 기준 안내", "/edu/compliance/learning-support-software"],
  ["학교·에듀집 검토 안내", "/legal/certification-readiness"],
] as const;

const classroomFlows = [
  "교사: 계정으로 수업 보드를 만들고 자료를 준비합니다.",
  "학생: 링크나 코드로 들어와 오늘의 수업 자료를 확인합니다.",
  "학생: 이미지, 영상, 음악, 링크, HTML/ZIP 작품을 안내에 따라 제출합니다.",
  "교사: 제출 현황, 작품 갤러리, 발표 순서, 제출자 활동을 한 화면에서 이어갑니다.",
] as const;

const availableCapabilities = ["교사 수업 보드", "링크·코드로 학생 참여", "제출 현황과 작품 검토"] as const;
const plannedCapabilities = ["Google Workspace 연동", "명단 동기화", "기관 관리자", "SSO", "감사·내보내기 도구"] as const;

const schoolTextLinkClass =
  "school-text-link rounded-sm font-semibold underline underline-offset-4 transition-colors focus-visible:outline-none";
const schoolUtilityLinkClass = `${schoolTextLinkClass} inline-flex text-sm font-medium text-slate-200`;
const schoolReviewLinkClass =
  "school-interaction-control school-link-card min-w-0 rounded-xl border border-cyan-300/25 bg-cyan-950/25 p-4 text-sm font-semibold text-cyan-100 transition-[background-color,border-color,box-shadow,color,transform] duration-150 ease-out focus-visible:outline-none";

export default function SchoolPage() {
  return (
    <div data-school-interaction-scope className="bg-[var(--theme-bg)] px-5 py-8 text-slate-100 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl space-y-10">
        <header className="grid gap-8 border-b-2 border-[var(--theme-text)] pb-10 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
          <div className="space-y-4">
            <Link href="/" className={schoolUtilityLinkClass}>
              ← 메인으로 돌아가기
            </Link>
            <p className="text-[11px] font-black tracking-[0.14em] text-cyan-200">SCHOOL REVIEW / 학교·기관용 자료</p>
            <h1 className="max-w-4xl text-4xl font-black leading-[1.06] tracking-[-0.05em] sm:text-6xl">학생은 링크로,<br />교사는 보드로</h1>
            <p className="max-w-3xl text-base leading-8 text-slate-200">
              수업 자료, 학생 작품, 발표와 정리를 한 흐름으로 연결합니다.
            </p>
          </div>
          <p className="border-l-8 border-[#e6f05a] bg-[var(--theme-surface)] px-5 py-4 text-sm font-medium leading-6 text-[var(--theme-text-muted)] shadow-[4px_4px_0_var(--theme-text)]">
            학교별 기준에 따른 검토가 필요합니다. 외부 인증이나 심의 통과를 뜻하지 않습니다.
          </p>
        </header>

        <section className="school-question-grid grid gap-3 lg:grid-cols-2" aria-label="핵심 질문">
          {questionCards.map((card, index) => (
            <article key={card.q} className={`school-question-card grid gap-4 border border-cyan-300/25 bg-slate-900/70 p-5 sm:grid-cols-[3rem_1fr] ${index === 0 ? "lg:col-span-2" : ""}`}>
              <span className="text-sm font-black text-[var(--theme-accent)]" aria-hidden>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h2 className="text-lg font-black text-white">{card.q}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300">{card.a}</p>
              </div>
            </article>
          ))}
        </section>

        <section className="rounded-2xl border border-cyan-300/25 bg-slate-900/70 p-6">
          <h2 className="text-2xl font-semibold text-white">수업 흐름</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {classroomFlows.map((flow, index) => (
              <div key={flow} className="grid grid-cols-[2.5rem_1fr] gap-3 border-b border-dashed border-[var(--theme-border-strong)] px-1 py-4 text-sm text-slate-200">
                <span className="font-black text-[var(--theme-accent)]" aria-hidden>{String(index + 1).padStart(2, "0")}</span>
                <p className="leading-6">{flow}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-cyan-300/25 bg-slate-900/70 p-6">
          <h2 className="text-2xl font-semibold text-white">검토 자료</h2>
          <p className="mt-2 text-sm leading-7 text-slate-300">개인정보 · 보안 · 접근성</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {reviewLinks.map(([label, href]) => (
              <Link key={href} href={href} className={schoolReviewLinkClass}>
                {label}
              </Link>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-6">
            <h2 className="text-2xl font-semibold text-white">도입 문의·견적 준비 현황</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              학교·기관 도입 문의는 현재 공개된 신뢰·보안·운영 문서를 바탕으로 단계적으로 안내하고 있습니다. 견적서, 계약서, 세금계산서, 조달 관련 자료는 사업자 정보와 운영 정책 정비에 맞춰 준비 중입니다.
            </p>
            <p className="mt-3 text-sm text-slate-300">
              상세 기준은 <Link className={`${schoolTextLinkClass} text-cyan-100`} href="/school/adoption-readiness">도입 문의·견적·계약 준비 현황 v1</Link>에서 확인할 수 있습니다.
            </p>
          </article>
          <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-6">
            <h2 className="text-2xl font-semibold text-white">등록 현황</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">곰도리는 에듀집 및 한국디지털교육협회에 ‘학습지원 소프트웨어’로 등록되어 있습니다.</p>
            <p className="mt-3 text-sm leading-7 text-slate-300">{registrationCaution}</p>
            <p className="mt-3 text-sm leading-7 text-slate-300">기관 문의 시 등록 확인 자료를 제공할 수 있습니다.</p>
          </article>
        </section>

        <section className="grid gap-4 rounded-2xl border border-slate-700 bg-slate-900/70 p-6 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold text-white">지금 이용 가능</h2>
            <div className="mt-4 grid gap-2">
              {availableCapabilities.map((item) => (
                <span key={item} className="rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm text-slate-200">{item}</span>
              ))}
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-white">준비 중</h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {plannedCapabilities.map((item) => (
                <span key={item} className="rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm text-slate-200">{item}</span>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
