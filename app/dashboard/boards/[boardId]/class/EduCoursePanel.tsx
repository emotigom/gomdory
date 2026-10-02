"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { apiFetch } from "@/lib/http/apiFetch";
import { apiV1Path } from "@/lib/standards/pathTypes";

import { LinkCopyButton } from "./LinkCopyButton";

type EduEnsureResult = {
  ok: true;
  shareCode: string;
  joinShortUrl: string;
  courseUrl: string;
  entryUrl: string;
  createdCount: number;
};

type EduEnsureError = {
  ok: false;
  message?: string;
  error?: {
    code?: string;
    message?: string;
  };
};

type EduRotateResult = {
  ok: true;
  newCode: string;
  joinShortUrl: string;
  courseUrl: string;
};

type EduRotateError = {
  ok: false;
  message?: string;
};

type EduLockResponse = {
  ok: true;
  locked: boolean;
  lockedAt: string | null;
  lockReason: string | null;
};

type EduLockError = {
  ok: false;
  message?: string;
};

type EduArchiveResponse = {
  ok: true;
  lockedAt: string | null;
  participantsCount: number;
  projectsCount: number;
  expiresAt: string | null;
  ttlDays: number | null;
};

type EduArchiveError = {
  ok: false;
  message?: string;
};

type EduStartResponse = {
  ok: true;
  shareCode: string;
  joinShortUrl: string;
  courseUrl: string;
  galleryUrl: string;
  reopenedAssignments: number;
  locked: boolean;
};

type EduStartError = {
  ok: false;
  message?: string;
};

type EduRosterSummaryResponse =
  | { ok: true; participants: unknown[]; projects: unknown[] }
  | { ok: false; error?: { message?: string } };

type EduCoursePanelProps = {
  boardId: string;
};

export default function EduCoursePanel({ boardId }: EduCoursePanelProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EduEnsureResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [shareInfo, setShareInfo] = useState<{
    shareCode: string;
    joinShortUrl: string;
    courseUrl: string;
  } | null>(null);
  const [rotateLoading, setRotateLoading] = useState(false);
  const [rotateError, setRotateError] = useState<string | null>(null);
  const [rotateNotice, setRotateNotice] = useState(false);
  const [lockState, setLockState] = useState<EduLockResponse | null>(null);
  const [lockReason, setLockReason] = useState("");
  const [lockLoading, setLockLoading] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [archiveNotice, setArchiveNotice] = useState<string | null>(null);
  const [archiveTtlDays, setArchiveTtlDays] = useState("");
  const [archiveSummary, setArchiveSummary] = useState<{ participantsCount: number; projectsCount: number } | null>(null);
  const [startLoading, setStartLoading] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [startNotice, setStartNotice] = useState<string | null>(null);
  const [startLinks, setStartLinks] = useState<{
    joinShortUrl: string;
    courseUrl: string;
    galleryUrl: string;
  } | null>(null);

  const loadLockStatus = useCallback(async () => {
    setLockError(null);
    try {
      const response = await apiFetch(apiV1Path(`edu/class/lock?boardId=${encodeURIComponent(boardId)}`));
      const data = (await response.json()) as EduLockResponse | EduLockError;
      if (!response.ok || !data.ok) {
        setLockState(null);
        setLockReason("");
        if (response.status !== 404) {
          setLockError((data as EduLockError).message ?? "잠금 상태를 불러오지 못했습니다.");
        }
        return;
      }
      const lockData = data as EduLockResponse;
      setLockState(lockData);
      setLockReason(lockData.lockReason ?? "");
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "잠금 상태를 불러오지 못했습니다.";
      setLockError(message);
    }
  }, [boardId]);

  useEffect(() => {
    void loadLockStatus();
  }, [loadLockStatus]);

  const loadArchiveSummary = useCallback(async () => {
    if (!boardId) return;
    try {
      const response = await apiFetch(apiV1Path(`edu/class/roster?boardId=${encodeURIComponent(boardId)}`));
      const data = (await response.json().catch(() => null)) as EduRosterSummaryResponse | null;
      if (!response.ok || !data || !data.ok) {
        return;
      }
      setArchiveSummary({
        participantsCount: data.participants?.length ?? 0,
        projectsCount: data.projects?.length ?? 0,
      });
    } catch {
      // ignore summary errors
    }
  }, [boardId]);

  useEffect(() => {
    void loadArchiveSummary();
  }, [loadArchiveSummary]);

  const handleEnsure = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    setRotateNotice(false);
    setProgress("섹션 확인 중…");
    try {
      setProgress("EDU 링크 준비 중…");
      const response = await apiFetch(apiV1Path("edu/course/ensure"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardId }),
      });
      const data = (await response.json()) as EduEnsureResult | EduEnsureError;
      if (!response.ok || !data.ok) {
        const ensureError = data as EduEnsureError;
        const errorCode = ensureError.error?.code;
        if (errorCode === "E_WALL_AUTO_CREATE_FAILED") {
          setError(
            "처음 보드에서는 섹션을 자동으로 만들고 있어요. 실패했다면 새로고침 후 다시 시도해 주세요. 그래도 안 되면 우측 하단 관리 버튼에서 섹션을 만든 뒤 다시 시도해 주세요.",
          );
        } else {
          setError(
            ensureError.message ??
              ensureError.error?.message ??
              "EDU 링크를 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.",
          );
        }
        return;
      }
      setResult(data as EduEnsureResult);
      setShareInfo({
        shareCode: data.shareCode,
        joinShortUrl: data.joinShortUrl,
        courseUrl: data.courseUrl,
      });
      router.refresh();
      void loadLockStatus();
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? `${fetchError.message} 네트워크 상태를 확인한 뒤 다시 시도해 주세요.`
          : "요청에 실패했습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.";
      setError(message);
    } finally {
      setProgress(null);
      setLoading(false);
    }
  };

  const handleRotateCode = async () => {
    if (rotateLoading || !shareInfo) return;
    setRotateLoading(true);
    setRotateError(null);
    try {
      const response = await apiFetch(apiV1Path("edu/class/rotate-code"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardId }),
      });
      const data = (await response.json()) as EduRotateResult | EduRotateError;
      if (!response.ok || !data.ok) {
        setRotateError((data as EduRotateError).message ?? "공유코드 재발급에 실패했습니다.");
        return;
      }
      const rotateData = data as EduRotateResult;
      setShareInfo({
        shareCode: rotateData.newCode,
        joinShortUrl: rotateData.joinShortUrl,
        courseUrl: rotateData.courseUrl,
      });
      setRotateNotice(true);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "요청에 실패했습니다.";
      setRotateError(message);
    } finally {
      setRotateLoading(false);
    }
  };

  const handleLockToggle = async () => {
    if (lockLoading) return;
    setLockLoading(true);
    setLockError(null);
    try {
      const targetLocked = !(lockState?.locked ?? false);
      const response = await apiFetch(apiV1Path("edu/class/lock"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boardId,
          locked: targetLocked,
          reason: targetLocked && lockReason.trim() ? lockReason.trim() : undefined,
        }),
      });
      const data = (await response.json()) as EduLockResponse | EduLockError;
      if (!response.ok || !data.ok) {
        setLockError((data as EduLockError).message ?? "잠금 설정에 실패했습니다.");
        return;
      }
      setLockState(data as EduLockResponse);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "요청에 실패했습니다.";
      setLockError(message);
    } finally {
      setLockLoading(false);
    }
  };

  const handleArchive = async () => {
    if (archiveLoading) return;
    setArchiveLoading(true);
    setArchiveError(null);
    setArchiveNotice(null);

    const rawTtlDays = archiveTtlDays.trim();
    let ttlDaysValue: number | undefined;
    if (rawTtlDays) {
      const parsed = Number(rawTtlDays);
      if (!Number.isFinite(parsed) || parsed < 1) {
        setArchiveError("보관 기간은 1일 이상의 숫자로 입력해주세요.");
        setArchiveLoading(false);
        return;
      }
      ttlDaysValue = Math.min(Math.floor(parsed), 180);
    }

    const summaryText = archiveSummary
      ? `참여 학생 ${archiveSummary.participantsCount}명 · 프로젝트 ${archiveSummary.projectsCount}건`
      : "요약 정보를 불러오지 못했습니다.";
    const ttlText = ttlDaysValue ? `보관 기간 ${ttlDaysValue}일` : "보관 기간 미지정";
    const confirmed = window.confirm(
      `수업을 종료할까요?\n${summaryText}\n${ttlText}\n입장이 잠기고 과제가 마감됩니다.`,
    );

    if (!confirmed) {
      setArchiveLoading(false);
      return;
    }

    try {
      const response = await apiFetch(apiV1Path("edu/class/archive"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boardId,
          archive: true,
          ttlDays: ttlDaysValue,
        }),
      });
      const data = (await response.json()) as EduArchiveResponse | EduArchiveError;
      if (!response.ok || !data.ok) {
        setArchiveError((data as EduArchiveError).message ?? "수업 종료에 실패했습니다.");
        return;
      }

      const archiveData = data as EduArchiveResponse;
      setArchiveNotice(
        `수업을 종료했어요. 참여 학생 ${archiveData.participantsCount}명 · 프로젝트 ${archiveData.projectsCount}건`,
      );
      setArchiveSummary({
        participantsCount: archiveData.participantsCount,
        projectsCount: archiveData.projectsCount,
      });
      void loadLockStatus();
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "요청에 실패했습니다.";
      setArchiveError(message);
    } finally {
      setArchiveLoading(false);
    }
  };

  const handleStartClass = async () => {
    if (startLoading) return;
    setStartLoading(true);
    setStartError(null);
    setStartNotice(null);
    try {
      const response = await apiFetch(apiV1Path("edu/class/start"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardId }),
      });
      const data = (await response.json()) as EduStartResponse | EduStartError;
      if (!response.ok || !data.ok) {
        setStartError((data as EduStartError).message ?? "수업 시작 준비에 실패했습니다.");
        return;
      }
      const startData = data as EduStartResponse;
      const courseUrl = startData.courseUrl || `https://www.gomdory.com/edu?code=${startData.shareCode}`;
      setStartLinks({
        joinShortUrl: startData.joinShortUrl,
        courseUrl,
        galleryUrl: startData.galleryUrl,
      });
      setShareInfo({
        shareCode: startData.shareCode,
        joinShortUrl: startData.joinShortUrl,
        courseUrl,
      });
      const copyText = `학생 입장 링크: ${startData.joinShortUrl}\n코스맵 링크: ${courseUrl}\n갤러리 링크: ${startData.galleryUrl}`;
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(copyText);
        setStartNotice("입장 링크와 갤러리 링크를 복사했습니다.");
      } else {
        setStartNotice("입장 링크와 갤러리 링크가 준비되었습니다.");
      }
      void loadLockStatus();
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "요청에 실패했습니다.";
      setStartError(message);
    } finally {
      setStartLoading(false);
    }
  };

  const buttonLabel = result ? "다시 생성(중복 없이)" : "EDU 4교시 링크 만들기";
  const statusLabel =
    result && result.createdCount === 0
      ? "이미 생성됨"
      : result
        ? "링크 생성 완료"
        : null;
  const lockLabel = lockState?.locked ? "잠금 해제" : "수업 잠그기";
  const lockStatusLabel = lockState?.locked ? "입장 잠김" : "입장 열림";

  return (
    <div className="space-y-3 border border-slate-200 p-3 text-xs text-slate-600">
      <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-emerald-700">오늘 수업 시작</p>
          <p className="text-[11px] text-emerald-700">
            잠금 해제, 과제 재오픈, 입장 링크 및 갤러리 링크를 한번에 준비합니다.
          </p>
        </div>
        <button
          type="button"
          onClick={handleStartClass}
          disabled={startLoading}
          className="w-full rounded-lg border border-emerald-600 bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:border-emerald-300 disabled:bg-emerald-300"
        >
          {startLoading ? "준비 중..." : "오늘 수업 시작"}
        </button>
        {startLinks ? (
          <div className="space-y-2 rounded-lg border border-emerald-200 bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-emerald-700">학생 입장 링크</span>
              <div className="flex items-center gap-2">
                <span className="max-w-[160px] truncate font-mono text-[11px] text-emerald-700">
                  {startLinks.joinShortUrl}
                </span>
                <LinkCopyButton value={startLinks.joinShortUrl} label="복사" />
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-emerald-700">코스맵 링크</span>
              <div className="flex items-center gap-2">
                <span className="max-w-[160px] truncate font-mono text-[11px] text-emerald-700">
                  {startLinks.courseUrl}
                </span>
                <LinkCopyButton value={startLinks.courseUrl} label="복사" />
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-emerald-700">갤러리 링크</span>
              <div className="flex items-center gap-2">
                <span className="max-w-[160px] truncate font-mono text-[11px] text-emerald-700">
                  {startLinks.galleryUrl}
                </span>
                <LinkCopyButton value={startLinks.galleryUrl} label="복사" />
              </div>
            </div>
          </div>
        ) : null}
        {startNotice ? <p className="text-[11px] font-semibold text-emerald-600">{startNotice}</p> : null}
        {startError ? <p className="text-[11px] text-rose-600">{startError}</p> : null}
      </div>
      <div className="space-y-1">
        <p className="text-xs font-semibold text-slate-800">EDU 4교시 링크 만들기</p>
        <p className="text-[11px] text-slate-500">
          한 번 클릭하면 EDU 섹션과 입장 링크 카드가 보드 맨 앞에 준비됩니다.
        </p>
      </div>
      <button
        type="button"
        onClick={handleEnsure}
        disabled={loading}
        className="w-full rounded-lg border border-slate-900 bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300"
      >
        {loading ? "생성 중..." : buttonLabel}
      </button>
      {progress ? <div className="mt-1 text-xs text-stone-500">{progress}</div> : null}
      {statusLabel ? <p className="text-[11px] font-semibold text-emerald-600">{statusLabel}</p> : null}
      {shareInfo ? (
        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-slate-700">학생 입장 링크</span>
            <div className="flex items-center gap-2">
              <span className="max-w-[160px] truncate font-mono text-[11px] text-slate-600">
                {shareInfo.joinShortUrl}
              </span>
              <LinkCopyButton value={shareInfo.joinShortUrl} label="복사" />
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-slate-700">코스맵 링크</span>
            <div className="flex items-center gap-2">
              <span className="max-w-[160px] truncate font-mono text-[11px] text-slate-600">
                {shareInfo.courseUrl}
              </span>
              <LinkCopyButton value={shareInfo.courseUrl} label="복사" />
            </div>
          </div>
          {rotateNotice ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
              기존 링크는 더 이상 동작하지 않아요.
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold text-slate-700">공유코드 재발급</p>
            <p className="text-[11px] text-slate-500">재발급하면 기존 링크는 더 이상 동작하지 않아요.</p>
          </div>
          <button
            type="button"
            onClick={handleRotateCode}
            disabled={rotateLoading || !shareInfo}
            className="rounded-lg border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
          >
            {rotateLoading ? "재발급 중..." : "공유코드 재발급"}
          </button>
        </div>
        {rotateError ? <p className="text-[11px] text-rose-600">{rotateError}</p> : null}
      </div>
      <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold text-slate-700">입장 잠금</p>
            {lockState ? (
              <p className="text-[11px] text-slate-500">현재 상태: {lockStatusLabel}</p>
            ) : (
              <p className="text-[11px] text-slate-500">EDU 링크 생성 후 설정할 수 있어요.</p>
            )}
          </div>
          <button
            type="button"
            onClick={handleLockToggle}
            disabled={lockLoading || !lockState}
            className="rounded-lg border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
          >
            {lockLoading ? "처리 중..." : lockLabel}
          </button>
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-slate-700" htmlFor="edu-lock-reason">
            잠금 사유 (선택)
          </label>
          <input
            id="edu-lock-reason"
            type="text"
            value={lockReason}
            onChange={(event) => setLockReason(event.target.value)}
            disabled={!lockState}
            placeholder="예) 오늘 수업 종료"
            className="w-full rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-slate-700 placeholder:text-slate-300 disabled:cursor-not-allowed disabled:bg-slate-50"
          />
        </div>
        {lockState?.locked ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
            현재 입장 링크는 동작하지 않음
          </p>
        ) : null}
      </div>
      <div className="space-y-2 rounded-lg border border-rose-200 bg-rose-50/40 p-3">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold text-rose-700">수업 종료</p>
          <p className="text-[11px] text-rose-600">수업을 종료하면 학생 입장이 잠기고 과제가 모두 마감됩니다.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-rose-600">
          <span>
            참여 학생 {archiveSummary?.participantsCount ?? 0}명 · 프로젝트 {archiveSummary?.projectsCount ?? 0}건
          </span>
        </div>
        <label className="space-y-1">
          <span className="block text-[11px] font-semibold text-rose-700">보관 기간 (일, 선택 · 최대 180일)</span>
          <input
            type="number"
            min={1}
            max={180}
            value={archiveTtlDays}
            onChange={(event) => setArchiveTtlDays(event.target.value)}
            className="w-full rounded-lg border border-rose-200 px-2 py-1 text-[11px] text-rose-700 placeholder:text-rose-300"
            placeholder="예: 90"
          />
        </label>
        <button
          type="button"
          onClick={handleArchive}
          disabled={archiveLoading}
          className="w-full rounded-lg border border-rose-600 bg-rose-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:border-rose-300 disabled:bg-rose-300"
        >
          {archiveLoading ? "종료 처리 중..." : "수업 종료"}
        </button>
        {archiveNotice ? <p className="text-[11px] font-semibold text-emerald-600">{archiveNotice}</p> : null}
        {archiveError ? <p className="text-[11px] text-rose-600">{archiveError}</p> : null}
      </div>
      {error ? <p className="text-[11px] text-rose-600">{error}</p> : null}
      {lockError ? <p className="text-[11px] text-rose-600">{lockError}</p> : null}
    </div>
  );
}
