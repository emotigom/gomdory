import Link from "next/link";
import { buildStudentUrl } from "@/lib/http/publicLinks";
import { containerClass } from "./marketingTokens";

const productLinks = [
  ["수업 보드 만들기", "/auth/login?mode=signup"],
  ["가격", "/pricing"],
  ["학교용 자료", "/school"],
  ["교사 로그인", "/auth/login"],
  ["학생 참여", buildStudentUrl("/s")],
] as const;

const policyLinks = [
  ["개인정보처리방침", "/legal/privacy"],
  ["이용약관", "/legal/terms"],
  ["학생 개인정보 보호 안내", "/legal/child-safety"],
  ["AI 개인정보 보호 안내", "/legal/ai-privacy"],
  ["접근성", "/legal/accessibility"],
  ["학습지원 SW 기준 안내", "/edu/compliance/learning-support-software"],
  ["학교 에듀집 검토 안내", "/legal/certification-readiness"],
] as const;

export default async function MarketingFooter() {
  return (
    <footer data-marketing-interaction-scope className="gomdory-footer border-t-2 border-[var(--theme-text)] bg-[var(--theme-panel-strong)] text-[15px]">
      <div className={`${containerClass} py-12 sm:py-16`}>
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.15fr_0.7fr_0.85fr_0.95fr]">
          <section>
            <div className="flex items-center gap-3">
              <span className="gomdory-footer-mark flex size-11 items-center justify-center border-2 border-[var(--theme-text)] bg-[#e6f05a] text-lg font-black text-[var(--theme-text)] shadow-[3px_3px_0_var(--theme-text)]" aria-hidden>곰</span>
              <div>
                <h2 className="text-lg font-black text-[var(--theme-text)]">곰도리</h2>
                <p className="text-[10px] font-bold tracking-[0.1em] text-[var(--theme-text-muted)]">CLASSROOM WORKSHOP</p>
              </div>
            </div>
            <p className="mt-5 max-w-md leading-7 text-[var(--theme-text-muted)]">수업 자료 · 작품 제출 · 발표 정리</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {["학생 로그인 없음", "교사 계정으로 관리", "작품 제출 보드"].map((item) => (
                <span key={item} className="border-b border-dashed border-[var(--theme-text-muted)] px-1 py-2 text-xs font-semibold text-[var(--theme-text-muted)]">{item}</span>
              ))}
            </div>
          </section>

          <section>
            <h2 className="font-bold text-[var(--theme-text)]">바로가기</h2>
            <ul className="mt-4 space-y-3">
              {productLinks.map(([label, href]) => (
                <li key={href}><Link className="marketing-footer-text-link text-[var(--theme-text-muted)]" href={href}>{label}</Link></li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="font-bold text-[var(--theme-text)]">안전과 정책</h2>
            <ul className="mt-4 space-y-3">
              {policyLinks.map(([label, href]) => (
                <li key={href}><Link className="marketing-footer-text-link text-[var(--theme-text-muted)]" href={href}>{label}</Link></li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="font-bold text-[var(--theme-text)]">운영자 정보</h2>
            <ul className="mt-4 space-y-2 text-sm leading-6 text-[var(--theme-text-muted)]">
              <li>상호: 곰도리플랫폼</li>
              <li>대표: 안상균</li>
              <li>전화: 010-4846-3058</li>
              <li>
                이메일:{" "}
                <a className="marketing-footer-text-link underline underline-offset-2" href="mailto:ahnsangkyoon@gmail.com">
                  ahnsangkyoon@gmail.com
                </a>
              </li>
              <li>웹사이트: www.gomdory.com</li>
              <li>사업자등록번호: 준비 중</li>
              <li>통신판매업 신고번호: 준비 중</li>
              <li>주소: 준비 중</li>
            </ul>
          </section>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-[var(--theme-border)] pt-6 text-sm text-[var(--theme-text-muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Gomdory. All rights reserved.</p>
          <div className="flex flex-wrap gap-4">
            <Link className="marketing-footer-text-link" href="/school">학교 검토 자료 보기</Link>
            <Link className="marketing-footer-text-link" href="/legal/security">보안 문의</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
