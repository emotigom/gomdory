"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

const LESSON_LABELS: Record<number, string> = {
  1: "1교시",
  2: "2교시",
  3: "3교시",
  4: "4교시",
};

export type GalleryProject = {
  slug: string;
  title: string;
  authorName: string;
  createdAt: string;
  lessonId: number | null;
  thumbUrl?: string | null;
  viewCount: number;
  isHidden: boolean;
  hiddenReason: string | null;
  sortOrder?: number | null;
};

type EduGalleryCardProps = {
  project: GalleryProject;
  isFeatured?: boolean;
  isHidden?: boolean;
  canManage?: boolean;
  boardId?: string | null;
  shareCode?: string | null;
  onToggleFeatured?: () => void;
  onToggleHidden?: () => void;
};

export default function EduGalleryCard({
  project,
  isFeatured = false,
  isHidden = false,
  canManage = false,
  boardId,
  shareCode,
  onToggleFeatured,
  onToggleHidden,
}: EduGalleryCardProps) {
  const [thumbError, setThumbError] = useState(false);
  const [copied, setCopied] = useState(false);
  const hasThumb = Boolean(project.thumbUrl) && !thumbError;
  const lessonLabel = project.lessonId ? LESSON_LABELS[project.lessonId] : "자유";
  const viewCountLabel = useMemo(
    () => new Intl.NumberFormat("ko-KR").format(project.viewCount ?? 0),
    [project.viewCount],
  );

  const shareUrl = `https://www.gomdory.com/edu/view/${project.slug}/`;
  const presentParams = useMemo(() => {
    const params = new URLSearchParams({ present: "1", gallery: "1" });
    if (boardId) {
      params.set("boardId", boardId);
    } else if (shareCode) {
      params.set("shareCode", shareCode);
    }
    return params.toString();
  }, [boardId, shareCode]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      window.prompt("링크를 복사하세요.", shareUrl);
    }
  };

  return (
    <article className="group relative flex h-full flex-col justify-between overflow-hidden rounded-[28px] border border-slate-200 bg-white/95 p-5 shadow-[0_10px_30px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:border-emerald-200">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-600">
                {lessonLabel}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-500">
                조회수 {viewCountLabel}
              </span>
              {isFeatured ? (
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-700">대표작</span>
              ) : null}
              {isHidden ? (
                <span className="rounded-full bg-rose-100 px-2.5 py-1 text-rose-700">숨김</span>
              ) : null}
            </div>
            <h2 className="text-lg font-bold text-slate-900">{project.title}</h2>
            <p className="text-xs font-semibold text-slate-500">{project.authorName}</p>
          </div>
          {canManage ? (
            <div className="flex flex-col items-end gap-2">
              <button
                type="button"
                onClick={onToggleFeatured}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  isFeatured
                    ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
              >
                {isFeatured ? "대표 해제" : "대표"}
              </button>
              <button
                type="button"
                onClick={onToggleHidden}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  isHidden
                    ? "bg-rose-100 text-rose-700 hover:bg-rose-200"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
              >
                {isHidden ? "숨김 해제" : "숨김"}
              </button>
            </div>
          ) : null}
        </div>
        <div className="overflow-hidden rounded-2xl border border-dashed border-slate-200 bg-slate-50">
          {hasThumb ? (
            <Image
              src={project.thumbUrl ?? ""}
              alt={`${project.title} 썸네일`}
              className="h-44 w-full object-cover transition duration-300 group-hover:scale-[1.02]"
              width={1200}
              height={630}
              sizes="(min-width: 1024px) 320px, (min-width: 640px) 50vw, 100vw"
              onError={() => setThumbError(true)}
            />
          ) : (
            <div className="flex h-44 items-center justify-center p-4 text-xs text-slate-500">
              스크린샷 준비 중 · 프로젝트 미리보기 영역
            </div>
          )}
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
        <span>{new Date(project.createdAt).toLocaleDateString("ko-KR")}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-emerald-200 hover:text-emerald-600"
          >
            {copied ? "복사됨" : "링크 복사"}
          </button>
          <Link
            href={`/edu/view/${project.slug}/?${presentParams}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
          >
            발표 모드
          </Link>
          <Link
            href={`/edu/view/${project.slug}/`}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white transition hover:bg-slate-800"
          >
            보기
          </Link>
        </div>
      </div>
    </article>
  );
}
