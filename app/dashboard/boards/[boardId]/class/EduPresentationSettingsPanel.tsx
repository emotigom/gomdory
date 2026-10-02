"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";

import { apiFetch } from "@/lib/http/apiFetch";
import { apiV1Path } from "@/lib/standards/pathTypes";
import { LinkCopyButton } from "./LinkCopyButton";

const INTERVAL_OPTIONS = [10, 20, 30, 60];

type StartMode = "auto" | "selected";

type PresentationSettingsResponse = {
  autoplayDefault: boolean;
  intervalSecDefault: number;
  startMode: StartMode;
  startSlug: string | null;
};

type PresentationLinkResponse = {
  code: string;
  url: string;
};

type ProjectOption = {
  slug: string;
  title: string;
  authorName: string;
  thumbUrl?: string | null;
};

type ProjectListResponse = {
  items: ProjectOption[];
};

type PresentationSettingsError = {
  error?: { message?: string };
  message?: string;
};

type EduPresentationSettingsPanelProps = {
  boardId: string;
};

export default function EduPresentationSettingsPanel({ boardId }: EduPresentationSettingsPanelProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [autoplayDefault, setAutoplayDefault] = useState(false);
  const [intervalSecDefault, setIntervalSecDefault] = useState(20);
  const [startMode, setStartMode] = useState<StartMode>("auto");
  const [startSlug, setStartSlug] = useState<string | null>(null);
  const [startSearch, setStartSearch] = useState("");
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([]);
  const [projectLoading, setProjectLoading] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [linkNotice, setLinkNotice] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkBusy, setLinkBusy] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState<PresentationSettingsResponse>({
    autoplayDefault: false,
    intervalSecDefault: 20,
    startMode: "auto",
    startSlug: null,
  });

  const loadSettings = useCallback(async () => {
    if (!boardId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch(
        apiV1Path(`edu/presentation/settings?boardId=${encodeURIComponent(boardId)}`),
      );
      const data = (await response.json()) as PresentationSettingsResponse | PresentationSettingsError;
      if (!response.ok) {
        const errorPayload = data as PresentationSettingsError;
        setError(errorPayload.error?.message ?? errorPayload.message ?? "발표 설정을 불러오지 못했습니다.");
        return;
      }
      const resolved = data as PresentationSettingsResponse;
      const resolvedStartMode = resolved.startMode === "selected" ? "selected" : "auto";
      const resolvedStartSlug = resolved.startSlug ? resolved.startSlug : null;
      setAutoplayDefault(Boolean(resolved.autoplayDefault));
      setIntervalSecDefault(
        INTERVAL_OPTIONS.includes(resolved.intervalSecDefault) ? resolved.intervalSecDefault : 20,
      );
      setStartMode(resolvedStartMode);
      setStartSlug(resolvedStartSlug);
      setSavedSnapshot({
        autoplayDefault: Boolean(resolved.autoplayDefault),
        intervalSecDefault: INTERVAL_OPTIONS.includes(resolved.intervalSecDefault)
          ? resolved.intervalSecDefault
          : 20,
        startMode: resolvedStartMode,
        startSlug: resolvedStartSlug,
      });
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "발표 설정을 불러오지 못했습니다.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const loadProjects = useCallback(async () => {
    if (!boardId) return;
    setProjectLoading(true);
    setProjectError(null);
    try {
      const params = new URLSearchParams({
        boardId,
        sort: "featured_first",
        limit: "200",
      });
      const response = await apiFetch(apiV1Path(`edu/projects/list?${params.toString()}`));
      const data = (await response.json()) as ProjectListResponse | PresentationSettingsError;
      if (!response.ok) {
        const errorPayload = data as PresentationSettingsError;
        setProjectError(errorPayload.error?.message ?? errorPayload.message ?? "작품 목록을 불러오지 못했습니다.");
        setProjectOptions([]);
        return;
      }
      const resolved = data as ProjectListResponse;
      setProjectOptions(resolved.items ?? []);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "작품 목록을 불러오지 못했습니다.";
      setProjectError(message);
      setProjectOptions([]);
    } finally {
      setProjectLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const filteredProjects = useMemo(() => {
    const keyword = startSearch.trim().toLowerCase();
    if (!keyword) return projectOptions;
    return projectOptions.filter((project) => {
      return (
        project.title.toLowerCase().includes(keyword) ||
        project.authorName.toLowerCase().includes(keyword)
      );
    });
  }, [projectOptions, startSearch]);

  const selectedProject = useMemo(
    () => projectOptions.find((project) => project.slug === startSlug) ?? null,
    [projectOptions, startSlug],
  );

  const isDirty = useMemo(() => {
    const effectiveStartSlug = startMode === "selected" ? startSlug : null;
    const savedEffectiveStartSlug = savedSnapshot.startMode === "selected" ? savedSnapshot.startSlug : null;
    return (
      autoplayDefault !== savedSnapshot.autoplayDefault ||
      intervalSecDefault !== savedSnapshot.intervalSecDefault ||
      startMode !== savedSnapshot.startMode ||
      effectiveStartSlug !== savedEffectiveStartSlug
    );
  }, [autoplayDefault, intervalSecDefault, savedSnapshot, startMode, startSlug]);

  const handleSave = useCallback(async () => {
    if (!boardId || saving || !isDirty) return;
    if (startMode === "selected" && !startSlug) {
      setError("발표 시작 작품을 선택해주세요.");
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const payloadStartSlug = startMode === "selected" ? startSlug : null;
      const response = await apiFetch(apiV1Path("edu/presentation/settings"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boardId,
          autoplayDefault,
          intervalSecDefault,
          startMode,
          startSlug: payloadStartSlug,
        }),
      });
      const data = (await response.json()) as PresentationSettingsResponse | PresentationSettingsError;
      if (!response.ok) {
        const errorPayload = data as PresentationSettingsError;
        setError(errorPayload.error?.message ?? errorPayload.message ?? "발표 설정을 저장하지 못했습니다.");
        return;
      }
      setNotice("발표 설정이 저장되었습니다.");
      setSavedSnapshot({
        autoplayDefault,
        intervalSecDefault,
        startMode,
        startSlug: payloadStartSlug,
      });
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "발표 설정을 저장하지 못했습니다.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }, [autoplayDefault, boardId, intervalSecDefault, isDirty, saving, startMode, startSlug]);

  const handleEnsureLink = useCallback(async () => {
    if (!boardId || linkBusy) return;
    setLinkBusy(true);
    setLinkError(null);
    setLinkNotice(null);
    try {
      const response = await apiFetch(apiV1Path("edu/presentation/link/ensure"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardId }),
      });
      const data = (await response.json()) as PresentationLinkResponse | PresentationSettingsError;
      if (!response.ok) {
        const errorPayload = data as PresentationSettingsError;
        setLinkError(errorPayload.error?.message ?? errorPayload.message ?? "발표 링크를 만들지 못했습니다.");
        return;
      }
      const resolved = data as PresentationLinkResponse;
      setLinkUrl(resolved.url);
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(resolved.url);
          setLinkNotice("발표 링크를 복사했습니다.");
        } catch {
          setLinkNotice("발표 링크를 만들었습니다.");
        }
      } else {
        setLinkNotice("발표 링크를 만들었습니다.");
      }
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "발표 링크를 만들지 못했습니다.";
      setLinkError(message);
    } finally {
      setLinkBusy(false);
    }
  }, [boardId, linkBusy]);

  const handleRotateLink = useCallback(async () => {
    if (!boardId || linkBusy) return;
    setLinkBusy(true);
    setLinkError(null);
    setLinkNotice(null);
    try {
      const response = await apiFetch(apiV1Path("edu/presentation/link/rotate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardId }),
      });
      const data = (await response.json()) as PresentationLinkResponse | PresentationSettingsError;
      if (!response.ok) {
        const errorPayload = data as PresentationSettingsError;
        setLinkError(errorPayload.error?.message ?? errorPayload.message ?? "발표 링크를 재발급하지 못했습니다.");
        return;
      }
      const resolved = data as PresentationLinkResponse;
      setLinkUrl(resolved.url);
      setLinkNotice("발표 링크를 재발급했습니다.");
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "발표 링크를 재발급하지 못했습니다.";
      setLinkError(message);
    } finally {
      setLinkBusy(false);
    }
  }, [boardId, linkBusy]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-xs font-semibold text-slate-700">발표 설정</p>
        <p className="text-[11px] text-slate-500">
          기본 OFF 추천. 교실 상황에 따라 발표 중에 토글할 수 있어요.
        </p>
      </div>
      <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 text-xs text-slate-600">
        {loading ? <p className="text-xs text-slate-400">설정을 불러오는 중입니다.</p> : null}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-800">자동 넘김 기본값</p>
            <p className="text-[11px] text-slate-500">발표 링크에 기본 적용될 자동 넘김 상태입니다.</p>
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="h-5 w-5 accent-emerald-500"
              checked={autoplayDefault}
              onChange={(event) => setAutoplayDefault(event.target.checked)}
            />
            <span className="text-xs font-semibold text-slate-700">{autoplayDefault ? "ON" : "OFF"}</span>
          </label>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-800">자동 넘김 간격</p>
            <p className="text-[11px] text-slate-500">10/20/30/60초 중 선택 가능합니다.</p>
          </div>
          <select
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
            value={intervalSecDefault}
            onChange={(event) => setIntervalSecDefault(Number(event.target.value))}
          >
            {INTERVAL_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}초
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-800">발표 시작 작품</p>
            <p className="text-[11px] text-slate-500">발표 링크를 열면 이 작품부터 시작합니다.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="presentation-start-mode"
                value="auto"
                checked={startMode === "auto"}
                onChange={() => setStartMode("auto")}
                className="h-4 w-4 accent-emerald-500"
              />
              <span className="text-xs font-semibold text-slate-700">자동(대표작 1번부터)</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="presentation-start-mode"
                value="selected"
                checked={startMode === "selected"}
                onChange={() => setStartMode("selected")}
                className="h-4 w-4 accent-emerald-500"
              />
              <span className="text-xs font-semibold text-slate-700">직접 선택</span>
            </label>
          </div>
          {startMode === "selected" ? (
            <div className="space-y-3">
              <input
                type="text"
                value={startSearch}
                onChange={(event) => setStartSearch(event.target.value)}
                placeholder="작품 제목 또는 작성자를 검색하세요."
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 placeholder:text-slate-300"
              />
              <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50 p-2">
                {projectLoading ? <p className="text-[11px] text-slate-400">목록을 불러오는 중...</p> : null}
                {projectError ? <p className="text-[11px] text-rose-500">{projectError}</p> : null}
                {!projectLoading && !projectError && filteredProjects.length === 0 ? (
                  <p className="text-[11px] text-slate-400">선택할 작품이 없습니다.</p>
                ) : null}
                {filteredProjects.map((project) => {
                  const isSelected = project.slug === startSlug;
                  return (
                    <button
                      key={project.slug}
                      type="button"
                      onClick={() => setStartSlug(project.slug)}
                      className={`flex w-full items-center gap-3 rounded-lg border px-2 py-2 text-left text-xs transition ${
                        isSelected
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : "border-transparent bg-white text-slate-600 hover:border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <div className="h-10 w-14 overflow-hidden rounded-md border border-slate-200 bg-white">
                        {project.thumbUrl ? (
                          <Image
                            src={project.thumbUrl}
                            alt={`${project.title} 썸네일`}
                            className="h-full w-full object-cover"
                            width={56}
                            height={40}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">
                            썸네일
                          </div>
                        )}
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-semibold">{project.title}</p>
                        <p className="text-[11px] text-slate-400">{project.authorName}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
              {selectedProject ? (
                <div className="flex items-center gap-3 rounded-lg border border-emerald-100 bg-emerald-50/60 p-3 text-xs text-emerald-700">
                  <div className="h-9 w-12 overflow-hidden rounded-md border border-emerald-100 bg-white">
                    {selectedProject.thumbUrl ? (
                      <Image
                        src={selectedProject.thumbUrl}
                        alt={`${selectedProject.title} 썸네일`}
                        className="h-full w-full object-cover"
                        width={48}
                        height={36}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-emerald-400">
                        썸네일
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold">{selectedProject.title}</p>
                    <p className="text-[11px] text-emerald-600">{selectedProject.authorName}</p>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-slate-400">선택된 작품이 없습니다.</p>
              )}
            </div>
          ) : null}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-slate-400">
            발표 중에도 상단 HUD에서 자동 넘김을 켜거나 끌 수 있습니다.
          </p>
          <button
            type="button"
            onClick={handleSave}
            disabled={!isDirty || saving}
            className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-[11px] font-semibold text-emerald-700 transition hover:border-emerald-300 hover:text-emerald-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-white disabled:text-slate-300"
          >
            {saving ? "저장 중..." : "설정 저장"}
          </button>
        </div>
        {error ? <p className="text-xs text-rose-600">{error}</p> : null}
        {notice ? <p className="text-xs text-emerald-600">{notice}</p> : null}
      </div>
      <div className="space-y-1">
        <p className="text-xs font-semibold text-slate-700">발표용 짧은 링크</p>
        <p className="text-[11px] text-slate-500">이 링크는 발표용입니다. 유출되면 재발급하세요.</p>
      </div>
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 text-xs text-slate-600">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-slate-400">
            링크를 만들면 바로 복사됩니다. 발표 화면으로 바로 이동합니다.
          </p>
          <button
            type="button"
            onClick={handleEnsureLink}
            disabled={linkBusy}
            className="rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-[11px] font-semibold text-indigo-700 transition hover:border-indigo-300 hover:text-indigo-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-white disabled:text-slate-300"
          >
            {linkBusy ? "만드는 중..." : "발표 링크 만들기/복사"}
          </button>
        </div>
        {linkUrl ? (
          <div className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="break-all text-[11px] font-semibold text-slate-700">{linkUrl}</p>
            <div className="flex items-center gap-3">
              <LinkCopyButton value={linkUrl} label="복사" />
              <button
                type="button"
                onClick={handleRotateLink}
                disabled={linkBusy}
                className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 disabled:cursor-not-allowed disabled:text-slate-300"
              >
                재발급
              </button>
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-slate-400">아직 링크가 없습니다.</p>
        )}
        {linkError ? <p className="text-xs text-rose-600">{linkError}</p> : null}
        {linkNotice ? <p className="text-xs text-emerald-600">{linkNotice}</p> : null}
      </div>
    </div>
  );
}
