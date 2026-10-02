import type { Metadata } from "next";
import { LegalPageShell } from "../../_components/LegalPageShell";

export const metadata: Metadata = { title: "접근성 안내 | 곰도리플랫폼", alternates: { canonical: "/legal/accessibility" } };
const items=[["읽기 대비 개선","어두운 배경에서는 본문 대비를 높이고 핵심 안내를 선명하게 표시합니다."],["키보드 접근성","주요 탐색과 링크 이동은 키보드만으로도 사용 가능하도록 점검합니다."],["대체 텍스트 점검","장식 이미지는 숨기고 의미 있는 이미지는 대체 텍스트를 제공합니다."],["법무/개인정보 문서 가독성","정책 페이지는 구조화된 카드와 명확한 제목으로 검토 가능성을 높입니다."]];
export default function Page(){return <LegalPageShell title="접근성 안내" description="읽기 쉬운 화면과 키보드 사용성을 계속 개선하고 있습니다." lastUpdated="2026-05-12"><div className="grid gap-3 sm:grid-cols-2">{items.map(([t,b])=><article key={t} className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="text-base font-semibold text-slate-950">{t}</h2><p className="mt-2 text-sm text-slate-700">{b}</p></article>)}</div></LegalPageShell>;}
