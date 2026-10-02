"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import AnchoredMenu from "@/app/_components/AnchoredMenu";
import InlineAlert from "@/app/_components/InlineAlert";
import { buttonTone } from "@/app/_components/uiTokens";
import { pushDashboardToast } from "@/app/dashboard/useDashboardToast";
import { parseStudentDefaultView, type StudentDefaultView } from "@/lib/data/boardShareSettingsShared";
import { apiFetch } from "@/lib/http/apiFetch";
import { publishDashboardInvalidate } from "@/lib/dashboard/invalidation";
import { routes } from "@/lib/standards/routes";
import {
  getJoinEntryUrl,
  getSlidesUrl,
  getStudentBoardUrl,
  getStudentUrl,
} from "@/lib/share/shareUrls";

import { LinkCopyButton } from "./LinkCopyButton";

type ShareLinksPanelProps = {
  boardId: string;
  shareCode?: string | null;
  slidesLink?: string | null;
  latestRecapLink?: string | null;
  activeSessionId?: string | null;
  safeMode?: boolean;
};

type ShareLink = {
  key: "student" | "slides";
  label: string;
  description: string;
  href: string | null;
};

type ShowcaseShare = {
  token: string;
  url: string;
  status: "active" | "revoked";
};

type ExhibitShare = {
  id: string;
  token: string;
  urlShort: string;
  urlCanonicalManage: string;
};

const TAG_LIMIT = 5;

const DEFAULT_VIEW_LABEL: Record<StudentDefaultView, string> = {
  wall: "Wall",
  gallery: "갤러리",
  columns: "컬럼",
  stream: "스트림",
};

function buildShareLinks(options: {
  shareCode?: string | null;
  slidesLink?: string | null;
}): ShareLink[] {
  const { shareCode, slidesLink } = options;
  const baseStudentLink = shareCode ? getStudentUrl(shareCode) : null;
  const resolvedSlidesLink = slidesLink ?? (shareCode ? getSlidesUrl(shareCode) : null);

  return [
    { key: "student", label: "학생 링크", description: "학생 참여용", href: baseStudentLink },
    { key: "slides", label: "슬라이드", description: "발표형 슬라이드", href: resolvedSlidesLink },
  ];
}

function parseTags(input: string): string[] {
  const raw = input
    .split(/[,#]/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => tag.replace(/^#/, ""));

  return Array.from(new Set(raw)).slice(0, TAG_LIMIT);
}

export default function ShareLinksPanel({
  boardId,
  shareCode,
  slidesLink,
  latestRecapLink,
  activeSessionId,
  safeMode = false,
}: ShareLinksPanelProps) {
  const [defaultView, setDefaultView] = useState<StudentDefaultView>("wall");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showcaseShare, setShowcaseShare] = useState<ShowcaseShare | null>(null);
  const [showcaseLoading, setShowcaseLoading] = useState(false);
  const [showcaseError, setShowcaseError] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [exhibitShare, setExhibitShare] = useState<ExhibitShare | null>(null);
  const [exhibitLoading, setExhibitLoading] = useState(false);
  const [exhibitError, setExhibitError] = useState<string | null>(null);
  const [exhibitQrOpen, setExhibitQrOpen] = useState(false);
  const [exhibitQrDataUrl, setExhibitQrDataUrl] = useState<string | null>(null);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateTitle, setTemplateTitle] = useState("");
  const [templateTagsInput, setTemplateTagsInput] = useState("");
  const [templateVisibility, setTemplateVisibility] = useState<"private" | "community">("private");
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [templateCreatedUrl, setTemplateCreatedUrl] = useState<string | null>(null);

  const studentBaseLink = shareCode ? getStudentUrl(shareCode) : null;
  const studentBoardLink = shareCode ? getStudentBoardUrl(shareCode) : null;
  const entryLink = getJoinEntryUrl();
  const wallLink = studentBoardLink ? `${studentBoardLink}?view=wall` : null;
  const galleryLink = studentBoardLink ? `${studentBoardLink}?view=gallery` : null;
  const columnsLink = studentBoardLink ? `${studentBoardLink}?view=columns` : null;
  const streamLink = studentBoardLink ? `${studentBoardLink}?view=stream` : null;
  const tvLink = studentBoardLink ? `${studentBoardLink}?view=wall&tv=1` : null;
  const wallV2Link = studentBoardLink ? `${studentBoardLink}/wall-v2` : null;
  const shareLinks = useMemo(
    () =>
      buildShareLinks({
        shareCode,
        slidesLink,
      }),
    [shareCode, slidesLink],
  );

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await apiFetch(routes.api.boards.shareSettings(boardId), {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });
        const data = (await response.json()) as
          | { ok: true; settings: { studentDefaultView: StudentDefaultView } }
          | { ok: false; code: string; message?: string };
        if (!response.ok || !data.ok) {
          setNotice("기본 화면 설정을 불러오지 못했습니다. 로컬 기본값을 사용합니다.");
          setError(data.ok ? null : data.message ?? null);
          return;
        }
        setDefaultView(parseStudentDefaultView(data.settings.studentDefaultView) ?? "wall");
        setError(null);
        setNotice(null);
      } catch {
        setNotice("기본 화면 설정을 불러오지 못했습니다. 네트워크를 확인해주세요.");
      } finally {
        setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [boardId]);

  const handleUpdateDefault = async (next: StudentDefaultView) => {
    if (saving || next === defaultView) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await apiFetch(routes.api.boards.shareSettings(boardId), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentDefaultView: next }),
      });
      const data = (await response.json()) as
        | { ok: true; settings: { studentDefaultView: StudentDefaultView } }
        | { ok: false; code: string; message?: string };
      if (!response.ok || !data.ok) {
        setError(data.ok ? null : data.message ?? "설정을 저장하지 못했습니다.");
        return;
      }
      setDefaultView(parseStudentDefaultView(data.settings.studentDefaultView) ?? next);
      publishDashboardInvalidate({
        type: "share_links_changed",
        reason: "ensured",
        ts: Date.now(),
      });
    } catch (updateError) {
      const message =
        updateError instanceof Error ? updateError.message : "설정을 저장하지 못했습니다.";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const baseButtonClass = safeMode
    ? "inline-flex h-8 items-center rounded-full border px-3 text-[11px] font-semibold transition"
    : "inline-flex h-9 items-center rounded-full border px-3 text-xs font-semibold transition";

  const handleEnsureShowcase = async () => {
    if (showcaseLoading) return;
    setShowcaseLoading(true);
    setShowcaseError(null);
    try {
      const response = await apiFetch(routes.api.showcase.ensure(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardId }),
      });
      const data = (await response.json()) as
        | { ok: true; token: string; url: string; status: "active" | "revoked" }
        | { ok: false; code: string; message?: string };
      if (!response.ok || !data.ok) {
        setShowcaseError(data.ok ? null : data.message ?? "공유 링크를 만들지 못했습니다.");
        return;
      }
      setShowcaseShare({ token: data.token, url: data.url, status: data.status });
      setQrDataUrl(null);
      setQrOpen(false);
    } catch (ensureError) {
      const message =
        ensureError instanceof Error ? ensureError.message : "공유 링크를 만들지 못했습니다.";
      setShowcaseError(message);
    } finally {
      setShowcaseLoading(false);
    }
  };

  const handleRefreshShowcase = async () => {
    if (!showcaseShare || showcaseLoading) return;
    setShowcaseLoading(true);
    setShowcaseError(null);
    try {
      const response = await apiFetch(routes.api.showcase.refresh(showcaseShare.token), {
        method: "POST",
      });
      const data = (await response.json()) as { ok: true } | { ok: false; code: string; message?: string };
      if (!response.ok || !data.ok) {
        setShowcaseError(data.ok ? null : data.message ?? "링크를 업데이트하지 못했습니다.");
        return;
      }
      setQrDataUrl(null);
    } catch (refreshError) {
      const message =
        refreshError instanceof Error ? refreshError.message : "링크를 업데이트하지 못했습니다.";
      setShowcaseError(message);
    } finally {
      setShowcaseLoading(false);
    }
  };

  const handleRevokeShowcase = async () => {
    if (!showcaseShare || showcaseLoading) return;
    setShowcaseLoading(true);
    setShowcaseError(null);
    try {
      const response = await apiFetch(routes.api.showcase.revoke(showcaseShare.token), {
        method: "POST",
      });
      const data = (await response.json()) as { ok: true } | { ok: false; code: string; message?: string };
      if (!response.ok || !data.ok) {
        setShowcaseError(data.ok ? null : data.message ?? "링크를 해제하지 못했습니다.");
        return;
      }
      setShowcaseShare(null);
      setQrOpen(false);
      setQrDataUrl(null);
    } catch (revokeError) {
      const message =
        revokeError instanceof Error ? revokeError.message : "링크를 해제하지 못했습니다.";
      setShowcaseError(message);
    } finally {
      setShowcaseLoading(false);
    }
  };

  const handleToggleQr = async () => {
    if (!showcaseShare) return;
    if (qrOpen) {
      setQrOpen(false);
      return;
    }
    setQrOpen(true);
    if (qrDataUrl) return;
    try {
      const { toDataURL } = await import("qrcode");
      const dataUrl = await toDataURL(showcaseShare.url);
      setQrDataUrl(dataUrl);
    } catch (qrError) {
      const message = qrError instanceof Error ? qrError.message : "QR 코드를 생성하지 못했습니다.";
      setShowcaseError(message);
      setQrOpen(false);
    }
  };

  const handleEnsureExhibit = async () => {
    if (exhibitLoading) return;
    setExhibitLoading(true);
    setExhibitError(null);
    try {
      const response = await apiFetch(routes.api.exhibits.ensure(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardId }),
      });
      const data = (await response.json()) as
        | {
            ok: true;
            exhibit: { id: string; token: string; urlShort: string; urlCanonicalManage: string };
          }
        | { ok: false; code: string; message?: string };
      if (!response.ok || !data.ok) {
        setExhibitError(data.ok ? null : data.message ?? "전시 링크를 만들지 못했습니다.");
        return;
      }
      setExhibitShare(data.exhibit);
      setExhibitQrOpen(false);
      setExhibitQrDataUrl(null);
    } catch (ensureError) {
      const message =
        ensureError instanceof Error ? ensureError.message : "전시 링크를 만들지 못했습니다.";
      setExhibitError(message);
    } finally {
      setExhibitLoading(false);
    }
  };

  const handleRefreshExhibit = async () => {
    if (!exhibitShare || exhibitLoading) return;
    setExhibitLoading(true);
    setExhibitError(null);
    try {
      const response = await apiFetch(routes.api.exhibits.refresh(exhibitShare.id), {
        method: "POST",
      });
      const data = (await response.json()) as { ok: true } | { ok: false; code: string; message?: string };
      if (!response.ok || !data.ok) {
        setExhibitError(data.ok ? null : data.message ?? "전시 요약을 갱신하지 못했습니다.");
        return;
      }
      setExhibitQrDataUrl(null);
    } catch (refreshError) {
      const message =
        refreshError instanceof Error ? refreshError.message : "전시 요약을 갱신하지 못했습니다.";
      setExhibitError(message);
    } finally {
      setExhibitLoading(false);
    }
  };

  const handleRevokeExhibit = async () => {
    if (!exhibitShare || exhibitLoading) return;
    if (!window.confirm("전시 링크를 중단할까요?")) return;
    setExhibitLoading(true);
    setExhibitError(null);
    try {
      const response = await apiFetch(routes.api.exhibits.revoke(exhibitShare.id), {
        method: "POST",
      });
      const data = (await response.json()) as { ok: true } | { ok: false; code: string; message?: string };
      if (!response.ok || !data.ok) {
        setExhibitError(data.ok ? null : data.message ?? "전시 링크를 중단하지 못했습니다.");
        return;
      }
      setExhibitShare(null);
      setExhibitQrOpen(false);
      setExhibitQrDataUrl(null);
    } catch (revokeError) {
      const message =
        revokeError instanceof Error ? revokeError.message : "전시 링크를 중단하지 못했습니다.";
      setExhibitError(message);
    } finally {
      setExhibitLoading(false);
    }
  };

  const handleToggleExhibitQr = async () => {
    if (!exhibitShare) return;
    if (exhibitQrOpen) {
      setExhibitQrOpen(false);
      return;
    }
    setExhibitQrOpen(true);
    if (exhibitQrDataUrl) return;
    try {
      const { toDataURL } = await import("qrcode");
      const dataUrl = await toDataURL(exhibitShare.urlShort);
      setExhibitQrDataUrl(dataUrl);
    } catch (qrError) {
      const message = qrError instanceof Error ? qrError.message : "QR 코드를 생성하지 못했습니다.";
      setExhibitError(message);
      setExhibitQrOpen(false);
    }
  };

  const tags = useMemo(() => parseTags(templateTagsInput), [templateTagsInput]);

  const handleCreateTemplate = async () => {
    if (!showcaseShare) return;
    setTemplateSaving(true);
    setTemplateError(null);
    try {
      const response = await apiFetch(routes.api.showcase.template(showcaseShare.token), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: templateTitle.trim() || undefined,
          tags,
          visibility: templateVisibility,
        }),
      });
      const data = (await response.json()) as
        | { ok: true; templateId: string; url: string }
        | { ok: false; error?: { message?: string } };
      if (!response.ok || !data.ok) {
        setTemplateError(data.ok ? null : data.error?.message ?? "템플릿을 생성하지 못했습니다.");
        return;
      }
      setTemplateCreatedUrl(data.url);
      pushDashboardToast({
        title: "템플릿이 생성되었습니다",
        description: "내 템플릿에서 바로 확인할 수 있어요.",
      });
    } catch (createError) {
      const message =
        createError instanceof Error ? createError.message : "템플릿을 생성하지 못했습니다.";
      setTemplateError(message);
    } finally {
      setTemplateSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-gray-800">고정 링크</p>
          <p className="text-xs text-gray-500">학생 공유용 링크와 기본 화면을 관리하세요.</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-700">
            {activeSessionId ? (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                진행 중 세션 ID: {activeSessionId}
              </span>
            ) : null}
            {latestRecapLink ? (
              <a
                href={latestRecapLink}
                className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
              >
                최신 리캡 링크
              </a>
            ) : null}
          </div>
        </div>
        {studentBaseLink ? (
          <div className="flex flex-wrap items-center gap-2">
            <DefaultViewSelector
              value={defaultView}
              loading={loading}
              saving={saving}
              onSelect={handleUpdateDefault}
            />
              <LinkCopyMenu
                wallLink={wallLink}
                galleryLink={galleryLink}
                columnsLink={columnsLink}
                streamLink={streamLink}
                tvLink={tvLink}
              disabled={!shareCode}
              safeMode={safeMode}
            />
            <a
              href={entryLink}
              className={`${baseButtonClass} ${
                safeMode
                  ? "border-indigo-200 bg-indigo-50 text-indigo-700 hover:border-indigo-300"
                  : "border-indigo-200 bg-indigo-50 text-indigo-800 hover:border-indigo-300"
              }`}
            >
              입장 코드로 열기
            </a>
            <Link
              href={`/dashboard/boards/${boardId}/board`}
              className={`${baseButtonClass} ${
                safeMode
                  ? "border-gray-200 bg-white/80 text-gray-700 hover:border-gray-300"
                  : "border-gray-200 bg-white text-gray-800 hover:border-gray-300"
              }`}
            >
              보드 관리
            </Link>
          </div>
        ) : null}
      </div>
      {notice ? (
        <div className="mt-3">
          <InlineAlert tone="info" title={notice} />
        </div>
      ) : null}
      {error ? (
        <div className="mt-3">
          <InlineAlert tone="warning" title="설정을 저장하지 못했어요." description={error} />
        </div>
      ) : null}
      {studentBoardLink ? (
        <div className="mt-4 rounded-lg border border-indigo-100 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-gray-900">보기 링크</p>
              <p className="text-xs text-gray-500">Wall·갤러리·컬럼·스트림·TV 링크를 바로 공유하세요.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={wallLink ?? undefined}
                className={`${baseButtonClass} ${
                  safeMode
                    ? "border-indigo-200 bg-indigo-50 text-indigo-700 hover:border-indigo-300"
                    : "border-indigo-200 bg-indigo-50 text-indigo-800 hover:border-indigo-300"
                }`}
              >
                Wall
              </a>
              <a
                href={galleryLink ?? undefined}
                className={`${baseButtonClass} ${
                  safeMode
                    ? "border-indigo-200 bg-indigo-50 text-indigo-700 hover:border-indigo-300"
                    : "border-indigo-200 bg-indigo-50 text-indigo-800 hover:border-indigo-300"
                }`}
              >
                갤러리
              </a>
              <a
                href={columnsLink ?? undefined}
                className={`${baseButtonClass} ${
                  safeMode
                    ? "border-gray-200 bg-white/80 text-gray-700 hover:border-gray-300"
                    : "border-gray-200 bg-white text-gray-800 hover:border-gray-300"
                }`}
              >
                컬럼
              </a>
              <a
                href={streamLink ?? undefined}
                className={`${baseButtonClass} ${
                  safeMode
                    ? "border-gray-200 bg-white/80 text-gray-700 hover:border-gray-300"
                    : "border-gray-200 bg-white text-gray-800 hover:border-gray-300"
                }`}
              >
                스트림
              </a>
              <a
                href={tvLink ?? undefined}
                className={`${baseButtonClass} ${
                  safeMode
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300"
                    : "border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-300"
                }`}
              >
                TV(전체화면)
              </a>
            </div>
          </div>
        </div>
      ) : null}
      <div className="mt-4 rounded-lg border border-indigo-100 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-gray-900">수업 결과 공유</p>
            <p className="text-xs text-gray-500">TV 전시용 결과 페이지를 빠르게 만들어 공유하세요.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {showcaseShare ? (
              <>
                <button
                  type="button"
                  onClick={handleRefreshShowcase}
                  disabled={showcaseLoading}
                  className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 transition hover:border-indigo-300 disabled:cursor-not-allowed disabled:text-indigo-300"
                >
                  업데이트
                </button>
                <button
                  type="button"
                  onClick={handleRevokeShowcase}
                  disabled={showcaseLoading}
                  className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:border-rose-300 disabled:cursor-not-allowed disabled:text-rose-300"
                >
                  리보크
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTemplateOpen(true);
                    setTemplateError(null);
                    setTemplateCreatedUrl(null);
                    setTemplateTitle("");
                    setTemplateTagsInput("");
                    setTemplateVisibility("private");
                  }}
                  disabled={showcaseLoading}
                  className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 disabled:cursor-not-allowed disabled:text-emerald-300"
                >
                  템플릿으로 저장
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleEnsureShowcase}
                disabled={showcaseLoading}
                className="rounded-full border border-indigo-200 bg-indigo-50 px-4 py-1.5 text-xs font-semibold text-indigo-700 transition hover:border-indigo-300 disabled:cursor-not-allowed disabled:text-indigo-300"
              >
                링크 만들기
              </button>
            )}
          </div>
        </div>

        {showcaseError ? <p className="mt-3 text-xs text-rose-600">{showcaseError}</p> : null}

        {showcaseShare ? (
          <div className="mt-4 space-y-3">
            <div className="flex flex-col gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <a
                href={showcaseShare.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium text-gray-800 hover:underline"
              >
                {showcaseShare.url}
              </a>
              <div className="flex items-center gap-3">
                <LinkCopyButton value={showcaseShare.url} />
                <button
                  type="button"
                  onClick={handleToggleQr}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                >
                  {qrOpen ? "QR 닫기" : "QR"}
                </button>
              </div>
            </div>
            {qrOpen ? (
              <div className="flex flex-col items-center gap-2 rounded-md border border-gray-200 bg-white px-4 py-3">
                {qrDataUrl ? (
                  <Image
                    src={qrDataUrl}
                    alt="쇼케이스 QR 코드"
                    width={128}
                    height={128}
                    className="h-32 w-32"
                    unoptimized
                  />
                ) : (
                  <p className="text-xs text-gray-500">QR 코드를 생성하는 중...</p>
                )}
                <p className="text-[11px] text-gray-500">TV 화면에 띄워 바로 안내하세요.</p>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="mt-3 text-xs text-gray-500">
            안전 요약만 포함되며 학생 개인정보는 절대 노출되지 않습니다.
          </p>
        )}
      </div>
      <div className="mt-4 rounded-lg border border-sky-100 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-gray-900">전시 링크 만들기</p>
            <p className="text-xs text-gray-500">수업 전체 결과를 안전 요약으로 전시합니다.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {exhibitShare ? (
              <>
                <button
                  type="button"
                  onClick={handleRefreshExhibit}
                  disabled={exhibitLoading}
                  className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 transition hover:border-sky-300 disabled:cursor-not-allowed disabled:text-sky-300"
                >
                  전시 갱신
                </button>
                <button
                  type="button"
                  onClick={handleRevokeExhibit}
                  disabled={exhibitLoading}
                  className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:border-rose-300 disabled:cursor-not-allowed disabled:text-rose-300"
                >
                  전시 중단
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleEnsureExhibit}
                disabled={exhibitLoading}
                className="rounded-full border border-sky-200 bg-sky-50 px-4 py-1.5 text-xs font-semibold text-sky-700 transition hover:border-sky-300 disabled:cursor-not-allowed disabled:text-sky-300"
              >
                전시 링크 만들기
              </button>
            )}
          </div>
        </div>

        {exhibitError ? <p className="mt-3 text-xs text-rose-600">{exhibitError}</p> : null}

        {exhibitShare ? (
          <div className="mt-4 space-y-3">
            <div className="flex flex-col gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <a
                href={exhibitShare.urlShort}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium text-gray-800 hover:underline"
              >
                {exhibitShare.urlShort}
              </a>
              <div className="flex items-center gap-3">
                <LinkCopyButton value={exhibitShare.urlShort} />
                <button
                  type="button"
                  onClick={handleToggleExhibitQr}
                  className="text-xs font-semibold text-sky-600 hover:text-sky-700"
                >
                  {exhibitQrOpen ? "QR 닫기" : "QR"}
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <a
                href={exhibitShare.urlCanonicalManage}
                className="rounded-full border border-gray-200 bg-white px-3 py-1 font-semibold text-gray-700 transition hover:border-gray-300"
              >
                전시 관리로 이동
              </a>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 font-semibold text-amber-700">
                short host 공유 가능
              </span>
            </div>
            {exhibitQrOpen ? (
              <div className="flex flex-col items-center gap-2 rounded-md border border-gray-200 bg-white px-4 py-3">
                {exhibitQrDataUrl ? (
                  <Image
                    src={exhibitQrDataUrl}
                    alt="전시 QR 코드"
                    width={128}
                    height={128}
                    className="h-32 w-32"
                    unoptimized
                  />
                ) : (
                  <p className="text-xs text-gray-500">QR 코드를 생성하는 중...</p>
                )}
                <p className="text-[11px] text-gray-500">한 번의 링크로 수업 결과를 공유하세요.</p>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="mt-3 text-xs text-gray-500">
            학생 이름/원본 첨부는 포함되지 않으며 안전 요약만 공개됩니다.
          </p>
        )}
      </div>
      {templateOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">수업 결과 템플릿 저장</h2>
                <p className="text-sm text-slate-600">Showcase 요약을 템플릿으로 안전하게 저장합니다.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setTemplateOpen(false);
                  setTemplateError(null);
                  setTemplateCreatedUrl(null);
                }}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
              >
                닫기
              </button>
            </div>

            {templateError ? <InlineAlert tone="error" title="저장 실패" description={templateError} /> : null}

            {templateCreatedUrl ? (
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                  템플릿이 생성되었습니다.
                </div>
                <Link href={templateCreatedUrl} className={buttonTone("primary", { size: "md", tone: "indigo" })}>
                  템플릿 보기
                </Link>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-slate-600">템플릿 제목</span>
                  <input
                    value={templateTitle}
                    onChange={(event) => setTemplateTitle(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    placeholder="예: 오늘 수업 요약 템플릿"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-slate-600">태그 (최대 5개)</span>
                  <input
                    value={templateTagsInput}
                    onChange={(event) => setTemplateTagsInput(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    placeholder="#showcase, #정리"
                  />
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </label>
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-600">공개 범위</p>
                  <div className="flex flex-wrap gap-3 text-sm text-slate-700">
                    <label className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2">
                      <input
                        type="radio"
                        name="template-visibility"
                        value="private"
                        checked={templateVisibility === "private"}
                        onChange={() => setTemplateVisibility("private")}
                      />
                      나만 보기
                    </label>
                    <label className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2">
                      <input
                        type="radio"
                        name="template-visibility"
                        value="community"
                        checked={templateVisibility === "community"}
                        onChange={() => setTemplateVisibility("community")}
                      />
                      커뮤니티 공개
                    </label>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleCreateTemplate}
                    disabled={templateSaving || !showcaseShare}
                    className={buttonTone("primary", { size: "md", tone: "indigo" })}
                  >
                    {templateSaving ? "저장 중..." : "저장"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <div className="space-y-2 rounded-md border border-white bg-white/70 px-3 py-3 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-gray-900">Wall V2 링크</p>
              <p className="text-xs text-gray-600">Padlet 스타일 담벼락(v2)</p>
              <p className={`text-sm ${wallV2Link ? "text-gray-800" : "text-gray-400"}`}>
                {wallV2Link ?? "공유 코드를 활성화하면 링크가 생성됩니다."}
              </p>
              <p className="text-[11px] text-gray-500">
                V2는 /s/&lt;CODE&gt;/wall-v2 입니다. /&lt;CODE&gt;/wall-v2 는 동작하지 않을 수 있어요.
              </p>
            </div>
            <LinkCopyButton
              value={wallV2Link ?? ""}
              disabled={!wallV2Link}
              ariaLabel="Wall V2 링크 복사"
              className={`${baseButtonClass} ${
                safeMode
                  ? "border-gray-200 bg-white/80 text-gray-700 hover:border-gray-300"
                  : "border-gray-200 bg-white text-gray-800 hover:border-gray-300"
              }`}
            />
          </div>
          {wallV2Link ? (
            <Link
              href={wallV2Link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-800 transition hover:border-gray-300"
            >
              새 탭으로 열기
            </Link>
          ) : (
            <span className="inline-flex items-center justify-center rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-400">
              새 탭으로 열기
            </span>
          )}
        </div>
        {shareLinks.map((row) => {
          const disabled = !row.href;

          return (
            <div
              key={row.label}
              className="space-y-2 rounded-md border border-white bg-white/70 px-3 py-3 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-gray-900">{row.label}</p>
                  <p className="text-xs text-gray-600">{row.description}</p>
                  {row.key === "student" ? (
                    <div className="space-y-1 text-sm">
                      <p className={disabled ? "text-gray-400" : "text-gray-800"}>
                        학생 접속(코드 입력): {entryLink}
                      </p>
                      <p className={disabled ? "text-gray-400" : "text-gray-800"}>
                        학생 바로 입장: {row.href ?? "공유 코드를 활성화하면 링크가 생성됩니다."}
                      </p>
                    </div>
                  ) : (
                    <p className={`text-sm ${disabled ? "text-gray-400" : "text-gray-800"}`}>
                      {row.href ?? "공유 코드를 활성화하면 링크가 생성됩니다."}
                    </p>
                  )}
                </div>
                {row.key === "student" ? (
                  <LinkCopyMenu
                    wallLink={wallLink}
                    galleryLink={galleryLink}
                    columnsLink={columnsLink}
                    streamLink={streamLink}
                    tvLink={tvLink}
                    disabled={disabled}
                    safeMode={safeMode}
                    inline
                  />
                ) : (
                  <LinkCopyButton
                    value={row.href ?? ""}
                    disabled={disabled}
                    ariaLabel={`${row.label} 링크 복사`}
                    className={`${baseButtonClass} ${
                      safeMode
                        ? "border-gray-200 bg-white/80 text-gray-700 hover:border-gray-300"
                        : "border-gray-200 bg-white text-gray-800 hover:border-gray-300"
                    }`}
                  />
                )}
              </div>
              <a
                href={row.href ?? undefined}
                className={`inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition ${
                  disabled
                    ? "cursor-not-allowed border border-gray-100 bg-gray-50 text-gray-400"
                    : "border border-gray-200 bg-white text-gray-800 hover:border-gray-300"
                }`}
              >
                열기
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DefaultViewSelector({
  value,
  loading,
  saving,
  onSelect,
}: {
  value: StudentDefaultView;
  loading: boolean;
  saving: boolean;
  onSelect: (view: StudentDefaultView) => void;
}) {
  return (
    <div className="inline-flex rounded-full border border-gray-200 bg-white p-1 shadow-sm">
      {(["wall", "gallery", "columns", "stream"] as const).map((option) => {
        const active = value === option;
        return (
          <button
            key={option}
            type="button"
            disabled={loading || saving}
            onClick={() => onSelect(option)}
            className={`min-w-[82px] rounded-full px-4 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
              active
                ? "bg-gray-900 text-white shadow"
                : "text-gray-700 hover:bg-gray-50 disabled:text-gray-400"
            }`}
            aria-pressed={active}
          >
            {DEFAULT_VIEW_LABEL[option]}
          </button>
        );
      })}
    </div>
  );
}

function LinkCopyMenu({
  wallLink,
  galleryLink,
  columnsLink,
  streamLink,
  tvLink,
  disabled,
  inline = false,
  safeMode = false,
}: {
  wallLink: string | null;
  galleryLink: string | null;
  columnsLink: string | null;
  streamLink: string | null;
  tvLink: string | null;
  disabled: boolean;
  inline?: boolean;
  safeMode?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const buttonClass = safeMode
    ? "inline-flex h-8 items-center gap-2 rounded-full border border-gray-200 bg-white/80 px-3 text-[11px] font-semibold text-gray-700 transition hover:border-gray-300"
    : "inline-flex h-9 items-center gap-2 rounded-full border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-800 transition hover:border-gray-300";

  const copyAndToast = async (value: string, label: string) => {
    if (!value || disabled) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedLabel(label);
      setTimeout(() => setCopiedLabel(null), 1600);
    } catch {
      setCopiedLabel(null);
    }
  };

  return (
    <div className={`relative ${inline ? "" : "mt-2"}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={`${buttonClass} ${disabled ? "cursor-not-allowed text-gray-400" : ""}`}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {copiedLabel ? `${copiedLabel} 복사됨` : "학생 링크 복사"}
        <span aria-hidden className="text-gray-400">▾</span>
      </button>
      <AnchoredMenu
        open={open}
        anchorRef={triggerRef}
        menuRef={menuRef}
        align="right"
        role="menu"
        showBackdrop
        onBackdropClick={() => setOpen(false)}
        className="w-48 rounded-md border border-gray-200 bg-white p-1 shadow-lg"
      >
        <CopyMenuItem
          label="Wall 링크 복사"
          value={wallLink}
          onClick={() => copyAndToast(wallLink ?? "", "Wall")}
          disabled={disabled}
        />
        <CopyMenuItem
          label="갤러리 링크 복사"
          value={galleryLink}
          onClick={() => copyAndToast(galleryLink ?? "", "갤러리")}
          disabled={disabled}
        />
        <CopyMenuItem
          label="컬럼 링크 복사"
          value={columnsLink}
          onClick={() => copyAndToast(columnsLink ?? "", "컬럼")}
          disabled={disabled}
        />
        <CopyMenuItem
          label="스트림 링크 복사"
          value={streamLink}
          onClick={() => copyAndToast(streamLink ?? "", "스트림")}
          disabled={disabled}
        />
        <CopyMenuItem
          label="TV 링크 복사"
          value={tvLink}
          onClick={() => copyAndToast(tvLink ?? "", "TV")}
          disabled={disabled}
        />
      </AnchoredMenu>
    </div>
  );
}

function CopyMenuItem({
  label,
  value,
  disabled,
  onClick,
}: {
  label: string;
  value: string | null;
  disabled: boolean;
  onClick: () => void;
}) {
  const isDisabled = disabled || !value;
  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={onClick}
      className={`w-full rounded-md px-3 py-2 text-left text-xs font-semibold transition ${
        isDisabled
          ? "cursor-not-allowed text-gray-400"
          : "text-gray-800 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      }`}
    >
      {label}
    </button>
  );
}
