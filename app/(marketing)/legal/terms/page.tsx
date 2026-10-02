import type { Metadata } from "next";
import { LegalPageShell } from "../../_components/LegalPageShell";

export const metadata: Metadata = { title: "이용약관 | 곰도리플랫폼", alternates: { canonical: "/legal/terms" } };

export default function Page() {
  return <LegalPageShell title="이용약관" description="서비스 이용 기준과 책임 범위를 안내합니다." lastUpdated="2026-05-12"><div className="space-y-3 text-sm text-slate-700"><p>학생은 별도 계정 없이 교사가 제공한 링크/코드로 참여할 수 있습니다.</p><p>교사 계정은 수업 생성과 관리를 위해 필요하며 이메일 또는 구글 로그인으로 운영됩니다.</p><p>학생 개인정보나 민감정보를 불필요하게 입력하지 않아야 하며, 교사는 학생 활동 내용 관리 책임이 있습니다.</p><p>AI 기능은 수업 보조 수단이며 교사의 판단을 대체하지 않습니다.</p></div></LegalPageShell>;
}
