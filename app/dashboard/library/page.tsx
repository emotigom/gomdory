import Link from "next/link";

import DashboardPurposeHeader from "@/app/dashboard/_components/DashboardPurposeHeader";
import { requireUser } from "@/lib/auth/requireUser";
import { getPublishedLessonLibraryResources } from "@/lib/education/lessonLibraryRegistry";
import type { LessonLibraryResource } from "@/lib/education/lessonLibraryRegistry";
import { CANONICAL_BASE_URL } from "@/lib/http/siteConfig";
import { routes } from "@/lib/standards/routes";

import LibraryCopyButton from "./LibraryCopyButton";

export const dynamic = "force-dynamic";

function buildAbsoluteLearnUrl(learnPath: LessonLibraryResource["learnPath"]) {
  return new URL(learnPath, CANONICAL_BASE_URL).toString();
}

function buildBoardCardText(resource: LessonLibraryResource, learnUrl: string) {
  return [
    "제목:",
    "오늘의 수업 자료",
    "",
    "내용:",
    `${resource.title} 자료입니다.`,
    "아래 링크를 눌러 발표 자료를 열어보세요.",
    "",
    "링크:",
    learnUrl,
  ].join("\n");
}

export default async function DashboardLibraryPage() {
  await requireUser(routes.page.dashboard.library());

  const resources = getPublishedLessonLibraryResources();

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl space-y-8 px-6 py-10" data-page-marker="dashboard-library">
      <DashboardPurposeHeader
        eyebrow="Lesson Library"
        title="수업자료실"
        description="공개된 수업자료를 확인하고, 학생에게 전달할 링크와 보드 카드 문구를 빠르게 복사합니다."
        nextAction={{ label: "자료를 열고 링크 복사" }}
        statusHint="현재는 registry에 published로 등록된 자료만 보여주며, 학생 보드 자동 생성은 하지 않습니다."
      />

      {resources.length === 0 ? (
        <section className="rounded-[var(--ui-radius-md)] border border-dashed border-[var(--ui-border)] bg-[var(--ui-surface-muted)] p-8 text-center">
          <p className="text-base font-semibold text-[var(--ui-ink)]">공개된 수업자료가 없습니다.</p>
          <p className="mt-2 text-sm text-[var(--ui-ink-soft)]">
            registry에서 published 상태인 자료가 추가되면 이곳에 표시됩니다.
          </p>
        </section>
      ) : (
        <section className="grid gap-4 md:grid-cols-2" aria-label="공개 수업자료 목록">
          {resources.map((resource) => {
            const learnUrl = buildAbsoluteLearnUrl(resource.learnPath);
            const boardCardText = buildBoardCardText(resource, learnUrl);

            return (
              <article
                key={resource.id}
                className="flex min-h-[320px] flex-col rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] bg-[var(--ui-surface)] p-5 shadow-[var(--ui-shadow-panel)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brown)]">
                      {resource.lessonRange}
                    </p>
                    <h2 className="text-xl font-semibold leading-snug text-[var(--ui-ink)]">{resource.title}</h2>
                  </div>
                  <span className="rounded-sm border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-2.5 py-1 text-xs font-semibold text-[var(--ui-ink-soft)]">
                    {resource.type}
                  </span>
                </div>

                <p className="mt-4 flex-1 text-sm leading-6 text-[var(--ui-ink-soft)]">{resource.description}</p>

                <dl className="mt-5 space-y-3 rounded-[var(--ui-radius-sm)] border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] p-4 text-sm">
                  <div className="grid gap-1 sm:grid-cols-[88px_1fr]">
                    <dt className="font-semibold text-[var(--ui-ink)]">차시</dt>
                    <dd className="text-[var(--ui-ink-soft)]">{resource.lessonRange}</dd>
                  </div>
                  <div className="grid gap-1 sm:grid-cols-[88px_1fr]">
                    <dt className="font-semibold text-[var(--ui-ink)]">유형</dt>
                    <dd className="text-[var(--ui-ink-soft)]">{resource.type}</dd>
                  </div>
                  <div className="grid gap-1 sm:grid-cols-[88px_1fr]">
                    <dt className="font-semibold text-[var(--ui-ink)]">학습 경로</dt>
                    <dd className="break-all font-mono text-xs text-[var(--ui-ink-soft)]">{resource.learnPath}</dd>
                  </div>
                </dl>

                <div className="mt-5 flex flex-wrap gap-2">
                  <Link
                    href={resource.learnPath}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-10 items-center justify-center rounded-sm border border-[var(--ui-ink)] bg-[var(--ui-ink)] px-3 text-xs font-semibold text-white transition hover:bg-[var(--ui-ink-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ui-surface)]"
                  >
                    자료 열기
                  </Link>
                  <LibraryCopyButton value={learnUrl} label="학생용 링크 복사" />
                  <LibraryCopyButton value={boardCardText} label="카드 문구 복사" />
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
