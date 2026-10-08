import Link from "next/link";
import type { ReactNode } from "react";

export function LegalPageShell({
  title,
  description,
  lastUpdated,
  children,
}: {
  title: string;
  description: string;
  lastUpdated: string;
  children: ReactNode;
}) {
  return (
    <div
      data-legal-interaction-scope
      className="bg-[var(--theme-bg)] py-14 text-[var(--theme-text)]"
    >
      <section className="mx-auto w-full max-w-6xl space-y-8 px-6">
        <header className="space-y-4">
          <Link
            href="/"
            className="legal-text-link inline-flex text-sm font-medium text-[var(--theme-text-muted)] underline underline-offset-4"
          >
            ← 메인으로 돌아가기
          </Link>

          <p className="text-sm text-[var(--theme-text-muted)]">
            <Link href="/" className="legal-text-link">
              홈
            </Link>{" "}
            /{" "}
            <span className="font-semibold text-[var(--theme-text)]">
              {title}
            </span>
          </p>

          <h1 className="text-3xl font-semibold tracking-tight text-[var(--theme-text)] sm:text-4xl">
            {title}
          </h1>

          <p className="max-w-4xl text-base leading-7 text-[var(--theme-text-muted)]">
            {description}
          </p>

          <p className="text-xs font-semibold text-[var(--theme-text-subtle)]">
            마지막 업데이트: {lastUpdated}
          </p>
        </header>

        {children}

        <aside className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-5 text-sm text-[var(--theme-text-muted)]">
          <p className="font-semibold text-[var(--theme-text)]">문의</p>
          <ul className="mt-2 space-y-1">
            <li>상호: 곰도리플랫폼</li>
            <li>대표: 안상균</li>
            <li>이메일: ahnsangkyoon@gmail.com</li>
            <li>전화: 010-4846-3058</li>
          </ul>
        </aside>

        <section className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface-muted)] p-6">
          <h2 className="text-xl font-semibold text-[var(--theme-text)]">
            학교 검토나 개인정보 확인이 필요하신가요?
          </h2>

          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/"
              className="legal-control legal-control-theme rounded-md border border-[var(--theme-border-strong)] px-4 py-2 text-sm font-semibold text-[var(--theme-text)]"
            >
              메인으로 돌아가기
            </Link>

            <Link
              href="/legal/privacy"
              className="legal-control legal-control-theme rounded-md border border-[var(--theme-border-strong)] px-4 py-2 text-sm font-semibold text-[var(--theme-text)]"
            >
              개인정보처리방침 보기
            </Link>

            <a
              href="mailto:ahnsangkyoon@gmail.com"
              className="legal-control legal-control-theme rounded-md border border-[var(--theme-border-strong)] px-4 py-2 text-sm font-semibold text-[var(--theme-text)]"
            >
              문의하기
            </a>
          </div>
        </section>
      </section>
    </div>
  );
}