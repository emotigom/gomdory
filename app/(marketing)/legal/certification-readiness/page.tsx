import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell } from "../../_components/LegalPageShell";

export const metadata: Metadata = { title: "학교·에듀집 검토 안내 | 곰도리플랫폼", alternates: { canonical: "/legal/certification-readiness" } };
const cards = [["학생 로그인 여부", "학생은 링크/코드로 참여", "/school"], ["개인정보처리방침", "공개됨", "/legal/privacy"], ["개인정보 처리 항목", "학생 계정정보 기본 미수집 안내", "/edu/compliance/privacy-data"], ["AI 개인정보 보호 안내", "공개됨", "/legal/ai-privacy"], ["학습지원 SW 기준 안내", "공개됨", "/edu/compliance/learning-support-software"], ["보안 문의", "절차 운영됨", "/legal/security"], ["접근성 안내", "공개됨", "/legal/accessibility"], ["외부 공식 인증", "확정되는 경우 별도 표시", "/legal/certification-readiness"]] as const;

export default function Page() {
  return <LegalPageShell title="학교·에듀집 검토 안내" description="학교 검토에 필요한 학생 로그인, 개인정보, AI 개인정보, 보안 문의 자료를 확인할 수 있습니다." lastUpdated="2026-05-12"><p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-medium text-amber-900">이 페이지는 공식 인증 획득 또는 심의 통과를 의미하지 않으며, 학교와 에듀집 검토에 필요한 정보를 투명하게 안내하기 위한 페이지입니다.</p><section className="rounded-xl border border-slate-200 bg-white p-4"><h2 className="text-lg font-semibold text-slate-900">검토 전 핵심 흐름</h2><p className="mt-2 text-sm leading-6 text-slate-700">학생은 별도 로그인 없이 수업 링크나 코드로 참여하고, 교사는 계정으로 보드와 자료를 관리합니다. 학생 작품은 닉네임과 수업 결과물 중심으로 제출·확인됩니다.</p></section><div className="mt-4 grid gap-3 sm:grid-cols-2">{cards.map(([t, s, l]) => <article key={t} className="rounded-xl border border-slate-200 bg-white p-4"><p className="font-semibold text-slate-900">{t}</p><p className="text-sm text-slate-700">안내: {s}</p><Link className="legal-text-link text-sm font-semibold text-blue-700 underline" href={l}>바로 보기</Link></article>)}</div></LegalPageShell>;
}
