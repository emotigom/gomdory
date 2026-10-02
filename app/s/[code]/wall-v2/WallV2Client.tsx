"use client";

import LinkifiedText from "@/app/_components/LinkifiedText";
import { useEffect, useMemo, useState } from "react";

import WallV2ComposerModal, { type WallV2Card } from "./WallV2ComposerModal";
import { cn } from "@/app/_components/uiTokens";
import { routes } from "@/lib/standards/routes";
import { WRITE_LOCK_COPY, type WriteLockReason } from "@/lib/student/writeLockReason";

type WallV2Section = {
  id: string;
  boardId: string;
  title: string;
  position: number;
  createdAt: string;
  updatedAt: string;
};

type WallV2SectionGroup = {
  section: WallV2Section;
  cards: WallV2Card[];
  nextCursor: string | null;
};

type WallV2SectionState = WallV2SectionGroup & {
  loadingMore: boolean;
  error: string | null;
};

type WallV2ClientProps = {
  shareCode: string;
  writeLocked: boolean;
  writeLockedReason?: WriteLockReason | null;
  initialSections: WallV2SectionGroup[];
  initialSectionId?: string | null;
  showLegacyNotice?: boolean;
};

export default function WallV2Client({
  shareCode,
  writeLocked,
  writeLockedReason = null,
  initialSections,
  initialSectionId = null,
  showLegacyNotice = false,
}: WallV2ClientProps) {
  const [sections, setSections] = useState<WallV2SectionState[]>(() =>
    initialSections.map((section) => ({
      ...section,
      loadingMore: false,
      error: null,
    })),
  );
  const [composerSectionId, setComposerSectionId] = useState<string | null>(null);

  const highlightSectionId = useMemo(
    () => (sections.some((section) => section.section.id === initialSectionId) ? initialSectionId : null),
    [initialSectionId, sections],
  );
  const activeSection = useMemo(
    () => sections.find((section) => section.section.id === composerSectionId) ?? null,
    [sections, composerSectionId],
  );
  const lockCopy = writeLockedReason ? WRITE_LOCK_COPY[writeLockedReason] : null;

  useEffect(() => {
    if (!highlightSectionId) return;
    const target = document.getElementById(`wall-v2-section-${highlightSectionId}`);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
    }
  }, [highlightSectionId]);

  const handleLoadMore = async (sectionId: string) => {
    const target = sections.find((section) => section.section.id === sectionId);
    if (!target || target.loadingMore || !target.nextCursor) return;

    setSections((prev) =>
      prev.map((section) =>
        section.section.id === sectionId
          ? { ...section, loadingMore: true, error: null }
          : section,
      ),
    );

    try {
      const params = new URLSearchParams();
      params.set("cursor", target.nextCursor);
      params.set("limit", "16");

      const basePath = routes.api.shareV2.wallSectionCards(shareCode, sectionId);
      const response = await fetch(`${basePath}?${params.toString()}`);
      const payload = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            items?: WallV2Card[];
            nextCursor?: string | null;
            error?: { message?: string };
          }
        | null;

      const items = payload?.items;
      if (!response.ok || !payload?.ok || !items) {
        throw new Error(payload?.error?.message ?? "더 불러오지 못했습니다.");
      }

      setSections((prev) =>
        prev.map((section) =>
          section.section.id === sectionId
            ? {
                ...section,
                cards: [...section.cards, ...items],
                nextCursor: payload?.nextCursor ?? null,
                loadingMore: false,
              }
            : section,
        ),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "더 불러오지 못했습니다.";
      setSections((prev) =>
        prev.map((section) =>
          section.section.id === sectionId
            ? { ...section, loadingMore: false, error: message }
            : section,
        ),
      );
    }
  };

  const handleCardCreated = (sectionId: string, card: WallV2Card) => {
    setSections((prev) =>
      prev.map((section) =>
        section.section.id === sectionId
          ? { ...section, cards: [...section.cards, card] }
          : section,
      ),
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-400">Wall v2</p>
          <h1 className="text-2xl font-semibold text-slate-900">패들릿 스타일 게시판</h1>
          <p className="text-sm text-slate-500">가로로 섹션을 넘기며 카드로 의견을 모아보세요.</p>
        </div>
        <span
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-semibold",
            writeLocked
              ? "border-amber-200 bg-amber-50 text-amber-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700",
          )}
        >
          {writeLocked ? lockCopy?.badge ?? "읽기 전용" : "작성 가능"}
        </span>
      </div>

      {writeLocked && lockCopy ? (
        <div className="rounded-2xl border border-amber-100 bg-amber-50/70 px-4 py-3 text-xs text-amber-700">
          {lockCopy.message}
        </div>
      ) : null}

      {showLegacyNotice ? (
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-sm text-indigo-700">
          기존 공유 링크에서 이동했어요. 새 담벼락 화면에서 계속 사용할 수 있습니다.
        </div>
      ) : null}

      <div className="flex gap-5 overflow-x-auto pb-6">
        {sections.map((section) => (
          <section
            key={section.section.id}
            id={`wall-v2-section-${section.section.id}`}
            className={cn(
              "flex w-[280px] flex-shrink-0 flex-col gap-4 rounded-[26px] border border-slate-200/80 bg-white/70 p-4 shadow-sm backdrop-blur",
              highlightSectionId === section.section.id
                ? "ring-2 ring-indigo-200"
                : "ring-1 ring-transparent",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">{section.section.title}</h2>
              <span className="text-xs text-slate-400">{section.cards.length}개</span>
            </div>

            <div className="flex flex-1 flex-col gap-3">
              {section.cards.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-3 py-4 text-center text-xs text-slate-400">
                  아직 카드가 없어요.
                </div>
              ) : (
                section.cards.map((card) => (
                  <article
                    key={card.id}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm"
                  >
                    <p className="whitespace-pre-wrap break-words leading-6">
                      <LinkifiedText
                        text={card.content.text}
                        compact
                        linkClassName="text-blue-700 hover:text-blue-800 focus-visible:ring-offset-white"
                      />
                    </p>
                  </article>
                ))
              )}
            </div>

            {section.error ? <p className="text-xs text-rose-500">{section.error}</p> : null}

            {section.nextCursor ? (
              <button
                type="button"
                onClick={() => handleLoadMore(section.section.id)}
                disabled={section.loadingMore}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
              >
                {section.loadingMore ? "불러오는 중..." : "더보기"}
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => setComposerSectionId(section.section.id)}
              disabled={writeLocked}
              className={cn(
                "flex items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 px-3 py-2 text-sm font-semibold transition",
                writeLocked
                  ? "cursor-not-allowed bg-slate-100 text-slate-400"
                  : "bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50",
              )}
            >
              <span className="text-lg">+</span>
              카드 추가
            </button>
          </section>
        ))}
      </div>

      <WallV2ComposerModal
        isOpen={Boolean(composerSectionId)}
        onClose={() => setComposerSectionId(null)}
        shareCode={shareCode}
        sectionId={composerSectionId}
        sectionTitle={activeSection?.section.title}
        writeLocked={writeLocked}
        writeLockedReason={writeLockedReason}
        onCreated={(card) => {
          if (composerSectionId) {
            handleCardCreated(composerSectionId, card);
          }
        }}
      />
    </div>
  );
}
