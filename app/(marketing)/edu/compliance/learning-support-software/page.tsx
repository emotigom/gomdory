import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "학습지원 소프트웨어 필수기준 안내 | 곰도리플랫폼", alternates: { canonical: "/edu/compliance/learning-support-software" } };

const items = [
  ["최소처리원칙", "개인정보처리방침 제1조, 개인정보처리방침 제3조", "적용됨"],
  ["개인정보 안전조치", "개인정보처리방침 제10조", "적용됨"],
  ["열람/정정/삭제/처리정지", "개인정보처리방침 제8조", "절차 운영됨"],
  ["만 14세 미만 아동 보호", "개인정보처리방침 제9조, 아동·청소년 보호 안내", "적용됨"],
  ["보호책임자/제3자 제공/위탁", "개인정보처리방침 제5조, 개인정보처리방침 제6조, 개인정보처리방침 제13조", "공개됨"],
] as const;

const checklist = [
  "학생 로그인 없음",
  "교사 계정만 필요",
  "학생 계정정보 기본 미수집",
  "수업 결과물 중심",
  "AI 개인정보 입력 주의 안내",
] as const;

const examples = [
  {
    title: "AI 작품 갤러리 수업",
    copy: "학생이 생성형 AI로 만든 이미지나 설명을 카드로 제출하고, 선생님은 작품 갤러리에서 발표와 감상을 이어갑니다.",
  },
  {
    title: "AI 포트폴리오 수업",
    copy: "HTML/CSS/JS 포트폴리오 스타터 키트를 내려받고, 완성한 웹 작품이나 링크를 보드에 모읍니다.",
  },
  {
    title: "Canva/Lovable/HTML 결과물 모으기 수업",
    copy: "외부 도구에서 만든 결과물 링크, 웹앱 주소, ZIP 작품을 한 보드에서 제출 현황과 함께 확인합니다.",
  },
] as const;

export default function Page() {
  return (
    <div data-legal-interaction-scope className="bg-[var(--theme-bg)] py-14">
      <section className="mx-auto w-full max-w-6xl space-y-8 px-6">
        <header className="space-y-4">
          <Link href="/" className="legal-text-link inline-flex text-sm font-medium text-slate-200 underline underline-offset-4">
            ← 메인으로 돌아가기
          </Link>
          <p className="text-sm text-slate-300">
            <Link href="/" className="legal-text-link">홈</Link> / <span className="font-semibold text-white">학습지원 SW 기준 안내</span>
          </p>
          <h1 className="text-3xl font-bold text-white">학습지원 소프트웨어 필수기준 안내</h1>
          <p className="max-w-4xl text-slate-200">
            곰도리는 학생 별도 회원가입을 요구하지 않고, 교사 계정 중심으로 수업을 운영합니다. 학생의 이메일·구글 계정·전화번호 등 로그인 개인정보를 기본적으로 수집하지 않으며, 학교와 에듀집 검토에 필요한 개인정보 처리 정보를 공개합니다.
          </p>
        </header>

        <p className="rounded-xl border border-cyan-300/50 bg-cyan-950/30 px-4 py-3 text-sm text-cyan-100">
          학생 로그인 없음 · 교사 계정 중심 · 학생 계정정보 기본 미수집 · 수업 결과물 중심
        </p>

        <section className="rounded-xl border border-cyan-300/35 bg-slate-900/70 px-4 py-3 text-sm">
          <p className="text-xs font-semibold tracking-wide text-cyan-200">검토 자료 안내 · 학교 검토 자료 제공됨</p>
          <p className="mt-1 text-slate-100">본 페이지는 학교와 에듀집 검토에 필요한 개인정보 처리 기준과 증빙 위치를 안내하는 공개 자료입니다.</p>
          <p className="mt-1 text-slate-300">외부 인증 또는 등록 결과가 확정되는 경우 별도 안내합니다.</p>
        </section>

        <section className="grid gap-3 md:grid-cols-5" aria-label="서비스 흐름 체크리스트">
          {checklist.map((item) => (
            <article key={item} className="rounded-xl border border-cyan-300/25 bg-cyan-950/25 p-4 text-sm font-semibold text-cyan-100">
              {item}
            </article>
          ))}
        </section>

        <section className="rounded-xl border border-slate-700 bg-slate-900/70 p-5">
          <h2 className="text-2xl font-semibold text-white">실제 수업 흐름</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {examples.map((example) => (
              <article key={example.title} className="rounded-xl border border-slate-700 bg-slate-950/50 p-4">
                <h3 className="text-base font-semibold text-white">{example.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{example.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white p-5 md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="px-2 py-2 text-left text-slate-950">기준</th>
                <th className="px-2 py-2 text-left text-slate-950">적용 방식</th>
                <th className="px-2 py-2 text-left text-slate-950">상태</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r[0]} className="border-b border-slate-100 align-top">
                  <td className="px-2 py-3 font-semibold text-slate-950">{r[0]}</td>
                  <td className="px-2 py-3 text-slate-800">{r[1]}</td>
                  <td className="px-2 py-3"><span className="inline-flex whitespace-nowrap rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-800">{r[2]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="grid gap-3 md:grid-cols-4">
          <Link href="/legal/privacy" className="legal-link-card rounded-xl border border-cyan-300/25 bg-cyan-950/25 p-4 text-cyan-100">개인정보처리방침</Link>
          <Link href="/legal/child-safety" className="legal-link-card rounded-xl border border-cyan-300/25 bg-cyan-950/25 p-4 text-cyan-100">아동·청소년 보호 안내</Link>
          <Link href="/legal/ai-privacy" className="legal-link-card rounded-xl border border-cyan-300/25 bg-cyan-950/25 p-4 text-cyan-100">AI 개인정보 보호 안내</Link>
          <Link href="/school" className="legal-link-card rounded-xl border border-cyan-300/25 bg-cyan-950/25 p-4 text-cyan-100">학교 검토 자료</Link>
        </section>
      </section>
    </div>
  );
}
