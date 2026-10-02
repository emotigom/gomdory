"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import { buttonTone, cn } from "@/app/_components/uiTokens";
import type { ClassBoardSummary, ClassSummary } from "@/lib/data/classes";
import { buildJoinUrl, buildShareUrl } from "@/lib/http/publicLinks";
import { getProjectorUrl, getStudentUrl } from "@/lib/share/shareUrls";
import { publishDashboardInvalidate } from "@/lib/dashboard/invalidation";
import { pushDashboardToast, useDashboardToasts } from "@/app/dashboard/useDashboardToast";
import { BoardForm } from "@/app/dashboard/BoardForm";
import ClassLinkBlock from "@/app/dashboard/_components/ClassLinkBlock";
import ShareLinkBlock from "@/app/dashboard/_components/ShareLinkBlock";
import LinkQrModal from "@/app/dashboard/_components/LinkQrModal";

type ClassDetailClientProps = {
  classInfo: ClassSummary;
  initialBoards: ClassBoardSummary[];
};

type SectionSummary = {
  id: string;
  title: string;
  sort_index: number;
  created_at: string;
};

type SessionSummary = {
  id: string;
  board_id: string;
  share_code: string;
  title: string | null;
  started_at: string;
  ended_at: string | null;
  section_id: string | null;
};

type StartSessionPayload = {
  sessionId: string;
  shareCode: string;
  studentUrl: string;
  presentUrl?: string | null;
  boardId: string;
  sectionId?: string | null;
};

export default function ClassDetailClient({ classInfo, initialBoards }: ClassDetailClientProps) {
  const [boards] = useState<ClassBoardSummary[]>(initialBoards);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(classInfo.active_board_id);
  const [pendingBoardId, setPendingBoardId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"boards" | "archive">("boards");
  const [sections, setSections] = useState<SectionSummary[]>([]);
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [sectionsError, setSectionsError] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [sessionsCursor, setSessionsCursor] = useState<string | null>(null);
  const [sessionsHasMore, setSessionsHasMore] = useState(true);
  const [startLoading, setStartLoading] = useState(false);
  const [startPayload, setStartPayload] = useState<StartSessionPayload | null>(null);
  const [presentQrOpen, setPresentQrOpen] = useState(false);
  const toasts = useDashboardToasts();

  const studentLink = useMemo(() => {
    const activeBoard = boards.find((board) => board.id === classInfo.active_board_id);
    const shareCode =
      (activeBoard?.share_enabled ? activeBoard?.share_code : null) ??
      boards.find((board) => board.share_enabled && board.share_code)?.share_code ??
      null;

    if (shareCode) {
      return buildShareUrl(shareCode);
    }

    return buildJoinUrl();
  }, [boards, classInfo.active_board_id]);

  const boardTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    boards.forEach((board) => map.set(board.id, board.title));
    return map;
  }, [boards]);

  const toastStack = (
    <div className="fixed bottom-6 right-6 z-50 space-y-3">
      {toasts.map((toast) => (
        <div key={toast.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-lg">
          <p className="text-sm font-semibold text-gray-900">{toast.title}</p>
          {toast.description ? <p className="text-xs text-gray-600">{toast.description}</p> : null}
        </div>
      ))}
    </div>
  );

  const presentLink = startPayload?.presentUrl ?? null;

  const handleSetActiveBoard = useCallback(
    async (boardId: string) => {
      if (pendingBoardId) return;
      const previousId = activeBoardId;
      setActiveBoardId(boardId);
      setPendingBoardId(boardId);

      try {
        const response = await fetch(apiV1Path(`classes/${classInfo.id}/active`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ activeBoardId: boardId }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          const message =
            payload && typeof payload === "object" && payload && "error" in payload && typeof payload.error === "string"
              ? payload.error
              : "활성 보드를 변경하지 못했습니다.";
          throw new Error(message);
        }

        publishDashboardInvalidate({
          type: "boards_changed",
          reason: "updated",
          ts: Date.now(),
        });
      } catch (error) {
        setActiveBoardId(previousId);
        const message = error instanceof Error ? error.message : "활성 보드를 변경하지 못했습니다.";
        pushDashboardToast({
          title: "활성 보드를 변경하지 못했습니다.",
          description: message,
        });
      } finally {
        setPendingBoardId(null);
      }
    },
    [activeBoardId, classInfo.id, pendingBoardId],
  );

  const loadSections = useCallback(async () => {
    setSectionsLoading(true);
    setSectionsError(null);
    try {
      const response = await fetch(apiV1Path(`classes/${classInfo.id}/sections`), { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as
        | { ok: true; data: { sections: SectionSummary[] } }
        | { ok?: false; error?: { message?: string } }
        | null;
      if (!response.ok || payload?.ok !== true) {
        const message =
          payload && payload.ok === false && payload.error?.message
            ? payload.error.message
            : "단원 목록을 불러오지 못했습니다.";
        throw new Error(message);
      }
      const nextSections = payload.data.sections ?? [];
      setSections(nextSections);
      setSelectedSectionId((current) => {
        if (current && nextSections.some((section) => section.id === current)) {
          return current;
        }
        return nextSections[0]?.id ?? null;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "단원 목록을 불러오지 못했습니다.";
      setSectionsError(message);
    } finally {
      setSectionsLoading(false);
    }
  }, [classInfo.id]);

  const loadSessions = useCallback(
    async (options?: { reset?: boolean; sectionId?: string | null }) => {
      const reset = options?.reset ?? false;
      const sectionId = options?.sectionId ?? selectedSectionId;
      const cursorValue = reset ? null : sessionsCursor;
      setSessionsLoading(true);
      setSessionsError(null);
      try {
        const params = new URLSearchParams();
        params.set("limit", "20");
        if (cursorValue) {
          params.set("cursor", cursorValue);
        }
        if (sectionId) {
          params.set("sectionId", sectionId);
        } else {
          params.set("sectionId", "unassigned");
        }

        const response = await fetch(apiV1Path(`classes/${classInfo.id}/sessions?${params.toString()}`), {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as
          | { ok: true; data: { sessions: SessionSummary[]; nextCursor: string | null } }
          | { ok?: false; error?: { message?: string } }
          | null;
        if (!response.ok || payload?.ok !== true) {
          const message =
            payload && payload.ok === false && payload.error?.message
              ? payload.error.message
              : "회차 목록을 불러오지 못했습니다.";
          throw new Error(message);
        }
        const nextSessions = payload.data.sessions ?? [];
        setSessions((current) => (reset ? nextSessions : [...current, ...nextSessions]));
        setSessionsCursor(payload.data.nextCursor ?? null);
        setSessionsHasMore(Boolean(payload.data.nextCursor));
      } catch (error) {
        const message = error instanceof Error ? error.message : "회차 목록을 불러오지 못했습니다.";
        setSessionsError(message);
      } finally {
        setSessionsLoading(false);
      }
    },
    [classInfo.id, selectedSectionId, sessionsCursor],
  );

  const handleAddSection = useCallback(async () => {
    const title = window.prompt("새 단원 이름을 입력하세요.")?.trim() ?? "";
    if (!title) return;
    try {
      const response = await fetch(apiV1Path(`classes/${classInfo.id}/sections`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, sortIndex: sections.length }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok: true; data: { section: SectionSummary } }
        | { ok?: false; error?: { message?: string } }
        | null;
      if (!response.ok || payload?.ok !== true) {
        const message =
          payload && payload.ok === false && payload.error?.message
            ? payload.error.message
            : "단원을 추가하지 못했습니다.";
        throw new Error(message);
      }
      setSections((current) => [...current, payload.data.section]);
      setSelectedSectionId(payload.data.section.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "단원을 추가하지 못했습니다.";
      pushDashboardToast({ title: "단원을 추가하지 못했습니다.", description: message });
    }
  }, [classInfo.id, sections.length]);

  const handleRenameSection = useCallback(
    async (section: SectionSummary) => {
      const title = window.prompt("단원 이름을 수정하세요.", section.title)?.trim() ?? "";
      if (!title || title === section.title) return;
      try {
        const response = await fetch(apiV1Path(`classes/${classInfo.id}/sections/${section.id}`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        });
        const payload = (await response.json().catch(() => null)) as
          | { ok: true; data: { section: SectionSummary } }
          | { ok?: false; error?: { message?: string } }
          | null;
        if (!response.ok || payload?.ok !== true) {
          const message =
            payload && payload.ok === false && payload.error?.message
              ? payload.error.message
              : "단원을 수정하지 못했습니다.";
          throw new Error(message);
        }
        setSections((current) => current.map((item) => (item.id === section.id ? payload.data.section : item)));
      } catch (error) {
        const message = error instanceof Error ? error.message : "단원을 수정하지 못했습니다.";
        pushDashboardToast({ title: "단원을 수정하지 못했습니다.", description: message });
      }
    },
    [classInfo.id],
  );

  const handleMoveSection = useCallback(
    async (section: SectionSummary, direction: "up" | "down") => {
      const index = sections.findIndex((item) => item.id === section.id);
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (index < 0 || targetIndex < 0 || targetIndex >= sections.length) return;
      const target = sections[targetIndex];
      try {
        const response = await fetch(apiV1Path(`classes/${classInfo.id}/sections/${section.id}`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sortIndex: target.sort_index }),
        });
        const responseTarget = await fetch(apiV1Path(`classes/${classInfo.id}/sections/${target.id}`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sortIndex: section.sort_index }),
        });
        const payload = (await response.json().catch(() => null)) as
          | { ok: true; data: { section: SectionSummary } }
          | { ok?: false; error?: { message?: string } }
          | null;
        const payloadTarget = (await responseTarget.json().catch(() => null)) as
          | { ok: true; data: { section: SectionSummary } }
          | { ok?: false; error?: { message?: string } }
          | null;
        if (!response.ok || payload?.ok !== true || !responseTarget.ok || payloadTarget?.ok !== true) {
          throw new Error("순서를 변경하지 못했습니다.");
        }
        const next = sections.map((item) => {
          if (item.id === section.id) return payload.data.section;
          if (item.id === target.id) return payloadTarget.data.section;
          return item;
        });
        setSections(next.sort((a, b) => a.sort_index - b.sort_index || a.created_at.localeCompare(b.created_at)));
      } catch (error) {
        const message = error instanceof Error ? error.message : "순서를 변경하지 못했습니다.";
        pushDashboardToast({ title: "순서를 변경하지 못했습니다.", description: message });
      }
    },
    [classInfo.id, sections],
  );

  const handleStartSession = useCallback(async () => {
    if (!activeBoardId) {
      pushDashboardToast({
        title: "활성 보드를 먼저 선택하세요.",
        description: "수업을 시작하려면 활성 보드를 지정해야 합니다.",
      });
      return;
    }

    setStartLoading(true);
    try {
      const response = await fetch(apiV1Path(`classes/${classInfo.id}/sessions/start`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardId: activeBoardId, sectionId: selectedSectionId }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok: true; data: StartSessionPayload }
        | { ok?: false; error?: { message?: string } }
        | null;
      if (!response.ok || payload?.ok !== true) {
        const message =
          payload && payload.ok === false && payload.error?.message
            ? payload.error.message
            : "수업을 시작하지 못했습니다.";
        throw new Error(message);
      }
      setStartPayload(payload.data);
      pushDashboardToast({
        title: "수업이 시작되었습니다.",
        description: "학생 링크와 HUD 버튼을 확인하세요.",
      });
      if (activeTab === "archive") {
        void loadSessions({ reset: true, sectionId: selectedSectionId });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "수업을 시작하지 못했습니다.";
      pushDashboardToast({ title: "수업을 시작하지 못했습니다.", description: message });
    } finally {
      setStartLoading(false);
    }
  }, [activeBoardId, activeTab, classInfo.id, loadSessions, selectedSectionId]);

  const handleSelectSection = useCallback(
    (sectionId: string | null) => {
      setSelectedSectionId(sectionId);
      setSessions([]);
      setSessionsCursor(null);
      setSessionsHasMore(true);
      void loadSessions({ reset: true, sectionId });
    },
    [loadSessions],
  );

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10">
      {toastStack}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-500">Class Hub</p>
            <h1 className="text-2xl font-semibold text-gray-900">{classInfo.title}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/dashboard/classes/${classInfo.id}/metaverse`}
              className={buttonTone("secondary", { size: "sm" })}
            >
              Metaverse progress
            </Link>
            <Link
              href={`/dashboard/classes/${classInfo.id}/launch`}
              className={buttonTone("primary", { size: "sm", tone: "slate" })}
            >
              수업 시작(Launchpad)
            </Link>
            <Link href="/dashboard" className={buttonTone("secondary", { size: "sm" })}>
              대시보드로 돌아가기
            </Link>
          </div>
        </div>
        <ClassLinkBlock link={studentLink} />
      </div>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-emerald-100 bg-emerald-50/80 px-5 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">Class Session</p>
            <h2 className="text-2xl font-semibold text-slate-900">수업 시작</h2>
            <p className="text-sm text-emerald-800">
              활성 보드를 기준으로 회차가 자동 기록됩니다. 준비가 되면 바로 시작하세요.
            </p>
          </div>
          <button
            type="button"
            onClick={handleStartSession}
            disabled={startLoading || !activeBoardId}
            className={buttonTone("primary", { size: "lg", tone: "emerald" })}
          >
            {startLoading ? "수업 시작 중..." : "수업 시작"}
          </button>
        </div>
        {startPayload ? (
          <div className="grid gap-3 lg:grid-cols-[2fr,1fr]">
            <ShareLinkBlock shareUrl={startPayload.studentUrl} previewHref={startPayload.studentUrl} />
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
              <p className="text-sm font-semibold text-slate-900">수업 HUD</p>
              <p className="mt-1 text-xs text-slate-500">발표 화면을 바로 열어 학생 화면과 연결하세요.</p>
              <div className="mt-4 flex flex-col gap-2">
                {startPayload.presentUrl ? (
                  <a
                    href={startPayload.presentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={buttonTone("primary", { size: "md", tone: "slate" })}
                  >
                    발표(HUD) 열기
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    className={cn(buttonTone("secondary", { size: "md" }), "cursor-not-allowed opacity-70")}
                  >
                    발표(HUD) 준비중
                  </button>
                )}
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs font-semibold text-slate-500">발표 링크</p>
                  <p className="break-all text-sm font-semibold text-slate-900">
                    {startPayload.presentUrl ?? "링크 준비중"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!startPayload.presentUrl) return;
                    setPresentQrOpen(true);
                  }}
                  disabled={!startPayload.presentUrl}
                  className={cn(buttonTone("secondary", { size: "sm" }), "justify-center")}
                >
                  QR 보기
                </button>
                <p className="text-xs text-slate-500">
                  {startPayload.boardId ? `활성 보드: ${boardTitleMap.get(startPayload.boardId) ?? "선택됨"}` : null}
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setActiveTab("boards")}
            className={cn(
              "flex-1 rounded-2xl px-4 py-2 text-sm font-semibold transition",
              activeTab === "boards" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50",
            )}
          >
            보드
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("archive");
              setSessions([]);
              setSessionsCursor(null);
              setSessionsHasMore(true);
              if (!sections.length) {
                void loadSections();
              }
              void loadSessions({ reset: true, sectionId: selectedSectionId });
            }}
            className={cn(
              "flex-1 rounded-2xl px-4 py-2 text-sm font-semibold transition",
              activeTab === "archive" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50",
            )}
          >
            아카이브
          </button>
        </div>

        {activeTab === "boards" ? (
          <>
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">클래스 보드</h2>
                  <p className="text-sm text-gray-600">학생들은 항상 같은 클래스 코드로 접속합니다.</p>
                </div>
                <span className="text-xs font-semibold text-slate-600">총 {boards.length}개</span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {boards.length > 0 ? (
                  boards.map((board) => {
                    const isActive = board.id === activeBoardId;
                    const isPending = pendingBoardId === board.id;

                    return (
                      <div
                        key={board.id}
                        className={cn(
                          "rounded-2xl border px-4 py-4 shadow-sm",
                          isActive ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-white",
                        )}
                      >
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{board.title}</p>
                              <p className="text-xs text-slate-500">
                                {board.share_enabled && board.share_code
                                  ? `학생 코드: ${board.share_code}`
                                  : "학생 코드 미설정"}
                              </p>
                            </div>
                            {isActive ? (
                              <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">
                                활성 보드
                              </span>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleSetActiveBoard(board.id)}
                            disabled={isActive || Boolean(pendingBoardId)}
                            className={cn(
                              buttonTone("secondary", { size: "sm" }),
                              isActive ? "cursor-default border-emerald-200 text-emerald-700" : "",
                            )}
                          >
                            {isPending ? "변경 중..." : isActive ? "활성 보드 설정됨" : "활성 보드로 설정"}
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
                    이 클래스에 연결된 보드가 없습니다. 아래에서 새 보드를 만들어 보세요.
                  </div>
                )}
              </div>
            </section>

            <section className="space-y-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">이 클래스에 새 보드 만들기</h2>
                <p className="text-sm text-gray-600">새 보드를 추가하면 자동으로 이 클래스에 연결됩니다.</p>
              </div>
                <BoardForm
                  onCreated={() =>
                    publishDashboardInvalidate({
                      type: "boards_changed",
                      reason: "created",
                      ts: Date.now(),
                    })
                  }
                />
            </section>
          </>
        ) : (
          <section className="grid gap-4 lg:grid-cols-[1fr,2fr]">
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">단원</h3>
                  <p className="text-xs text-slate-500">수업 회차를 단원별로 분류하세요.</p>
                </div>
                <button
                  type="button"
                  onClick={handleAddSection}
                  className={buttonTone("secondary", { size: "sm" })}
                >
                  단원 추가
                </button>
              </div>
              {sectionsLoading ? <p className="text-xs text-slate-500">단원 불러오는 중...</p> : null}
              {sectionsError ? <p className="text-xs text-rose-600">{sectionsError}</p> : null}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => handleSelectSection(null)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm font-semibold",
                    selectedSectionId === null ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-slate-200",
                  )}
                >
                  <span>미분류</span>
                  <span className="text-xs text-slate-400">기본</span>
                </button>
                {sections.map((section) => (
                  <div key={section.id} className="rounded-xl border border-slate-200 p-3">
                    <button
                      type="button"
                      onClick={() => handleSelectSection(section.id)}
                      className={cn(
                        "flex w-full items-center justify-between text-left text-sm font-semibold",
                        selectedSectionId === section.id ? "text-indigo-700" : "text-slate-900",
                      )}
                    >
                      <span>{section.title}</span>
                      <span className="text-xs text-slate-400">순서 {section.sort_index + 1}</span>
                    </button>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleRenameSection(section)}
                        className={buttonTone("ghost", { size: "sm" })}
                      >
                        이름 변경
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveSection(section, "up")}
                        className={buttonTone("ghost", { size: "sm" })}
                      >
                        위로
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveSection(section, "down")}
                        className={buttonTone("ghost", { size: "sm" })}
                      >
                        아래로
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">회차 타임라인</h3>
                  <p className="text-xs text-slate-500">최근 수업 기록을 확인하세요.</p>
                </div>
                <button
                  type="button"
                  onClick={() => loadSessions({ reset: true, sectionId: selectedSectionId })}
                  className={buttonTone("secondary", { size: "sm" })}
                >
                  새로고침
                </button>
              </div>
              {sessionsLoading ? <p className="text-xs text-slate-500">회차 불러오는 중...</p> : null}
              {sessionsError ? <p className="text-xs text-rose-600">{sessionsError}</p> : null}
              {sessions.length === 0 && !sessionsLoading ? (
                <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                  아직 회차가 없습니다. 상단의 “수업 시작”으로 기록을 남겨보세요.
                </div>
              ) : null}
              <div className="space-y-3">
                {sessions.map((session) => {
                  const boardTitle = boardTitleMap.get(session.board_id) ?? "보드";
                  const shareUrl = session.share_code ? getStudentUrl(session.share_code) : null;
                  const presentUrl = session.share_code ? getProjectorUrl(session.share_code) : null;
                  const reportUrl = `/dashboard/classes/${classInfo.id}/sessions/${session.id}/report`;
                  const replayUrl = `/dashboard/boards/${session.board_id}/replay/${session.id}`;
                  const timeLabel = new Date(session.started_at).toLocaleString("ko-KR");

                  return (
                    <div key={session.id} className="rounded-2xl border border-slate-200 px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{session.title ?? "수업 기록"}</p>
                          <p className="text-xs text-slate-500">
                            {timeLabel} · {boardTitle}
                          </p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                          {session.ended_at ? "종료됨" : "진행 중"}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {shareUrl ? (
                          <a
                            href={shareUrl}
                            target="_blank"
                            rel="noreferrer"
                            className={buttonTone("secondary", { size: "sm" })}
                          >
                            학생 링크
                          </a>
                        ) : (
                          <button
                            type="button"
                            disabled
                            className={cn(buttonTone("secondary", { size: "sm" }), "cursor-not-allowed opacity-70")}
                          >
                            학생 링크 준비중
                          </button>
                        )}
                        {presentUrl ? (
                          <a
                            href={presentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className={buttonTone("secondary", { size: "sm" })}
                          >
                            발표/HUD
                          </a>
                        ) : null}
                        <Link href={reportUrl} className={buttonTone("secondary", { size: "sm" })}>
                          리포트
                        </Link>
                        <Link href={replayUrl} className={buttonTone("secondary", { size: "sm" })}>
                          리플레이/클립
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
              {sessionsHasMore ? (
                <button
                  type="button"
                  onClick={() => loadSessions({ reset: false, sectionId: selectedSectionId })}
                  disabled={sessionsLoading}
                  className={buttonTone("secondary", { size: "sm", fullWidth: true })}
                >
                  더보기
                </button>
              ) : null}
            </div>
          </section>
        )}
      </section>
      {presentLink ? (
        <LinkQrModal
          open={presentQrOpen}
          onClose={() => setPresentQrOpen(false)}
          title="발표 링크 QR"
          url={presentLink}
          description="프로젝터/발표 화면을 여는 전용 링크입니다."
        />
      ) : null}
    </main>
  );
}
