"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";

import InlineAlert from "@/app/_components/InlineAlert";
import { buttonTone, cn } from "@/app/_components/uiTokens";
import type { TemplateLibraryItem } from "@/lib/data/templateLibrary";

import { createBoardFromLibraryTemplate, toggleTemplateLike, upsertTemplateReview } from "./actions";

export type SortOption = "recommended" | "latest" | "installs" | "rating" | "likes";

type TemplateLibraryClientProps = {
  templates: TemplateLibraryItem[];
  likedTemplateIds: string[];
  reviews: { templateId: string; rating: number; comment: string | null }[];
  proEnabled: boolean;
  isProUser: boolean;
};

type TemplateState = TemplateLibraryItem & {
  userHasLiked: boolean;
  userReview: { rating: number; comment: string | null } | null;
};

function formatRating(value: number) {
  if (!value) return "0.0";
  return value.toFixed(1);
}

function QualitySignals({ template }: { template: TemplateState }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[12px] font-semibold text-slate-600">
      <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1">📥 {template.installsCount} 설치</span>
      <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-amber-700">
        ⭐ {formatRating(template.avgRating)} ({template.reviewsCount})
      </span>
      <span className="flex items-center gap-1 rounded-full bg-rose-50 px-2 py-1 text-rose-700">❤️ {template.likesCount}</span>
    </div>
  );
}

function BadgeRow({ template }: { template: TemplateState }) {
  return (
    <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide text-indigo-800">
      {template.isPick ? (
        <span className="rounded-full bg-indigo-50 px-3 py-1 text-indigo-700">Gomdory Pick</span>
      ) : null}
      {template.isPro ? <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">PRO</span> : null}
      <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{template.gradeBand}</span>
      {template.durationMin ? (
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">{template.durationMin}분</span>
      ) : null}
    </div>
  );
}

function TemplateCard({
  template,
  onPreview,
  onCreate,
  proEnabled,
  isProUser,
  onLike,
}: {
  template: TemplateState;
  onPreview: (template: TemplateState) => void;
  onCreate: (template: TemplateState) => void;
  onLike: (template: TemplateState) => void;
  proEnabled: boolean;
  isProUser: boolean;
}) {
  const locked = proEnabled && template.isPro && !isProUser;
  return (
    <article className="group flex h-full flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex flex-col gap-2">
        <BadgeRow template={template} />
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-slate-900">{template.title}</h3>
            <p className="text-sm text-slate-700">{template.subtitle}</p>
            <QualitySignals template={template} />
            <div className="flex flex-wrap gap-2">
              {template.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-slate-100 px-2 py-1 text-[12px] font-semibold text-slate-700">
                  #{tag}
                </span>
              ))}
            </div>
            {template.pickReason ? (
              <p className="text-[13px] font-semibold text-indigo-700">추천 이유: {template.pickReason}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-indigo-200 hover:text-indigo-700"
            onClick={() => onLike(template)}
            data-interactive
          >
            {template.userHasLiked ? "❤️ 취소" : "🤍 좋아요"}
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={cn(buttonTone("primary", { tone: "indigo", size: "md" }), locked ? "cursor-not-allowed opacity-60" : "")}
          onClick={() => (locked ? onPreview(template) : onCreate(template))}
          data-interactive
          disabled={false}
        >
          {locked ? "Pro 전용 - 업그레이드" : "이 템플릿으로 새 보드 만들기"}
        </button>
        <button
          type="button"
          className={buttonTone("secondary", { size: "md" })}
          onClick={() => onPreview(template)}
          data-interactive
        >
          미리보기
        </button>
      </div>
    </article>
  );
}

function ReviewStars({ value, onSelect }: { value: number; onSelect: (value: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onSelect(star)}
          className={cn(
            "text-lg",
            star <= value ? "text-amber-500" : "text-slate-300",
            "transition hover:scale-105",
          )}
          data-interactive
        >
          ★
        </button>
      ))}
    </div>
  );
}

function PreviewModal({
  template,
  onClose,
  onCreate,
  onSubmitReview,
}: {
  template: TemplateState;
  onClose: () => void;
  onCreate: (template: TemplateState) => void;
  onSubmitReview: (rating: number, comment: string | null) => void;
}) {
  const [rating, setRating] = useState<number>(template.userReview?.rating ?? 5);
  const [comment, setComment] = useState<string>(template.userReview?.comment ?? "");
  const boardPayload = (template.payload as { board?: { initialColumns?: string[] } } | undefined)?.board;
  const previewColumns = boardPayload?.initialColumns ?? ["생각 모으기"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="w-full max-w-3xl space-y-4 rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <BadgeRow template={template} />
            <h3 className="text-2xl font-semibold text-slate-900">{template.title}</h3>
            <p className="text-slate-700">{template.subtitle}</p>
            <QualitySignals template={template} />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-600"
            data-interactive
          >
            닫기
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500">템플릿 흐름</p>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
              {previewColumns.map((column: string) => (
                <div key={column} className="flex items-center gap-2 py-1">
                  <span className="text-indigo-500">•</span> {column}
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-500">리뷰 남기기</p>
            <ReviewStars value={rating} onSelect={(value) => setRating(value)} />
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value.slice(0, 280))}
              maxLength={280}
              className="w-full rounded-2xl border border-slate-200 p-3 text-sm text-slate-800"
              placeholder="280자 이내로 짧은 후기를 남겨주세요"
            />
            <button
              type="button"
              className={buttonTone("primary", { tone: "indigo", size: "md" })}
              onClick={() => onSubmitReview(rating, comment.trim() ? comment.trim() : null)}
              data-interactive
            >
              후기 저장
            </button>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className={buttonTone("secondary", { size: "md" })}
            onClick={onClose}
            data-interactive
          >
            닫기
          </button>
          <button
            type="button"
            className={buttonTone("primary", { tone: "indigo", size: "md" })}
            onClick={() => onCreate(template)}
            data-interactive
          >
            이 템플릿으로 보드 만들기
          </button>
        </div>
      </div>
    </div>
  );
}

function UpgradeModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="w-full max-w-xl space-y-4 rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-amber-600">PRO 전용</p>
            <h3 className="text-xl font-bold text-slate-900">더 강력한 템플릿 팩을 곧 공개합니다</h3>
            <p className="text-sm text-slate-700">업그레이드하고 고급 템플릿/보고서/저장공간을 가장 먼저 받아보세요.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-600"
            data-interactive
          >
            닫기
          </button>
        </div>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-800">
          <li>수업 준비 시간을 줄이는 고급 템플릿</li>
          <li>보고/리포트 업그레이드</li>
          <li>넉넉한 저장공간과 향후 프리미엄 기능</li>
        </ul>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={buttonTone("primary", { tone: "indigo", size: "md" })} data-interactive>
            문의/대기 등록
          </button>
        </div>
      </div>
    </div>
  );
}

export function TemplateLibraryClient({ templates, likedTemplateIds, reviews, proEnabled, isProUser }: TemplateLibraryClientProps) {
  const [sort, setSort] = useState<SortOption>("recommended");
  const [preview, setPreview] = useState<TemplateState | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<TemplateState[]>(() =>
    templates.map((template) => ({
      ...template,
      userHasLiked: likedTemplateIds.includes(template.id),
      userReview: (() => {
        const review = reviews.find((entry) => entry.templateId === template.id);
        return review ? { rating: review.rating, comment: review.comment } : null;
      })(),
    })),
  );

  const sortedTemplates = useMemo(() => {
    const copy = [...state];
    if (sort === "recommended") {
      return copy.sort((a, b) => {
        if (a.isPick && b.isPick) return (a.pickRank ?? 999) - (b.pickRank ?? 999);
        if (a.isPick) return -1;
        if (b.isPick) return 1;
        return b.installsCount - a.installsCount;
      });
    }
    if (sort === "latest") {
      return copy.sort((a, b) => new Date(b.publishedAt ?? 0).getTime() - new Date(a.publishedAt ?? 0).getTime());
    }
    if (sort === "installs") {
      return copy.sort((a, b) => b.installsCount - a.installsCount);
    }
    if (sort === "rating") {
      return copy.sort((a, b) => b.avgRating - a.avgRating);
    }
    if (sort === "likes") {
      return copy.sort((a, b) => b.likesCount - a.likesCount);
    }
    return copy;
  }, [sort, state]);

  const picks = sortedTemplates.filter((template) => template.isPick).slice(0, 12);
  const others = sortedTemplates.filter((template) => !template.isPick || !picks.includes(template));

  const handleCreate = (template: TemplateState) => {
    setError(null);
    startTransition(() => {
      void createBoardFromLibraryTemplate({ templateId: template.id })
        .then((result) => {
          if (!result?.success) {
            if (result?.status === 403) {
              setUpgradeOpen(true);
            } else {
              setError(result?.error ?? "보드를 생성하지 못했습니다.");
            }
          }
        })
        .catch((cause) => {
          console.error(cause);
          setError("보드를 생성하지 못했습니다.");
        });
    });
  };

  const handleLike = (template: TemplateState) => {
    startTransition(() => {
      void toggleTemplateLike(template.id)
        .then((result) => {
          if (!result || "error" in result) {
            setError(result?.error ?? "좋아요 처리에 실패했습니다.");
            return;
          }
          setState((prev) =>
            prev.map((item) =>
              item.id === template.id
                ? {
                    ...item,
                    likesCount: result.likesCount,
                    reviewsCount: result.reviewsCount,
                    avgRating: result.avgRating,
                    userHasLiked: result.userHasLiked,
                  }
                : item,
            ),
          );
        })
        .catch((cause) => {
          console.error(cause);
          setError("좋아요 처리에 실패했습니다.");
        });
    });
  };

  const handleReview = (rating: number, comment: string | null) => {
    if (!preview) return;
    startTransition(() => {
      void upsertTemplateReview(preview.id, rating, comment)
        .then((result) => {
          if (!result || "error" in result) {
            setError(result?.error ?? "후기를 저장하지 못했습니다.");
            return;
          }
          setState((prev) =>
            prev.map((item) =>
              item.id === preview.id
                ? {
                    ...item,
                    reviewsCount: result.reviewsCount,
                    avgRating: result.avgRating,
                    userReview: { rating: result.rating, comment: result.comment },
                  }
                : item,
            ),
          );
        })
        .catch((cause) => {
          console.error(cause);
          setError("후기를 저장하지 못했습니다.");
        });
    });
  };

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-indigo-700">Gomdory Picks</p>
            <p className="text-base text-slate-700">운영자가 직접 골라 담은 커뮤니티 템플릿, 품질 신호와 함께 만나보세요.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className={buttonTone("secondary", { size: "md" })} href="/dashboard/pro">
              Pro 템플릿 팩 보기
            </Link>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {(
            [
              { key: "recommended", label: "추천(픽+인기)" },
              { key: "latest", label: "최신" },
              { key: "installs", label: "인기" },
              { key: "rating", label: "평점" },
              { key: "likes", label: "좋아요" },
            ] as const
          ).map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setSort(option.key)}
              data-interactive
              className={cn(
                "rounded-full px-3 py-1 text-sm font-semibold",
                sort === option.key
                  ? "bg-indigo-600 text-white shadow"
                  : "border border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:text-indigo-700",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {error ? <InlineAlert tone="error" title="문제가 발생했어요" description={error} /> : null}

      {picks.length ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Picks</h2>
            <p className="text-sm text-slate-600">pick_rank 순으로 정렬된 추천 템플릿</p>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {picks.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onPreview={setPreview}
                onCreate={(next) => {
                  if (proEnabled && next.isPro && !isProUser) {
                    setUpgradeOpen(true);
                  } else {
                    handleCreate(next);
                  }
                }}
                onLike={handleLike}
                proEnabled={proEnabled}
                isProUser={isProUser}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">전체 템플릿</h2>
          <p className="text-sm text-slate-600">커뮤니티 템플릿을 품질 신호별로 정렬합니다.</p>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {others.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onPreview={setPreview}
              onCreate={(next) => {
                if (proEnabled && next.isPro && !isProUser) {
                  setUpgradeOpen(true);
                } else {
                  handleCreate(next);
                }
              }}
              onLike={handleLike}
              proEnabled={proEnabled}
              isProUser={isProUser}
            />
          ))}
        </div>
      </section>

      {preview ? (
        <PreviewModal
          template={preview}
          onClose={() => setPreview(null)}
          onCreate={(next) => {
            if (proEnabled && next.isPro && !isProUser) {
              setUpgradeOpen(true);
            } else {
              handleCreate(next);
            }
          }}
          onSubmitReview={(rating, comment) => handleReview(rating, comment)}
        />
      ) : null}

      {upgradeOpen ? <UpgradeModal onClose={() => setUpgradeOpen(false)} /> : null}
    </div>
  );
}
