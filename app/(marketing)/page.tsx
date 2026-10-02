import Image from "next/image";
import type { Metadata } from "next";
import { buildStudentUrl } from "@/lib/http/publicLinks";

import { MarketingTrackedLink, MarketingViewTracker } from "./_components/marketingAnalytics";
import { DEFAULT_MARKETING_THEME, resolveMarketingTheme } from "./_components/marketingTokens";
import { MARKETING_HOME_CANONICAL_MARKER_VERSION } from "./_components/landingMarkerContract";

export const metadata: Metadata = {
  title: "AI 수업 보드와 학생 작품 제출",
  description: "수업 자료, 학생 작품, 발표와 정리를 한 보드에서 이어가는 교사 중심 수업 공간입니다.",
  alternates: { canonical: "/" },
};

const lessonFlow = [
  { number: "01", title: "자료 열기", copy: "오늘 쓸 자료를 한 번에" },
  { number: "02", title: "함께 만들기", copy: "파일 · 링크 · 코드로" },
  { number: "03", title: "작품 모으기", copy: "제출 현황까지 바로" },
  { number: "04", title: "발표 이어가기", copy: "순서와 갤러리로" },
] as const;

const boardPreview = [
  { title: "오늘의 수업 자료", copy: "ZIP · 개별 파일 · 코드 보기", tone: "blue" },
  { title: "작품 제출 도우미", copy: "이미지 · 링크 · HTML/ZIP", tone: "yellow" },
  { title: "제출 현황", copy: "18명 중 14명 제출", tone: "coral" },
] as const;

const submissionTypes = [
  ["이미지", "포스터 · 카드뉴스", "IMG"],
  ["영상·음악", "파일 · 공유 링크", "PLAY"],
  ["웹 작품", "HTML · CSS · JS", "WEB"],
  ["외부 작업", "Canva · 발표 자료", "LINK"],
] as const;

const classroomTools = ["작품 갤러리", "제출자 활동", "발표 순서", "모둠 나누기", "결과 복사"] as const;
const privacyChecklist = ["학생 로그인 없음", "닉네임으로 참여", "교사 계정으로 관리"] as const;

function ArrowMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SparkMark() {
  return (
    <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
      <path d="M16 2c.8 8.2 5.8 13.2 14 14-8.2.8-13.2 5.8-14 14-.8-8.2-5.8-13.2-14-14C10.2 15.2 15.2 10.2 16 2Z" fill="currentColor" />
    </svg>
  );
}

export default async function MarketingHome({ searchParams }: { searchParams?: Promise<{ theme?: string }> }) {
  const params = await searchParams;
  const activeTheme = resolveMarketingTheme(params?.theme ?? DEFAULT_MARKETING_THEME);

  return (
    <div
      className="marketing-nebula-shell marketing-studio-shell marketing-landing-canonical relative -mt-10 overflow-hidden pb-20 sm:-mt-14"
      data-marketing-theme={activeTheme}
      data-testid="marketing-landing-root"
      data-landing-variant="canonical"
      data-marker-version={MARKETING_HOME_CANONICAL_MARKER_VERSION}
    >
      <div data-testid="marketing-landing-canonical" className="sr-only" aria-hidden />
      <div data-testid="marketing-landing-marker-version" className="sr-only" aria-hidden />
      <MarketingViewTracker eventName="landing_view" />
      <div className="marketing-studio-aurora pointer-events-none absolute inset-x-0 top-0 -z-10 h-[760px]" aria-hidden />

      <section className="gomdory-hero relative z-10 mx-auto grid w-full max-w-[1320px] items-center gap-12 px-5 pb-20 pt-12 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:px-12 lg:pb-28 lg:pt-20">
        <div className="relative max-w-[680px]">
          <p className="marketing-studio-eyebrow"><span>GOMDORY</span><span aria-hidden>/</span><span>CLASSROOM WORKSHOP</span></p>
          <h1 className="gomdory-hero-title mt-7 text-[clamp(3rem,7.4vw,6.4rem)] font-black leading-[0.94] tracking-[-0.07em] text-[var(--marketing-text)]">
            자료를 펼치고,
            <span className="gomdory-hero-highlight mt-2 block">작품을 모으고,</span>
            <span className="mt-2 block">발표를 시작하세요.</span>
          </h1>
          <p className="mt-8 max-w-[570px] text-lg font-medium leading-8 text-[var(--marketing-text-muted)] sm:text-xl">
            학생은 링크로 들어오고, 선생님은 한 보드에서 수업을 이어갑니다.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <MarketingTrackedLink
              href="/auth/login?mode=signup"
              eventName="cta_click"
              meta={{ location: "landing_hero", cta_kind: "signup" }}
              className="marketing-studio-primary marketing-hero-login-cta inline-flex min-h-[56px] w-full items-center justify-center gap-3 px-6 text-base font-black sm:w-auto"
            >
              무료로 수업 열기
              <ArrowMark />
            </MarketingTrackedLink>
            <MarketingTrackedLink
              href={buildStudentUrl("/s")}
              eventName="cta_click"
              meta={{ location: "landing_hero", cta_kind: "student_preview" }}
              className="marketing-studio-secondary inline-flex min-h-[56px] w-full items-center justify-center px-5 text-base font-bold sm:w-auto"
            >
              학생 화면 보기
            </MarketingTrackedLink>
          </div>

          <div className="gomdory-proof-strip mt-9 flex flex-wrap gap-x-5 gap-y-3 text-sm font-bold text-[var(--marketing-text-muted)]">
            {privacyChecklist.map((item, index) => (
              <span key={item} className="inline-flex items-center gap-2">
                <span className="gomdory-check" aria-hidden>{index + 1}</span>
                {item}
              </span>
            ))}
          </div>
        </div>

        <aside className="marketing-studio-preview gomdory-workboard relative" aria-label="수업 보드 미리보기">
          <div className="gomdory-workboard-tape" aria-hidden />
          <div className="marketing-studio-preview-bar flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="gomdory-mark-frame flex size-12 shrink-0 items-center justify-center">
                <Image src="/logo/gom.png" alt="" width={34} height={34} priority />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-black tracking-[0.16em] text-[var(--marketing-primary)]">수업 보드 미리보기</p>
                <h2 className="mt-1 truncate text-base font-black text-[var(--marketing-text)]">우리 반 AI 작품 만들기</h2>
              </div>
            </div>
            <span className="gomdory-live-stamp shrink-0">수업 중</span>
          </div>

          <div className="gomdory-board-grid mt-4 grid gap-3">
            {boardPreview.map((item, index) => (
              <article key={item.title} className="marketing-studio-preview-card flex items-center gap-4" data-tone={item.tone}>
                <span className="marketing-studio-step flex size-12 shrink-0 items-center justify-center text-sm font-black" aria-hidden>
                  0{index + 1}
                </span>
                <div className="min-w-0">
                  <h3 className="font-black text-[var(--marketing-text)]">{item.title}</h3>
                  <p className="mt-1 text-sm font-medium text-[var(--marketing-text-muted)]">{item.copy}</p>
                </div>
                <span className="ml-auto text-xl font-black text-[var(--marketing-text-muted)]" aria-hidden>↗</span>
              </article>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-[0.82fr_1.18fr] gap-3">
            <div className="gomdory-count-note p-4">
              <p className="text-[11px] font-bold">작품 갤러리</p>
              <p className="mt-1 text-4xl font-black">14</p>
              <p className="text-xs font-semibold">모인 작품</p>
            </div>
            <div className="gomdory-action-note p-4">
              <p className="text-[11px] font-bold">제출자 활동</p>
              <p className="mt-2 text-base font-black">발표 순서 만들기</p>
              <p className="mt-2 text-xs font-bold">바로 시작 →</p>
            </div>
          </div>
          <div className="gomdory-workboard-folio" aria-hidden>BOARD / 01</div>
        </aside>
      </section>

      <section className="gomdory-flow mx-auto w-full max-w-[1320px] px-5 py-16 sm:px-8 lg:px-12" aria-labelledby="lesson-flow-title">
        <div className="grid gap-6 lg:grid-cols-[0.64fr_1.36fr] lg:items-end">
          <div>
            <p className="marketing-studio-eyebrow">ONE BOARD · FOUR MOVES</p>
            <h2 id="lesson-flow-title" className="mt-5 text-4xl font-black tracking-[-0.055em] text-[var(--marketing-text)] sm:text-6xl">
              수업의 박자를<br />놓치지 않게
            </h2>
          </div>
          <p className="max-w-xl border-l-4 border-[var(--marketing-accent)] pl-5 text-base font-semibold leading-7 text-[var(--marketing-text-muted)] lg:ml-auto">
            준비한 자료부터 학생 작품, 발표 순서까지 같은 자리에서 움직입니다.
          </p>
        </div>
        <div className="gomdory-flow-rail mt-12 grid sm:grid-cols-2 lg:grid-cols-4">
          {lessonFlow.map((item) => (
            <article key={item.number} className="marketing-studio-card group relative p-6">
              <p className="gomdory-flow-number text-sm font-black">{item.number}</p>
              <h3 className="mt-16 text-2xl font-black text-[var(--marketing-text)]">{item.title}</h3>
              <p className="mt-2 text-sm font-semibold text-[var(--marketing-text-muted)]">{item.copy}</p>
              <span className="gomdory-flow-arrow" aria-hidden>→</span>
            </article>
          ))}
        </div>
      </section>

      <section className="gomdory-collage mx-auto grid w-full max-w-[1320px] gap-5 px-5 py-20 sm:px-8 lg:grid-cols-[1.18fr_0.82fr] lg:px-12">
        <article className="marketing-studio-card gomdory-submission-sheet p-7 sm:p-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="marketing-studio-eyebrow">작품 제출</p>
              <h2 className="mt-5 max-w-xl text-4xl font-black tracking-[-0.05em] text-[var(--marketing-text)] sm:text-5xl">
                무엇을 만들었든,<br />그대로 모으기
              </h2>
            </div>
            <span className="gomdory-sheet-spark hidden text-[var(--marketing-accent)] sm:inline-flex"><SparkMark /></span>
          </div>
          <div className="mt-10 grid gap-px border border-[var(--marketing-border-strong)] bg-[var(--marketing-border-strong)] sm:grid-cols-2">
            {submissionTypes.map(([title, copy, tag], index) => (
              <div key={title} className="gomdory-file-row flex items-center gap-4 bg-[var(--marketing-surface-strong)] p-4">
                <span className="gomdory-file-tag" data-tone={index % 4}>{tag}</span>
                <div>
                  <h3 className="font-black text-[var(--marketing-text)]">{title}</h3>
                  <p className="mt-1 text-sm font-medium text-[var(--marketing-text-muted)]">{copy}</p>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="marketing-studio-dark-card gomdory-blackboard relative overflow-hidden p-7 text-white sm:p-10">
          <p className="text-xs font-black tracking-[0.14em] text-[#f8cb4d]">NEXT ACTIVITY</p>
          <h2 className="mt-5 text-4xl font-black tracking-[-0.05em]">작품에서 바로<br />다음 활동으로</h2>
          <div className="mt-10 grid gap-2">
            {classroomTools.map((tool, index) => (
              <span key={tool} className="gomdory-tool-line flex items-center gap-3 py-2 text-base font-bold text-white/90">
                <span aria-hidden>{String(index + 1).padStart(2, "0")}</span>{tool}
              </span>
            ))}
          </div>
          <div className="gomdory-chalk-line" aria-hidden />
        </article>
      </section>

      <section className="mx-auto w-full max-w-[1320px] px-5 py-16 sm:px-8 lg:px-12">
        <div className="marketing-studio-safety gomdory-safety-ticket grid gap-7 p-7 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex items-start gap-5">
            <span className="gomdory-safety-seal hidden shrink-0 items-center justify-center sm:flex" aria-hidden>✓</span>
            <div>
              <p className="text-xs font-black tracking-[0.14em] text-[var(--marketing-accent)]">SAFE CLASSROOM</p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-[var(--marketing-text)] sm:text-4xl">학생 로그인 없이 참여</h2>
              <p className="mt-3 text-base font-medium text-[var(--marketing-text-muted)]">학생은 별도 회원가입이나 로그인 없이 링크나 코드로 참여합니다. 학생의 이메일·구글 계정·전화번호를 기본적으로 요구하지 않고, 교사 계정으로 수업을 관리합니다.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 lg:max-w-[420px] lg:justify-end">
            <MarketingTrackedLink href="/school" eventName="cta_click" meta={{ location: "adoption_links" }} className="marketing-studio-secondary inline-flex min-h-[50px] w-full items-center justify-center px-5 font-bold sm:w-auto">
              학교 검토 자료 보기
            </MarketingTrackedLink>
            <MarketingTrackedLink href="/legal/privacy" eventName="cta_click" meta={{ location: "privacy_summary" }} className="marketing-studio-secondary inline-flex min-h-[50px] w-full items-center justify-center px-5 font-bold sm:w-auto">
              개인정보처리방침
            </MarketingTrackedLink>
            <MarketingTrackedLink href="/edu/compliance/learning-support-software" eventName="cta_click" meta={{ location: "privacy_summary" }} className="marketing-studio-secondary inline-flex min-h-[50px] w-full items-center justify-center px-5 font-bold sm:w-auto">
              학습지원 SW 기준 안내
            </MarketingTrackedLink>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1320px] px-5 pb-8 pt-16 sm:px-8 lg:px-12">
        <div className="marketing-studio-final gomdory-final relative overflow-hidden px-6 py-14 sm:px-12 sm:py-20">
          <div className="gomdory-final-grid pointer-events-none absolute inset-0" aria-hidden />
          <div className="relative grid gap-9 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-xs font-black tracking-[0.18em] text-white/70">READY FOR TOMORROW</p>
              <h2 className="mt-5 max-w-3xl text-4xl font-black tracking-[-0.055em] text-white sm:text-6xl">내일 수업,<br />오늘 열어두기</h2>
            </div>
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <MarketingTrackedLink href="/auth/login?mode=signup" eventName="cta_click" meta={{ location: "final_cta", cta_kind: "signup" }} className="gomdory-final-primary inline-flex min-h-[56px] w-full items-center justify-center gap-3 bg-white px-6 font-black text-[#14252b] sm:w-auto">
                무료로 수업 열기 <ArrowMark />
              </MarketingTrackedLink>
              <MarketingTrackedLink href="/school" eventName="cta_click" meta={{ location: "final_cta", cta_kind: "school_review" }} className="gomdory-final-secondary inline-flex min-h-[56px] w-full items-center justify-center border-2 border-white/60 px-6 font-black text-white sm:w-auto">
                학교용 자료
              </MarketingTrackedLink>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
