"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import {
  buildStudentGalleryChatGptPrompt,
  buildStudentGalleryExportJson,
} from "@/lib/board/studentGalleryExport";
import {
  buildStudentGalleryHtmlArtifact,
  buildStudentGalleryZipArtifact,
  downloadStudentGalleryArtifact,
} from "@/lib/board/studentGalleryArtifacts.client";
import { inspectStudentGalleryQuality } from "@/lib/board/studentGalleryQuality";
import type { StudentGalleryQualityIssue } from "@/lib/board/studentGalleryQuality";
import type { FinalArtworkSubmission, StudentSubmissionSummary } from "@/lib/board/studentSubmissionSummary";
import { buildStudentDrawParticipantsFromSummary } from "@/lib/board/studentDrawGame";
import { GoogleDriveSavePanel } from "@/app/_components/google-drive/GoogleDriveSavePanel";
import StudentDrawGameModal from "./StudentDrawGameModal";

type Props = {
  summary: StudentSubmissionSummary;
  onSelectCard: (cardId: string) => void;
  boardId?: string;
};

function getArtworkFallbackLabel(artwork: FinalArtworkSubmission): string {
  if (artwork.videoAttachment) return "영상 작품";
  if (artwork.audioAttachment) return "음악 작품";
  if (artwork.htmlAttachment) return "HTML/웹앱 작품";
  if (artwork.externalLinks.length > 0) return "외부 작품 링크";
  return "텍스트 작품";
}

function getAttachmentUrl(attachment: FinalArtworkSubmission["htmlAttachment"]): string {
  return attachment?.url ?? attachment?.downloadPath ?? "";
}

function getQualityIssueClass(kind: StudentGalleryQualityIssue["kind"]): string {
  if (kind === "privacy") return "border-amber-300/35 bg-amber-300/10 text-amber-50";
  if (kind === "media") return "border-rose-300/35 bg-rose-300/10 text-rose-50";
  if (kind === "link") return "border-sky-300/35 bg-sky-300/10 text-sky-50";
  return "border-cyan-300/30 bg-cyan-300/10 text-cyan-50";
}

function ArtworkBadges({ artwork }: { artwork: FinalArtworkSubmission }) {
  if (artwork.badgeLabels.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {artwork.badgeLabels.map((label) => (
        <span
          key={label}
          className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2 py-0.5 text-[11px] font-semibold text-cyan-50"
        >
          {label}
        </span>
      ))}
    </div>
  );
}

function ArtworkPreviewMedia({ artwork }: { artwork: FinalArtworkSubmission }) {
  if (artwork.representativeImage?.url) {
    return (
      <div className="relative h-[64vh] max-h-[680px] min-h-[300px] w-full">
        <Image
          src={artwork.representativeImage.url}
          alt={artwork.representativeImage.label ?? artwork.title}
          fill
          sizes="(min-width: 1024px) 78vw, 100vw"
          className="object-contain"
          unoptimized
        />
      </div>
    );
  }

  if (artwork.videoAttachment?.url) {
    return (
      <div className="flex w-full flex-col items-center gap-3">
        <p className="text-lg font-bold text-slate-100">영상 작품</p>
        <video
          controls
          src={artwork.videoAttachment.url}
          className="max-h-[64vh] w-full rounded-lg bg-black"
        />
      </div>
    );
  }

  if (artwork.audioAttachment?.url) {
    return (
      <div className="flex min-h-[300px] w-full flex-col items-center justify-center gap-4 rounded-lg border border-slate-800 bg-slate-900/80 px-4 text-center">
        <p className="text-lg font-bold text-slate-100">음악 작품</p>
        <audio controls src={artwork.audioAttachment.url} className="w-full max-w-2xl" />
      </div>
    );
  }

  if (artwork.externalLinks.length > 0) {
    const firstLink = artwork.externalLinks[0] ?? "";
    return (
      <div className="flex min-h-[300px] w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-cyan-300/40 px-4 text-center">
        <p className="text-lg font-bold text-slate-100">외부 작품 링크</p>
        <p className="max-w-xl break-all text-sm leading-6 text-slate-300">{firstLink}</p>
        <a
          href={firstLink}
          target="_blank"
          rel="noreferrer noopener"
          className="rounded-lg bg-cyan-300 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
        >
          외부 작품 열기
        </a>
      </div>
    );
  }

  const htmlUrl = getAttachmentUrl(artwork.htmlAttachment);
  if (htmlUrl) {
    return (
      <div className="flex min-h-[300px] w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-cyan-300/40 px-4 text-center">
        <p className="text-lg font-bold text-slate-100">HTML/웹앱 작품</p>
        <p className="max-w-xl break-all text-sm leading-6 text-slate-300">{htmlUrl}</p>
        <a
          href={htmlUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="rounded-lg bg-cyan-300 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
        >
          HTML/웹앱 열기
        </a>
      </div>
    );
  }

  return (
    <div className="flex min-h-[300px] w-full flex-col items-center justify-center gap-3 rounded-lg border border-slate-800 bg-slate-900/80 px-4">
      <p className="text-lg font-bold text-slate-100">텍스트 작품</p>
      <p className="max-w-3xl whitespace-pre-wrap break-words text-left text-sm leading-7 text-slate-200">
        {artwork.excerpt || artwork.title}
      </p>
    </div>
  );
}

export default function StudentSubmissionStatusPanel({ summary, onSelectCard, boardId = "unknown-board" }: Props) {
  const [expanded, setExpanded] = useState(true);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [drawGameOpen, setDrawGameOpen] = useState(false);
  const [selectedArtworkIndex, setSelectedArtworkIndex] = useState<number | null>(null);
  const [presentationMode, setPresentationMode] = useState(false);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [qualityPanelOpen, setQualityPanelOpen] = useState(false);
  const [downloadingHtml, setDownloadingHtml] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const finalArtworkCards = summary.finalArtworkCards;
  const hasFinalArtwork = finalArtworkCards.length > 0;
  const drawParticipants = useMemo(() => buildStudentDrawParticipantsFromSummary(summary), [summary]);
  const hasDrawParticipants = drawParticipants.length > 0;
  const qualityResult = useMemo(
    () => inspectStudentGalleryQuality(finalArtworkCards),
    [finalArtworkCards],
  );
  const selectedArtwork =
    selectedArtworkIndex == null ? null : finalArtworkCards[selectedArtworkIndex] ?? null;
  const readinessItems = [
    {
      label: "최종 작품",
      value: hasFinalArtwork ? `${finalArtworkCards.length}개 · 준비됨` : "아직 없음",
    },
    {
      label: "데이터 점검",
      value: qualityResult.issues.length > 0 ? `확인 필요 ${qualityResult.issues.length}개` : "큰 문제 없음",
    },
    {
      label: "완성본 HTML",
      value: hasFinalArtwork ? "다운로드 가능" : "아직 없음",
    },
    {
      label: "lesson-15",
      value: "작품 모음집 사이트 키트 준비됨",
    },
    {
      label: "배포 전 점검",
      value: "deploy-guide.html에서 확인",
    },
    {
      label: "교사용 진행안",
      value: "teacher-runbook.html에서 확인",
    },
  ];

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    setExpanded(!window.matchMedia("(max-width: 639px)").matches);
  }, []);

  useEffect(() => {
    if (!galleryOpen) {
      setSelectedArtworkIndex(null);
      setQualityPanelOpen(false);
      return;
    }

    setSelectedArtworkIndex((current) => {
      if (current == null) return null;
      if (finalArtworkCards.length === 0) return null;
      return Math.min(current, finalArtworkCards.length - 1);
    });
  }, [finalArtworkCards.length, galleryOpen]);

  useEffect(() => {
    if (!galleryOpen || typeof window === "undefined") return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (selectedArtworkIndex == null) {
          setPresentationMode(false);
          setGalleryOpen(false);
        } else {
          setSelectedArtworkIndex(null);
        }
        return;
      }

      if (selectedArtworkIndex == null || finalArtworkCards.length <= 1) return;

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setSelectedArtworkIndex((current) =>
          current == null ? current : (current - 1 + finalArtworkCards.length) % finalArtworkCards.length,
        );
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        setSelectedArtworkIndex((current) =>
          current == null ? current : (current + 1) % finalArtworkCards.length,
        );
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [finalArtworkCards.length, galleryOpen, selectedArtworkIndex]);

  const jumpToCard = (cardId: string) => {
    setGalleryOpen(false);
    setSelectedArtworkIndex(null);
    setPresentationMode(false);
    setCopyMessage(null);
    setQualityPanelOpen(false);
    onSelectCard(cardId);
  };

  const closeGallery = () => {
    setGalleryOpen(false);
    setSelectedArtworkIndex(null);
    setPresentationMode(false);
    setCopyMessage(null);
    setQualityPanelOpen(false);
  };

  const moveSelectedArtwork = (direction: -1 | 1) => {
    if (finalArtworkCards.length <= 1) return;
    setSelectedArtworkIndex((current) =>
      current == null ? current : (current + direction + finalArtworkCards.length) % finalArtworkCards.length,
    );
  };

  const copyGalleryText = async (value: string, successMessage: string) => {
    if (!hasFinalArtwork) {
      setCopyMessage("복사할 최종 작품이 아직 없어요.");
      return;
    }

    try {
      const clipboard = typeof navigator === "undefined" ? undefined : navigator.clipboard;
      if (!clipboard?.writeText) throw new Error("Clipboard API is unavailable");
      await clipboard.writeText(value);
      setCopyMessage(successMessage);
    } catch {
      setCopyMessage("복사에 실패했어요. 결과를 직접 선택해 복사해 주세요.");
    }
  };

  const downloadStandaloneHtml = async () => {
    if (!hasFinalArtwork) {
      setCopyMessage("다운로드할 최종 작품이 아직 없어요.");
      return;
    }

    setDownloadingHtml(true);
    try {
      const artifact = await buildStudentGalleryHtmlArtifact({ finalArtworkCards, boardId });
      downloadStudentGalleryArtifact(artifact);
      setCopyMessage(
        "완성본 HTML 파일을 다운로드했어요. 파일을 더블클릭해 열어 보고, 이미지·영상·음악·외부 링크가 잘 보이는지 확인해 주세요.\n공개 전에는 데이터 점검과 개인정보 확인을 한 번 더 해 주세요.",
      );
    } catch {
      setCopyMessage("완성본 HTML 파일을 만들지 못했습니다.");
    } finally {
      setDownloadingHtml(false);
    }
  };

  const downloadGalleryZip = async () => {
    if (!hasFinalArtwork || downloadingZip) return;

    setDownloadingZip(true);
    try {
      const artifact = await buildStudentGalleryZipArtifact({ finalArtworkCards, boardId });
      downloadStudentGalleryArtifact(artifact);
      setCopyMessage(
        "갤러리 ZIP 파일을 다운로드했어요. ZIP 안의 index.html을 열어 확인해 주세요.\n외부 이미지·영상·음악은 인터넷 연결과 공유 권한이 필요할 수 있습니다.",
      );
    } catch {
      setCopyMessage("갤러리 ZIP 파일을 만들지 못했습니다.");
    } finally {
      setDownloadingZip(false);
    }
  };

  return (
    <section
      aria-labelledby="student-submission-status-title"
      className="rounded-xl border border-cyan-300/20 bg-slate-950/90 px-3 py-2.5 text-slate-100 shadow-sm"
      data-testid="student-submission-status-panel"
      data-teacher-submission-panel
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <h2 id="student-submission-status-title" className="text-sm font-semibold text-cyan-50">
            작품 제출 현황
          </h2>
          <p className="mt-0.5 text-xs text-slate-300">
            학생 카드 <strong className="text-white">{summary.studentCardCount}</strong>개 · 첨부 있음{" "}
            <strong className="text-white">{summary.studentCardWithAttachmentsCount}</strong>개 · 최종 작품{" "}
            <strong className="text-white">{summary.finalArtworkCards.length}</strong>개 · 영상/음악/외부 링크 작품{" "}
            <strong className="text-white">{summary.finalArtworkRichMediaCount}</strong>개
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setDrawGameOpen(true)}
            disabled={!hasDrawParticipants}
            title={hasDrawParticipants ? "제출한 친구들로 바로 추첨해요" : "제출한 학생이 있어야 추첨게임을 열 수 있어요"}
            className="rounded-lg border border-amber-200/55 bg-amber-300/10 px-2.5 py-1.5 text-xs font-semibold text-amber-50 transition hover:border-amber-100 hover:bg-amber-300/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-900 disabled:text-slate-500"
          >
            추첨게임
          </button>
          <button
            type="button"
            onClick={() => setGalleryOpen(true)}
            disabled={!hasFinalArtwork}
            className="rounded-lg border border-cyan-300/50 bg-cyan-300/10 px-2.5 py-1.5 text-xs font-semibold text-cyan-50 transition hover:border-cyan-100 hover:bg-cyan-300/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-900 disabled:text-slate-500"
          >
            최종 작품 갤러리 보기
          </button>
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls="student-submission-status-content"
            onClick={() => setExpanded((current) => !current)}
            className="rounded-lg border border-slate-600 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:border-cyan-300 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
          >
            {expanded ? "접기" : "최근 작품 보기"}
          </button>
        </div>
      </div>

      {!hasFinalArtwork ? (
        <p className="mt-2 rounded-lg border border-slate-700 bg-slate-900/70 px-2.5 py-2 text-xs text-slate-300">
          최종 작품으로 표시된 카드가 아직 없어요
        </p>
      ) : null}
      {!hasDrawParticipants ? (
        <p className="mt-2 rounded-lg border border-slate-700 bg-slate-900/70 px-2.5 py-2 text-xs text-slate-300">
          제출한 학생이 생기면 추첨게임을 바로 열 수 있어요.
        </p>
      ) : null}

      {expanded ? (
        <div id="student-submission-status-content" className="mt-2 border-t border-slate-700/80 pt-2">
          {summary.recentCards.length > 0 ? (
            <ol className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-5">
              {summary.recentCards.map((card) => (
                <li key={card.cardId}>
                  <button
                    type="button"
                    onClick={() => onSelectCard(card.cardId)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-2.5 py-2 text-left transition hover:border-cyan-300/70 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
                  >
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-50">
                      <span className="min-w-0 truncate">{card.title}</span>
                      {card.isFinalArtwork ? (
                        <span className="shrink-0 rounded-full border border-cyan-200/60 bg-cyan-300/20 px-1.5 py-0.5 text-[10px] font-bold text-cyan-50">
                          최종 작품
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 block truncate text-[11px] text-slate-300">
                      {card.authorLabel} · 첨부 {card.attachmentCount}개
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-cyan-200">{card.wallTitle}</span>
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-xs text-slate-300">아직 학생이 작성한 카드가 없습니다.</p>
          )}
        </div>
      ) : null}

      {galleryOpen ? (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/70 p-3 sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="final-artwork-gallery-title"
          onClick={closeGallery}
        >
          <div
            className="flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-cyan-300/25 bg-slate-950 text-slate-100 shadow-[0_22px_70px_rgba(0,0,0,0.55)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-col gap-3 border-b border-slate-800 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="min-w-0">
                <h3 id="final-artwork-gallery-title" className="truncate text-base font-semibold text-cyan-50">
                  최종 작품 갤러리 보기
                </h3>
                <p className="mt-0.5 text-xs text-slate-300">최종 작품 {finalArtworkCards.length}개</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  공개 전에는 데이터 점검과 개인정보 확인을 한 번 더 해 주세요.
                </p>
                {copyMessage ? (
                  <p className="mt-1 whitespace-pre-line text-xs font-semibold leading-5 text-cyan-100" role="status">
                    {copyMessage}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <button
                  type="button"
                  aria-expanded={qualityPanelOpen}
                  aria-controls="final-artwork-quality-panel"
                  onClick={() => setQualityPanelOpen((current) => !current)}
                  disabled={!hasFinalArtwork}
                  className="rounded-lg border border-sky-300/40 px-3 py-1.5 text-xs font-semibold text-sky-50 hover:border-sky-200 hover:bg-sky-300/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-200 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500"
                >
                  데이터 점검
                </button>
                <button
                  type="button"
                  onClick={() => void downloadStandaloneHtml()}
                  disabled={!hasFinalArtwork || downloadingHtml}
                  className="rounded-lg border border-emerald-300/45 bg-emerald-300/10 px-3 py-1.5 text-xs font-semibold text-emerald-50 hover:border-emerald-200 hover:bg-emerald-300/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200 disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-transparent disabled:text-slate-500"
                >
                  {downloadingHtml ? "HTML 준비 중…" : "완성본 HTML 다운로드"}
                </button>
                <button
                  type="button"
                  onClick={() => void downloadGalleryZip()}
                  disabled={!hasFinalArtwork || downloadingZip}
                  className="rounded-lg border border-emerald-300/45 bg-emerald-300/10 px-3 py-1.5 text-xs font-semibold text-emerald-50 hover:border-emerald-200 hover:bg-emerald-300/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200 disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-transparent disabled:text-slate-500"
                >
                  {downloadingZip ? "ZIP 준비 중…" : "완성본 ZIP 다운로드"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    copyGalleryText(
                      buildStudentGalleryExportJson(finalArtworkCards),
                      "모음집 데이터가 복사되었어요.",
                    )
                  }
                  disabled={!hasFinalArtwork}
                  className="rounded-lg border border-cyan-300/40 px-3 py-1.5 text-xs font-semibold text-cyan-50 hover:border-cyan-200 hover:bg-cyan-300/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500"
                >
                  모음집 데이터 복사
                </button>
                <button
                  type="button"
                  onClick={() =>
                    copyGalleryText(
                      buildStudentGalleryChatGptPrompt(finalArtworkCards),
                      "ChatGPT용 프롬프트가 복사되었어요.",
                    )
                  }
                  disabled={!hasFinalArtwork}
                  className="rounded-lg border border-cyan-300/40 px-3 py-1.5 text-xs font-semibold text-cyan-50 hover:border-cyan-200 hover:bg-cyan-300/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500"
                >
                  ChatGPT용 프롬프트 복사
                </button>
                <button
                  type="button"
                  onClick={closeGallery}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:border-cyan-300 hover:bg-cyan-300/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
                >
                  닫기
                </button>
              </div>
            </div>
            <div className="min-h-0 overflow-y-auto p-4 sm:p-5">
              <section
                className="mb-4 rounded-xl border border-cyan-300/20 bg-slate-900/75 p-4"
                aria-labelledby="final-artwork-readiness-title"
              >
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h4 id="final-artwork-readiness-title" className="text-sm font-bold text-cyan-50">
                      마지막 수업 준비 상태
                    </h4>
                    <p className="mt-1 text-xs leading-5 text-slate-300">
                      현재 갤러리에 로드된 최종 작품 데이터 기준으로 표시합니다.
                    </p>
                  </div>
                  <span className="w-fit rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-50">
                    {hasFinalArtwork ? "준비됨" : "아직 없음"}
                  </span>
                </div>
                <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
                  {readinessItems.map((item) => (
                    <div key={item.label} className="rounded-lg border border-slate-800 bg-slate-950/55 px-3 py-2">
                      <dt className="font-medium text-slate-400">{item.label}</dt>
                      <dd className="mt-1 font-semibold text-slate-50">{item.value}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 rounded-lg border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-xs leading-5 text-amber-50">
                  HTML과 ZIP에는 갤러리 화면과 작품 정보가 저장됩니다.<br />
                  이미지·영상·음악이 외부 URL이면 인터넷 연결과 공유 권한이 필요할 수 있습니다.<br />
                  ZIP은 외부 미디어 원본을 자동으로 복사한 오프라인 백업 파일이 아닙니다.
                </p>
                <div className="mt-3 border-t border-slate-800 pt-3">
                  <p className="text-xs font-semibold text-slate-200">Google Drive 저장</p>
                  <GoogleDriveSavePanel
                    purpose="student-gallery"
                    defaultFolderName="AI 작품 갤러리"
                    className="mt-2 flex flex-wrap items-center gap-2"
                    actions={[
                      {
                        id: "html",
                        label: "HTML을 Drive에 저장",
                        disabled: !hasFinalArtwork,
                        createFile: () => buildStudentGalleryHtmlArtifact({ finalArtworkCards, boardId }),
                        className: "rounded-lg border border-cyan-300/45 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold text-cyan-50 hover:border-cyan-200 hover:bg-cyan-300/20 disabled:opacity-50",
                      },
                      {
                        id: "zip",
                        label: "ZIP을 Drive에 저장",
                        disabled: !hasFinalArtwork,
                        createFile: () => buildStudentGalleryZipArtifact({ finalArtworkCards, boardId }),
                        className: "rounded-lg border border-cyan-300/45 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold text-cyan-50 hover:border-cyan-200 hover:bg-cyan-300/20 disabled:opacity-50",
                      },
                    ]}
                  />
                </div>
              </section>
              {qualityPanelOpen ? (
                <section
                  id="final-artwork-quality-panel"
                  className="mb-4 rounded-xl border border-sky-300/25 bg-slate-900/80 p-4"
                  aria-labelledby="final-artwork-quality-title"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h4 id="final-artwork-quality-title" className="text-sm font-bold text-sky-50">
                        모음집 데이터 점검
                      </h4>
                      <p className="mt-1 text-sm leading-6 text-slate-200">{qualityResult.summary}</p>
                    </div>
                    <span className="w-fit rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1 text-xs font-semibold text-slate-200">
                      안내 {qualityResult.issues.length}개
                    </span>
                  </div>
                  {qualityResult.issues.length > 0 ? (
                    <ul className="mt-3 grid gap-2">
                      {qualityResult.issues.map((issue, index) => (
                        <li
                          key={`${issue.kind}-${issue.artworkTitle ?? "artwork"}-${issue.message}-${index}`}
                          className={`rounded-lg border px-3 py-2.5 ${getQualityIssueClass(issue.kind)}`}
                        >
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <p className="text-xs font-bold">{issue.label}</p>
                              <p className="mt-1 break-words text-sm leading-6 text-slate-50">{issue.message}</p>
                            </div>
                            <p className="shrink-0 text-xs text-slate-300 sm:max-w-72 sm:text-right">
                              {issue.artworkTitle}
                              {issue.author ? ` · ${issue.author}` : ""}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 rounded-lg border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-sm leading-6 text-cyan-50">
                      복사 전에 개인정보와 외부 링크 공유 권한만 한 번 더 살펴보면 좋아요.
                    </p>
                  )}
                </section>
              ) : null}
              {selectedArtwork ? (
                <div
                  className="mb-4 overflow-hidden rounded-xl border border-cyan-300/30 bg-slate-900/95 shadow-lg"
                  role="region"
                  aria-labelledby="final-artwork-preview-title"
                >
                  <div className="flex flex-col gap-3 border-b border-slate-800 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-cyan-200">크게 보기</p>
                      <h4 id="final-artwork-preview-title" className="mt-0.5 truncate text-base font-bold text-slate-50">
                        {selectedArtwork.authorLabel || "익명 학생"}
                      </h4>
                      <p className="mt-1 truncate text-[11px] text-slate-400">
                        {selectedArtwork.wallTitle} · 첨부 {selectedArtwork.attachmentCount}개
                      </p>
                      <div className="mt-2">
                        <ArtworkBadges artwork={selectedArtwork} />
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <span className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1.5 text-sm font-bold text-cyan-50">
                        {(selectedArtworkIndex ?? 0) + 1} / {finalArtworkCards.length}
                      </span>
                      <button
                        type="button"
                        aria-pressed={presentationMode}
                        onClick={() => setPresentationMode((current) => !current)}
                        className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-100 hover:border-cyan-300 hover:bg-cyan-300/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
                      >
                        {presentationMode ? "정보 보이기" : "정보 숨기기"}
                      </button>
                      <button
                        type="button"
                        onClick={() => moveSelectedArtwork(-1)}
                        disabled={finalArtworkCards.length <= 1}
                        className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-bold text-slate-100 hover:border-cyan-300 hover:bg-cyan-300/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500"
                      >
                        이전 작품
                      </button>
                      <button
                        type="button"
                        onClick={() => moveSelectedArtwork(1)}
                        disabled={finalArtworkCards.length <= 1}
                        className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-bold text-slate-100 hover:border-cyan-300 hover:bg-cyan-300/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500"
                      >
                        다음 작품
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedArtworkIndex(null)}
                        className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:border-cyan-300 hover:bg-cyan-300/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
                      >
                        닫기
                      </button>
                    </div>
                  </div>
                  <div
                    className={
                      presentationMode
                        ? "grid gap-3 p-3 sm:p-4"
                        : "grid gap-4 p-3 sm:p-4 lg:grid-cols-[minmax(0,2.2fr)_minmax(240px,0.7fr)]"
                    }
                  >
                    <div className="flex min-h-[320px] items-center justify-center rounded-lg bg-slate-950/80 p-2 sm:min-h-[420px]">
                      <ArtworkPreviewMedia artwork={selectedArtwork} />
                    </div>
                    {presentationMode ? null : (
                      <div className="flex min-w-0 flex-col gap-3">
                        <dl className="grid grid-cols-2 gap-2 text-xs">
                          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2.5">
                            <dt className="text-[11px] font-medium text-slate-400">작성자</dt>
                            <dd className="mt-1 break-words font-semibold text-slate-50">
                              {selectedArtwork.authorLabel || "익명 학생"}
                            </dd>
                          </div>
                          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2.5">
                            <dt className="text-[11px] font-medium text-slate-400">첨부</dt>
                            <dd className="mt-1 font-semibold text-slate-50">{selectedArtwork.attachmentCount}개</dd>
                          </div>
                          <div className="col-span-2 rounded-lg border border-slate-800 bg-slate-950/70 p-2.5">
                            <dt className="text-[11px] font-medium text-slate-400">컬럼명</dt>
                            <dd className="mt-1 break-words font-semibold text-cyan-100">{selectedArtwork.wallTitle}</dd>
                          </div>
                        </dl>
                        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                          <p className="text-xs font-medium text-slate-400">카드 내용</p>
                          <p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-100">
                            {selectedArtwork.excerpt || selectedArtwork.title}
                          </p>
                        </div>
                        {selectedArtwork.externalLinks.length > 0 ? (
                          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                            <p className="text-xs font-medium text-slate-400">외부 작품 링크</p>
                            <div className="mt-2 grid gap-2">
                              {selectedArtwork.externalLinks.map((link) => (
                                <a
                                  key={link}
                                  href={link}
                                  target="_blank"
                                  rel="noreferrer noopener"
                                  className="truncate rounded-lg border border-cyan-300/40 px-3 py-2 text-xs font-bold text-cyan-50 hover:border-cyan-200 hover:bg-cyan-300/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
                                >
                                  외부 작품 열기
                                </a>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {getAttachmentUrl(selectedArtwork.htmlAttachment) ? (
                          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                            <p className="text-xs font-medium text-slate-400">HTML/웹앱 작품</p>
                            <a
                              href={getAttachmentUrl(selectedArtwork.htmlAttachment)}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="mt-2 block truncate rounded-lg border border-cyan-300/40 px-3 py-2 text-xs font-bold text-cyan-50 hover:border-cyan-200 hover:bg-cyan-300/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
                            >
                              HTML/웹앱 열기
                            </a>
                          </div>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => jumpToCard(selectedArtwork.cardId)}
                          className="mt-auto rounded-lg bg-cyan-300 px-3 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
                        >
                          원본 카드로 이동
                        </button>
                      </div>
                    )}
                    <div className="flex flex-wrap items-center justify-center gap-2 border-t border-slate-800 pt-3 lg:col-span-2">
                      <button
                        type="button"
                        onClick={() => moveSelectedArtwork(-1)}
                        disabled={finalArtworkCards.length <= 1}
                        className="min-w-32 rounded-lg border border-slate-700 px-4 py-3 text-sm font-bold text-slate-100 hover:border-cyan-300 hover:bg-cyan-300/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500"
                      >
                        이전 작품
                      </button>
                      <span className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1.5 text-sm font-bold text-cyan-50">
                        {(selectedArtworkIndex ?? 0) + 1} / {finalArtworkCards.length}
                      </span>
                      <button
                        type="button"
                        onClick={() => moveSelectedArtwork(1)}
                        disabled={finalArtworkCards.length <= 1}
                        className="min-w-32 rounded-lg border border-slate-700 px-4 py-3 text-sm font-bold text-slate-100 hover:border-cyan-300 hover:bg-cyan-300/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500"
                      >
                        다음 작품
                      </button>
                      {presentationMode ? (
                        <button
                          type="button"
                          onClick={() => jumpToCard(selectedArtwork.cardId)}
                          className="min-w-32 rounded-lg bg-cyan-300 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
                        >
                          원본 카드로 이동
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
              <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {finalArtworkCards.map((card, index) => (
                  <li
                    key={card.cardId}
                    onClick={() => setSelectedArtworkIndex(index)}
                    className="cursor-pointer overflow-hidden rounded-xl border border-slate-800 bg-slate-900/90 shadow-sm transition hover:border-cyan-300/70 hover:bg-slate-900"
                  >
                    {card.representativeImage?.url ? (
                      <div className="relative h-40 bg-slate-800">
                        <Image
                          src={card.representativeImage.url}
                          alt={card.representativeImage.label ?? card.title}
                          fill
                          sizes="(min-width: 1280px) 320px, (min-width: 640px) 50vw, 100vw"
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    ) : (
                      <div className="flex h-40 flex-col items-center justify-center gap-2 bg-slate-800 px-4 text-center">
                        <p className="text-sm font-semibold text-slate-100">{getArtworkFallbackLabel(card)}</p>
                        {card.attachmentCount > 0 && card.hasNonImageAttachment ? (
                          <p className="rounded-full border border-slate-600 px-2 py-1 text-xs text-slate-300">
                            첨부 파일 있음
                          </p>
                        ) : null}
                      </div>
                    )}
                    <div className="space-y-2 p-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 truncate text-sm font-semibold text-slate-50">{card.authorLabel}</p>
                        <span className="shrink-0 rounded-full border border-slate-700 px-2 py-0.5 text-[11px] font-semibold text-slate-300">
                          첨부 {card.attachmentCount}개
                        </span>
                      </div>
                      <ArtworkBadges artwork={card} />
                      <p className="line-clamp-3 min-h-[3.75rem] text-sm leading-5 text-slate-200">
                        {card.excerpt || card.title}
                      </p>
                      <p className="truncate text-xs font-medium text-cyan-200">{card.wallTitle}</p>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedArtworkIndex(index);
                        }}
                        className="w-full rounded-lg border border-cyan-300/40 px-3 py-2 text-xs font-bold text-cyan-50 hover:border-cyan-200 hover:bg-cyan-300/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
                      >
                        크게 보기
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          jumpToCard(card.cardId);
                        }}
                        className="mt-1 w-full rounded-lg bg-cyan-300 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
                      >
                        원본 카드로 이동
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      ) : null}
      <StudentDrawGameModal
        boardId={boardId}
        open={drawGameOpen}
        baseParticipants={drawParticipants}
        onClose={() => setDrawGameOpen(false)}
      />
    </section>
  );
}
