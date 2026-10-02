"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import { buttonTone, cn, hairlineBorderClass, tvText } from "@/app/_components/uiTokens";
import { boardRemoteHref } from "@/lib/dashboard/boardHrefs";
import { publishDashboardInvalidate } from "@/lib/dashboard/invalidation";
import { buildJoinUrl, buildPresentUrl, buildShareUrl, buildShowUrl, buildStudentUrl } from "@/lib/http/publicLinks";

import { pushDashboardToast, useDashboardToasts } from "../../../useDashboardToast";
import { VIBE_LAUNCHPAD_COPY } from "@/lib/edu/vibe-coding/lesson-03-04-launchpad-copy";
import { useLaunchpadHotkeys } from "./useLaunchpadHotkeys";

type LaunchpadSession = {
  id: string;
  startedAt: string;
  endedAt: string | null;
};

type ChecklistState = Record<string, boolean>;

type LaunchpadClientProps = {
  classId: string;
  classTitle: string;
  classShortCode: string | null;
  activeBoardId: string | null;
  activeBoardTitle: string | null;
  initialShareCode: string | null;
  initialSession: LaunchpadSession | null;
  activeLessonTemplateId?: string | null;
};

const CHECKLIST_VERSION = "v1" as const;

export default function LaunchpadClient({
  classId,
  classTitle,
  classShortCode,
  activeBoardId,
  activeBoardTitle,
  initialShareCode,
  initialSession,
  activeLessonTemplateId,
}: LaunchpadClientProps) {
  const [session, setSession] = useState<LaunchpadSession | null>(initialSession);
  const [currentLessonTemplateId, setCurrentLessonTemplateId] = useState<string | null>(activeLessonTemplateId ?? null);
  const [selectedLessonTemplateId, setSelectedLessonTemplateId] = useState<string>(activeLessonTemplateId ?? "");
  const [shareCode, setShareCode] = useState<string | null>(initialShareCode);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistState>({});
  const toasts = useDashboardToasts();

  const studentUrl = useMemo(() => {
    if (classShortCode) {
      return buildStudentUrl(`/k/${classShortCode}`);
    }

    if (shareCode) {
      return buildShareUrl(shareCode);
    }

    return null;
  }, [classShortCode, shareCode]);

  const entryUrl = useMemo(() => buildJoinUrl(), []);
  const presentUrl = useMemo(() => (shareCode ? buildPresentUrl(shareCode) : null), [shareCode]);
  const showUrl = useMemo(() => (shareCode ? buildShowUrl(shareCode) : null), [shareCode]);
  const remoteUrl = useMemo(() => (activeBoardId ? boardRemoteHref(activeBoardId) : null), [activeBoardId]);

  const reportUrl = useMemo(
    () => (session ? `/dashboard/classes/${classId}/sessions/${session.id}/report` : null),
    [classId, session],
  );

  const archiveUrl = useMemo(() => `/dashboard/classes/${classId}`, [classId]);

  const checklistKey = useMemo(
    () => `gomdory:launchpad:check:${CHECKLIST_VERSION}:${classId}`,
    [classId],
  );

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(checklistKey);
      if (raw) {
        const parsed = JSON.parse(raw) as ChecklistState;
        setChecklist(parsed ?? {});
      }
    } catch {
      setChecklist({});
    }
  }, [checklistKey]);

  useEffect(() => {
    if (!qrOpen || !studentUrl) return;
    let cancelled = false;

    const generateQr = async () => {
      try {
        const { toDataURL } = await import("qrcode");
        const dataUrl = await toDataURL(studentUrl);
        if (cancelled) return;
        setQrDataUrl(dataUrl);
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "QR 코드를 생성하지 못했습니다.";
        setQrError(message);
      }
    };

    void generateQr();

    return () => {
      cancelled = true;
    };
  }, [qrOpen, studentUrl]);

  const statusBadge = session && !session.endedAt ? "live" : "idle";

  const toggleChecklist = (key: string, nextValue: boolean) => {
    setChecklist((prev) => {
      const next = { ...prev, [key]: nextValue };
      try {
        window.localStorage.setItem(checklistKey, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const handleCopyLink = async () => {
    if (!studentUrl) return;
    try {
      await navigator.clipboard.writeText(studentUrl);
      pushDashboardToast({ title: "학생 링크를 복사했어요", description: studentUrl });
      toggleChecklist("link", true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "링크를 복사하지 못했습니다.";
      pushDashboardToast({ title: "링크 복사 실패", description: message });
    }
  };

  const handleToggleQr = () => {
    if (!studentUrl) return;
    setQrOpen((prev) => !prev);
    toggleChecklist("qr", true);
  };

  const handleOpenHud = () => {
    if (!presentUrl) return;
    window.open(presentUrl, "_blank", "noopener");
    toggleChecklist("hud", true);
  };

  const handleOpenShow = () => {
    if (!showUrl) return;
    window.open(showUrl, "_blank", "noopener");
    toggleChecklist("projector", true);
  };

  const handleOpenRemote = () => {
    if (!remoteUrl) return;
    window.open(remoteUrl, "_blank", "noopener");
    toggleChecklist("remote", true);
  };

  const handleToggleSession = async () => {
    if (session && !session.endedAt) {
      await handleEndSession();
    } else {
      await handleStartSession();
    }
  };

  const handleStartSession = async () => {
    if (!activeBoardId) {
      pushDashboardToast({ title: "활성 보드를 선택해주세요." });
      return;
    }

    setIsStarting(true);
    try {
      const response = await fetch(apiV1Path(`classes/${classId}/sessions/start`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardId: activeBoardId, lessonTemplateId: selectedLessonTemplateId || null }),
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            sessionId?: string;
            shareCode?: string;
            studentUrl?: string;
            presentUrl?: string | null;
            boardId?: string;
            lessonTemplateId?: string | null;
          }
        | { error?: string }
        | null;

      const sessionId =
        payload && typeof payload === "object" && "sessionId" in payload && typeof payload.sessionId === "string"
          ? payload.sessionId
          : null;

      if (!response.ok || !sessionId) {
        const message =
          payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "수업을 시작하지 못했습니다.";
        throw new Error(message);
      }

      const nextShareCode =
        payload && typeof payload === "object" && "shareCode" in payload && typeof payload.shareCode === "string"
          ? payload.shareCode
          : shareCode;
      if (nextShareCode) {
        setShareCode(nextShareCode);
      }
      const nextLessonTemplateId =
        payload && typeof payload === "object" && "lessonTemplateId" in payload
          ? typeof payload.lessonTemplateId === "string"
            ? payload.lessonTemplateId
            : null
          : selectedLessonTemplateId || null;
      setCurrentLessonTemplateId(nextLessonTemplateId);
      setSelectedLessonTemplateId(nextLessonTemplateId ?? "");
      setSession({ id: sessionId, startedAt: new Date().toISOString(), endedAt: null });
      pushDashboardToast({ title: "수업이 시작됐어요" });
      publishDashboardInvalidate({
        type: "boards_changed",
        reason: "updated",
        ts: Date.now(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "수업을 시작하지 못했습니다.";
      pushDashboardToast({ title: "수업 시작 실패", description: message });
    } finally {
      setIsStarting(false);
    }
  };

  const handleEndSession = async () => {
    if (!session) return;
    setIsEnding(true);
    try {
      const response = await fetch(apiV1Path(`classes/${classId}/sessions/${session.id}/end`), {
        method: "POST",
      });

      const payload = (await response.json().catch(() => null)) as
        | { session?: { id: string; ended_at: string | null } }
        | { error?: string }
        | null;

      if (!response.ok) {
        const message =
          payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "수업을 종료하지 못했습니다.";
        throw new Error(message);
      }

      const endedAt =
        payload && typeof payload === "object" && "session" in payload && payload.session
          ? (payload.session as { ended_at: string | null }).ended_at ?? new Date().toISOString()
          : new Date().toISOString();
      setSession((prev) => (prev ? { ...prev, endedAt } : prev));
      pushDashboardToast({ title: "수업이 종료됐어요" });
      publishDashboardInvalidate({
        type: "boards_changed",
        reason: "updated",
        ts: Date.now(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "수업을 종료하지 못했습니다.";
      pushDashboardToast({ title: "수업 종료 실패", description: message });
    } finally {
      setIsEnding(false);
    }
  };

  useLaunchpadHotkeys({
    onToggleSession: handleToggleSession,
    onCopyLink: handleCopyLink,
    onToggleQr: handleToggleQr,
    onOpenHud: handleOpenHud,
    onOpenRemote: handleOpenRemote,
    enabled: Boolean(studentUrl),
  });

  useEffect(() => {
    if (!qrOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setQrOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [qrOpen]);


  const showVibeCodingPanel =
    currentLessonTemplateId === "lesson_03_vibe_app_planning" ||
    currentLessonTemplateId === "lesson_04_vibe_app_prototype_share";

  const handleCopyText = async (title: string, text: string, checklistKeyName?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      pushDashboardToast({ title, description: "클립보드에 복사했어요." });
      if (checklistKeyName) toggleChecklist(checklistKeyName, true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "복사하지 못했습니다.";
      pushDashboardToast({ title: "복사 실패", description: message });
    }
  };

  const handleOpenVibeLink = (url: string, checklistKeyName?: string) => {
    window.open(url, "_blank", "noopener");
    if (checklistKeyName) toggleChecklist(checklistKeyName, true);
  };

  const checklistItems: Array<{ key: string; label: string; action: () => void; done: boolean }> = [
    { key: "link", label: "학생 링크/QR 확인", action: handleCopyLink, done: checklist.link ?? false },
    { key: "qr", label: "QR 확인", action: handleToggleQr, done: checklist.qr ?? false },
    { key: "projector", label: "프로젝터 화면 열기", action: handleOpenShow, done: checklist.projector ?? false },
    { key: "hud", label: "HUD 열기", action: handleOpenHud, done: checklist.hud ?? false },
    { key: "remote", label: "Remote 열기", action: handleOpenRemote, done: checklist.remote ?? false },
  ];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-10">
      <div className="fixed inset-x-0 top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-indigo-500">Class Launchpad</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
              <span className="truncate">{classTitle}</span>
              {activeBoardTitle ? <span className="text-slate-500">· {activeBoardTitle}</span> : null}
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold",
                  statusBadge === "live"
                    ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                    : "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
                )}
              >
                {statusBadge === "live" ? "진행중" : "대기"}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <HeaderAction icon="🔗" label="링크 복사" onClick={handleCopyLink} disabled={!studentUrl} />
            <HeaderAction icon="🔳" label="QR 보기" onClick={handleToggleQr} disabled={!studentUrl} />
            <HeaderAction icon="📺" label="프로젝터" onClick={handleOpenShow} disabled={!showUrl} />
            <HeaderAction icon="🖥️" label="HUD" onClick={handleOpenHud} disabled={!presentUrl} />
            <HeaderAction icon="🎛️" label="리모컨" onClick={handleOpenRemote} disabled={!remoteUrl} />
          </div>
        </div>
      </div>

      <div className="pt-20" />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-3 rounded-2xl border border-slate-200 bg-white p-3">
            <label htmlFor="lesson-template-selector" className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
              수업 템플릿 선택
            </label>
            <select
              id="lesson-template-selector"
              value={selectedLessonTemplateId}
              onChange={(event) => setSelectedLessonTemplateId(event.target.value)}
              className="mt-2 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
            >
              <option value="">일반 수업 / 템플릿 없음</option>
              <option value="lesson_03_vibe_app_planning">3차시: Gemini로 AI 웹앱 기획과 프롬프트 설계</option>
              <option value="lesson_04_vibe_app_prototype_share">4차시: Lovable 프로토타입 제작과 제출</option>
            </select>
          </div>
          <button
            type="button"
            onClick={handleToggleSession}
            disabled={isStarting || isEnding || !activeBoardId}
            className={cn(
              buttonTone("primary", { size: "lg", tone: session && !session.endedAt ? "rose" : "indigo", fullWidth: true }),
              "min-h-[96px] text-xl",
            )}
          >
            {session && !session.endedAt
              ? isEnding
                ? "수업 종료 중..."
                : "수업 종료"
              : isStarting
                ? "수업 시작 중..."
                : "수업 시작"}
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <SecondaryButton label="학생 링크 복사" onClick={handleCopyLink} disabled={!studentUrl} />
          <SecondaryButton label="QR 전체화면" onClick={handleToggleQr} disabled={!studentUrl} />
          <SecondaryButton label="프로젝터 보기" onClick={handleOpenShow} disabled={!showUrl} />
          <SecondaryButton label="교사용 HUD 열기" onClick={handleOpenHud} disabled={!presentUrl} />
          <SecondaryButton label="Teacher Remote 열기" onClick={handleOpenRemote} disabled={!remoteUrl} />
          <SecondaryButton label="리포트 열기" onClick={() => reportUrl && window.open(reportUrl, "_blank", "noopener")} disabled={!reportUrl} />
          <SecondaryButton label="아카이브/회차 보기" onClick={() => window.open(archiveUrl, "_blank", "noopener")} />
        </div>
      </div>



      {showVibeCodingPanel ? (
        <div className="rounded-3xl border border-indigo-200 bg-indigo-50/60 p-5">
          <p className="text-lg font-semibold text-slate-900">바이브코딩 3/4차시 도구</p>
          <p className="mt-1 text-sm text-slate-600">Gemini로 기획하고 Lovable로 제작합니다. Canva/Bolt/Replit/v0는 백업 도구입니다.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <SecondaryButton label="강의자료 열기" onClick={() => handleOpenVibeLink("/edu/vibe-coding/lesson-03-04", "vibe_lesson_opened")} />
            <SecondaryButton label="학생 입장 링크 복사" onClick={handleCopyLink} disabled={!studentUrl} />
            <SecondaryButton label="Gemini 열기" onClick={() => handleOpenVibeLink("https://gemini.google.com/", "vibe_gemini_opened")} />
            <SecondaryButton label="Lovable 열기" onClick={() => handleOpenVibeLink("https://lovable.dev/", "vibe_lovable_opened")} />
            <SecondaryButton label="Canva 열기 (시안 대체)" onClick={() => handleOpenVibeLink("https://www.canva.com/", "vibe_canva_opened")} />
            <SecondaryButton label="Bolt 열기" onClick={() => handleOpenVibeLink("https://bolt.new/", "vibe_bolt_opened")} />
            <SecondaryButton label="Replit 열기" onClick={() => handleOpenVibeLink("https://replit.com/", "vibe_replit_opened")} />
            <SecondaryButton label="v0 열기" onClick={() => handleOpenVibeLink("https://v0.dev/", "vibe_v0_opened")} />
            <SecondaryButton
              label="3차시 제출 안내 복사"
              onClick={() => handleCopyText("3차시 제출 안내 복사 완료", VIBE_LAUNCHPAD_COPY.lesson03Submission, "vibe_submission_instruction_copied")}
            />
            <SecondaryButton
              label="4차시 제출 안내 복사"
              onClick={() => handleCopyText("4차시 제출 안내 복사 완료", VIBE_LAUNCHPAD_COPY.lesson04Submission, "vibe_submission_instruction_copied")}
            />
            <SecondaryButton
              label="개인정보 주의문 복사"
              onClick={() => handleCopyText("개인정보 주의문 복사 완료", VIBE_LAUNCHPAD_COPY.privacyWarning, "vibe_privacy_copied")}
            />
            <SecondaryButton
              label="실패 기록 안내 복사"
              onClick={() => handleCopyText("실패 기록 안내 복사 완료", VIBE_LAUNCHPAD_COPY.fallbackInstruction, "vibe_fallback_ready")}
            />
          </div>
        </div>
      ) : null}

      <div className={cn("grid gap-4 lg:grid-cols-[1.8fr,1fr]", tvText.body)}>
        <div className={cn("rounded-3xl bg-slate-900/95 p-6 text-white", hairlineBorderClass)}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-slate-200/80">수업 전 30초 체크</p>
              <p className="mt-1 text-2xl font-semibold">Launchpad Checklist</p>
            </div>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">{classTitle}</span>
          </div>
          <div className="mt-5 space-y-3">
            {checklistItems.map((item) => (
              <div
                key={item.key}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/5 px-4 py-3 ring-1 ring-white/10"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold",
                      item.done ? "bg-emerald-400/90 text-emerald-900" : "bg-white/20 text-white",
                    )}
                    aria-hidden
                  >
                    {item.done ? "✓" : ""}
                  </span>
                  <span className="text-base font-semibold">{item.label}</span>
                </div>
                <button
                  type="button"
                  onClick={() => item.action()}
                  className={cn(
                    buttonTone("secondary", { size: "sm", muted: true }),
                    "bg-white/10 text-white hover:bg-white/20",
                  )}
                >
                  바로 실행
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-lg">
          <p className="text-sm font-semibold text-slate-900">학생 링크</p>
          <p className="mt-1 text-xs text-slate-500">gkrry.com 기반 단축 링크만 노출합니다.</p>
          <div className="mt-4 flex flex-col gap-3">
            <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">링크</p>
          <div className="space-y-1 text-base font-semibold text-slate-900">
            <p className="text-sm text-slate-500">학생 접속(코드 입력)</p>
            <p className="break-all">{entryUrl}</p>
            <p className="pt-2 text-sm text-slate-500">학생 바로 입장</p>
            <p className="break-all">{studentUrl ?? "링크 없음"}</p>
          </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-slate-600">
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-center">S: 시작/종료</div>
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-center">L: 링크 복사</div>
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-center">Q: QR 토글</div>
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-center">H/R: HUD / Remote</div>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-6 right-6 z-40 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-xl"
          >
            <p className="text-sm font-semibold text-slate-900">{toast.title}</p>
            {toast.description ? <p className="text-xs text-slate-600">{toast.description}</p> : null}
          </div>
        ))}
      </div>

      {qrOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-6" role="dialog" aria-modal>
          <button type="button" className="absolute inset-0" aria-label="닫기" onClick={() => setQrOpen(false)} />
          <div className="relative z-10 w-full max-w-3xl rounded-3xl bg-white p-8 shadow-2xl">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.26em] text-indigo-500">학생 QR</p>
                <p className="text-2xl font-semibold text-slate-900">프로젝터/TV에서도 바로 스캔</p>
              </div>
              <button
                type="button"
                onClick={() => setQrOpen(false)}
                className={cn(buttonTone("secondary", { size: "sm" }), "min-w-[96px]")}
              >
                닫기 (Esc)
              </button>
            </div>
            <div className="mt-6 flex flex-col items-center gap-4">
              {qrError ? <p className="text-sm text-rose-600">{qrError}</p> : null}
              {qrDataUrl ? (
                <Image
                  src={qrDataUrl}
                  alt="학생 링크 QR"
                  width={360}
                  height={360}
                  unoptimized
                  className="h-auto w-72"
                />
              ) : (
                <p className="text-sm text-slate-500">QR 코드를 생성하는 중...</p>
              )}
              <div className="text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  학생 바로 입장
                </p>
                <p className="text-2xl font-semibold tracking-tight text-slate-900">
                  {studentUrl ? studentUrl.replace(/^https?:\/\//, "") : "링크 없음"}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SecondaryButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        buttonTone("secondary", { size: "md", fullWidth: true }),
        "min-h-[56px] justify-start text-base",
        disabled ? "cursor-not-allowed opacity-60" : null,
      )}
    >
      {label}
    </button>
  );
}

function HeaderAction({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        buttonTone("secondary", { size: "sm", muted: true }),
        "min-h-[44px] items-center gap-2 px-3 text-sm",
        disabled ? "cursor-not-allowed opacity-60" : null,
      )}
    >
      <span aria-hidden>{icon}</span>
      <span>{label}</span>
    </button>
  );
}
