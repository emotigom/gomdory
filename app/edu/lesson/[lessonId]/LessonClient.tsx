"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import TurnstileWidget from "@/app/_components/TurnstileWidget";
import { type ChatPanelHandle } from "@/app/edu/_components/ChatPanel";
import BroadcastBanner from "@/app/edu/_components/BroadcastBanner";
import EduBadge from "@/app/edu/_components/EduBadge";
import HelpModal from "@/app/edu/_components/HelpModal";
import QualityChecklistModal from "@/app/edu/_components/QualityChecklistModal";
import RightSidebarCoach from "@/app/edu/_components/RightSidebarCoach";
import AiCoachPanel from "@/app/edu/_components/AiCoachPanel";
import Workspace from "@/app/edu/_components/Workspace";
import type { WorkspaceFile } from "@/app/edu/_components/Workspace";
import { postEduProgress, updateEduJoinSessionNickname } from "@/lib/edu/apiClient";
import { eduCopy } from "@/lib/edu/copy";
import {
  getEduBoardId,
  getEduProfile,
  getEduProgress,
  setEduBoardId,
  setEduProfile,
  setEduProgress,
} from "@/lib/edu/storage";
import { getLocalEduNickname, resolveEduNickname, setLocalEduNickname } from "@/app/edu/_utils/nickname";
import { analyzeFiles } from "@/lib/edu/quality/analyze";
import type { QualityResult } from "@/lib/edu/quality/analyze";
import { addH1, addTitle, ensureAccentCss, ensureTwoSections } from "@/lib/edu/quality/fixes";
import { extractTitleHintsFromHtml, makeEduThumbnailBlob } from "@/lib/edu/thumbnail";
import { getLessonIdFromNumber, type LessonLock } from "@/lib/edu/lesson/lessonLock";
import { getLessonTemplateFiles, getLessonTemplatePreset } from "@/lib/edu/lessonTemplateRegistry";
import { collectLesson4PublishWarnings, transformLesson4ForPublish } from "@/lib/edu/publish/lesson4PublishTransform";
import { transformLesson3ForPublish } from "@/lib/edu/publish/lesson3PublishTransform";
import {
  createClientPublishPrepareEvidence,
  type PublishUploadSource,
} from "@/lib/edu/publish/clientPrepareEvidence";
import {
  classifyPendingPublishCommitForForwarding,
  selectClientPreparePublishSecurity,
  type ForwardablePendingManifestEvidenceV1,
} from "@/lib/edu/publish/clientAttemptIdentity";
import { renderLessonSite } from "@/lib/edu/templates";
import { lessonInsuranceContent } from "@/lib/edu/templates/schema";
import { recordChatSoftError } from "@/lib/edu/recordChatSoftError.client";
import { reportEduUiError } from "@/lib/edu/reportEduUiError.client";
import { useTeacherHotkeys } from "@/lib/edu/ui/useTeacherHotkeys";
import { resolveTeacherMode } from "@/lib/edu/ui/teacherMode";
import { computeChecklistStatus, getChecklist } from "@/lib/edu/checklist/lessonChecklist";
import { shouldIgnoreHotkeyEvent } from "@/lib/keyboard";
import { createRequestId } from "@/lib/http/requestId";
import { apiV1Path } from "@/lib/standards/pathTypes";
import { digestHex } from "@/lib/crypto/webcrypto";
import { formatDateKst, todayKst } from "@/lib/edu/dateKst";
import {
  getLessonEntryA11ySummary,
  getLessonEntryGuidanceCopy,
  getLessonFirstActionHint,
  getLessonHeaderStatus,
  getLessonStepLabel,
  getLessonWorkspaceContext,
  resolveLessonEntryState,
  resolveRecommendedCoreLessonId,
} from "@/app/edu/lesson/lessonEntryUi";

const VALID_LESSONS = [0, 1, 2, 3, 4];
const isDev = process.env.NODE_ENV !== "production";

type AssignmentInfo = {
  id: string;
  title: string;
  lessonId: number;
  templateKey: string;
  allowNetwork: boolean;
  dueAt: string | null;
  isClosed: boolean;
  shareCode: string;
};

type LessonClientProps = {
  lessonId: string;
  joinToken?: string;
  initialJoinSession?: {
    shareCode: string;
    nickname: string | null;
    boardId: string | null;
  } | null;
  teacherUiEnabled: boolean;
};

type PendingCommit = {
  v: 1;
  createdAt: number;
  shareCode: string;
  lessonId: number;
  slug: string;
  publishTitle: string;
  publishFiles: Array<{ path: string; contentType: string; sizeBytes: number }>;
  assignmentId: string | null;
  manifestSchemaVersion?: 1;
  declaredManifestDigest?: string;
  declaredManifest?: ForwardablePendingManifestEvidenceV1["declaredManifest"];
  publishAttemptId?: string;
  publishCapability?: string;
  requestId?: string;
  boardId?: string;
  previewUrl?: string;
  galleryPreviewUrl?: string;
  publicUrl?: string;
  classroomUrl?: string;
};

type PublishFlowState =
  | "IDLE"
  | "PREPARING"
  | "UPLOADING"
  | "WAITING_TURNSTILE"
  | "COMMITTING"
  | "PUBLISHED"
  | "FAILED";

type PublishDbNotReadyInfo = {
  requestId: string | null;
  supabaseRef: string | null;
  missing: string[];
};

const requiresTurnstileRetry = (message: string) => /turnstile|captcha|verification/i.test(message);
const EDU_ANON_ID_KEY = "eduAnonId";
const buildPublishErrorMessage = (
  fallback: string,
  payload?: { error?: { code?: string; message?: string }; requestId?: string },
) => {
  const message = payload?.error?.message?.trim() || fallback;
  const parts = [payload?.error?.code, payload?.requestId].filter(Boolean);
  return parts.length ? `${parts.join(" · ")} · ${message}` : message;
};
const getSlugFromPublishUrl = (url: string) => {
  try {
    const base = typeof window === "undefined" ? "http://localhost" : window.location.origin;
    const parsed = new URL(url, base);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const viewIndex = parts.indexOf("view");
    return viewIndex !== -1 ? parts[viewIndex + 1] ?? null : null;
  } catch {
    return null;
  }
};
const TEACHER_FLAG_KEY = "edu:webllm:teacher";
const PENDING_KEY = "gomdory:edu:pendingCommit";
const PENDING_TTL_MS = 30 * 60 * 1000;

const safeJsonParse = (raw: string): unknown | null => {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
};

const loadPending = (expectShareCode: string, expectLessonId: number): PendingCommit | null => {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const parsed = safeJsonParse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const pending = parsed as Partial<PendingCommit>;
    if (pending.v !== 1) return null;
    if (typeof pending.createdAt !== "number") return null;
    if (Date.now() - pending.createdAt > PENDING_TTL_MS) return null;
    if (typeof pending.shareCode !== "string" || pending.shareCode !== expectShareCode) return null;
    if (typeof pending.lessonId !== "number" || pending.lessonId !== expectLessonId) return null;
    if (typeof pending.slug !== "string" || !pending.slug) return null;
    if (typeof pending.publishTitle !== "string" || !pending.publishTitle) return null;
    if (!Array.isArray(pending.publishFiles) || !pending.publishFiles.length) return null;
    return pending as PendingCommit;
  } catch {
    return null;
  }
};

const savePending = (pending: PendingCommit) => {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  } catch {
    // ignore storage errors
  }
};

const clearPending = () => {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // ignore storage errors
  }
};

const getPendingDiscardHint = (
  raw: string | null,
  expectShareCode: string,
  expectLessonId: number,
): string | null => {
  if (!raw) return null;
  const parsed = safeJsonParse(raw);
  if (!parsed || typeof parsed !== "object") return "게시 기록을 읽지 못해 새로 게시해야 해요.";
  const pending = parsed as Partial<PendingCommit>;
  if (pending.v !== 1) return "이전 게시 기록 버전이 달라 새로 게시해야 해요.";
  if (typeof pending.createdAt !== "number") return "게시 기록이 손상되어 새로 게시해야 해요.";
  if (Date.now() - pending.createdAt > PENDING_TTL_MS) return "30분이 지나 게시 기록을 지웠어요. 다시 게시해주세요.";
  if (pending.shareCode !== expectShareCode || pending.lessonId !== expectLessonId) {
    return "다른 수업/다른 반에서 생성된 기록이라 새로 게시해주세요.";
  }
  if (typeof pending.slug !== "string" || !pending.slug) {
    return "게시 기록이 손상되어 새로 게시해야 해요.";
  }
  if (typeof pending.publishTitle !== "string" || !pending.publishTitle || !pending.publishFiles?.length) {
    return "게시 정보가 부족해 다시 게시해야 해요.";
  }
  return null;
};

export default function LessonClient({
  lessonId,
  joinToken: joinTokenProp,
  initialJoinSession,
  teacherUiEnabled,
}: LessonClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const assignmentId = useMemo(() => searchParams.get("assignment")?.trim() ?? "", [searchParams]);
  const joinToken = useMemo(
    () => joinTokenProp?.trim() || searchParams.get("jt")?.trim() || "",
    [joinTokenProp, searchParams],
  );
  const assignmentCodeParam = useMemo(() => {
    if (joinToken) return "";
    return searchParams.get("code")?.trim() ?? "";
  }, [joinToken, searchParams]);
  const presentParam = useMemo(() => searchParams.get("present") === "1", [searchParams]);
  const numericLessonId = useMemo(() => Number(lessonId), [lessonId]);
  const [assignment, setAssignment] = useState<AssignmentInfo | null>(null);
  const [assignmentStatus, setAssignmentStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const resolvedLessonId = assignment?.lessonId ?? numericLessonId;
  const isLesson1 = resolvedLessonId === 1;
  const initialLessonLockId = useMemo(
    () => getLessonIdFromNumber(resolvedLessonId) ?? "P1",
    [resolvedLessonId],
  );
  const [lessonLock, setLessonLock] = useState<LessonLock>({
    enabled: false,
    lessonId: initialLessonLockId,
    version: 1,
  });
  const lesson = useMemo(() => getLessonTemplatePreset(resolvedLessonId), [resolvedLessonId]);
  const [completedLessons, setCompletedLessons] = useState<number[]>([]);
  const [profileCode, setProfileCode] = useState("");
  const [profileName, setProfileName] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [fastApplySlotsByLesson, setFastApplySlotsByLesson] = useState<Record<string, string[]>>({});
  const [lastFastApply, setLastFastApply] = useState<{ lessonKey: LessonLock["lessonId"]; appliedSlots: string[]; at: number } | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [, setTurnstileToken] = useState<string | null>(null);
  const [turnstileKey, setTurnstileKey] = useState(0);
  const [publishUrl, setPublishUrl] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishMessage, setPublishMessage] = useState<string | null>(null);
  const [publishReused, setPublishReused] = useState(false);
  const [publishVersion, setPublishVersion] = useState<number | null>(null);
  const [publishFlow, setPublishFlow] = useState<PublishFlowState>("IDLE");
  const [publishHint, setPublishHint] = useState<string | null>(null);
  const [publishDbInfo, setPublishDbInfo] = useState<PublishDbNotReadyInfo | null>(null);
  const [turnstileWaitTooLong, setTurnstileWaitTooLong] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishAuthOpen, setPublishAuthOpen] = useState(false);
  const [turnstileAction, setTurnstileAction] = useState<null | "publish_commit" | "share_to_board">(null);
  const [qualityOpen, setQualityOpen] = useState(false);
  const [qualityResult, setQualityResult] = useState<QualityResult | null>(null);
  const [qualityDismissed, setQualityDismissed] = useState(false);
  const [presentationMode, setPresentationMode] = useState(false);
  const [isTeacherMode, setIsTeacherMode] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [motionOverride, setMotionOverride] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loadStatus, setLoadStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [loadMessage, setLoadMessage] = useState<string | null>(null);
  const [loadedSlug, setLoadedSlug] = useState<string | null>(null);
  const [checklistOpen, setChecklistOpen] = useState(true);
  const [localCompletedAt, setLocalCompletedAt] = useState<string | null>(null);
  const [wasLessonVisited, setWasLessonVisited] = useState<boolean | null>(null);
  const settingsRef = useRef<HTMLDivElement | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const chatPanelRef = useRef<ChatPanelHandle | null>(null);
  const [coachMessageCount, setCoachMessageCount] = useState(0);

  const reportLessonLoadFailure = useCallback(
    (reason: string, meta?: Record<string, unknown>) => {
      const requestId = createRequestId();
      void fetch(apiV1Path("ops/log"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          level: "error",
          route: "/edu/lesson",
          requestId,
          message: "edu_lesson_load_failed",
          meta: {
            route: "/edu/lesson",
            reason,
            requestId,
            diagPath: apiV1Path(`ops/diag/request/${requestId}`),
            ...meta,
          },
        }),
      }).catch(() => undefined);
      return requestId;
    },
    [],
  );
  const hasJoinToken = Boolean(joinToken);
  const joinSessionMissing = hasJoinToken && !initialJoinSession;
  const broadcastBoardId = useMemo(
    () => getEduBoardId(assignmentCodeParam || profileCode),
    [assignmentCodeParam, profileCode],
  );
  const [recoveredPending, setRecoveredPending] = useState<PendingCommit | null>(null);
  const pendingCommitRef = useRef<PendingCommit | null>(null);
  const turnstileWaitTimerRef = useRef<number | null>(null);
  const legacyCodeRedirectedRef = useRef(false);
  const shouldRedirectLegacyCode = Boolean(assignmentCodeParam && !joinToken);
  const initialLocalNickname = useMemo(() => getLocalEduNickname(), []);
  const lastSyncedNameRef = useRef("");
  const templateFirstAppliedRef = useRef(false);
  const lesson1NameHintRef = useRef(false);
  const resolvedProfileName = useMemo(() => {
    const candidate =
      profileName.trim() || initialJoinSession?.nickname?.trim() || initialLocalNickname?.trim() || "나";
    return candidate || "나";
  }, [initialJoinSession?.nickname, initialLocalNickname, profileName]);
  const defaultHobby = "산책";
  const lessonKey = useMemo(() => getLessonIdFromNumber(resolvedLessonId), [resolvedLessonId]);
  const isTemplateFirstLesson = Boolean(lessonKey);
  const checklistItems = useMemo(() => (lessonKey ? getChecklist(lessonKey) : []), [lessonKey]);
  const publishFlowLabel = useMemo(
    () => ({
      IDLE: "대기",
      PREPARING: "게시 준비 중",
      UPLOADING: "업로드 중",
      WAITING_TURNSTILE: "인증 대기",
      COMMITTING: "게시 마무리 중",
      PUBLISHED: "완료",
      FAILED: "실패",
    }),
    [],
  );

  const clearTurnstileWaitTimer = useCallback(() => {
    if (turnstileWaitTimerRef.current !== null) {
      window.clearTimeout(turnstileWaitTimerRef.current);
      turnstileWaitTimerRef.current = null;
    }
  }, []);

  const startTurnstileWaitTimer = useCallback(() => {
    clearTurnstileWaitTimer();
    setTurnstileWaitTooLong(false);
    turnstileWaitTimerRef.current = window.setTimeout(() => {
      setTurnstileWaitTooLong(true);
    }, 20000);
  }, [clearTurnstileWaitTimer]);

  const buildLessonLink = useCallback(
    (path: string) => {
      if (!joinToken) return path;
      const separator = path.includes("?") ? "&" : "?";
      return `${path}${separator}jt=${encodeURIComponent(joinToken)}`;
    },
    [joinToken],
  );

  const isValidLesson = VALID_LESSONS.includes(resolvedLessonId);
  const isCompleted = completedLessons.includes(resolvedLessonId);
  const progressCount = completedLessons.length;
  const progressLabel = `${Math.max(progressCount, Math.min(resolvedLessonId + 1, VALID_LESSONS.length))}/${VALID_LESSONS.length}`;
  const focusStorageKey = useMemo(() => `edu:focus:${resolvedLessonId}`, [resolvedLessonId]);
  const qualityStorageKey = useMemo(
    () => `edu:quality:dismissed:${resolvedLessonId}:${profileCode || "na"}`,
    [resolvedLessonId, profileCode],
  );
  const checklistStorageKey = useMemo(
    () => (lessonKey ? `eduLessonDone:${lessonKey}` : ""),
    [lessonKey],
  );
  const fastApplyStorageKey = useMemo(
    () => (lessonKey ? `eduFastApplySlots:${lessonKey}` : ""),
    [lessonKey],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleDecorateAbortRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const isAbort = reason instanceof DOMException
        ? reason.name === "AbortError"
        : Boolean(reason && typeof reason === "object" && (reason as { name?: string }).name === "AbortError");
      if (!isAbort) return;
      const message = reason instanceof DOMException
        ? reason.message
        : typeof (reason as { message?: unknown })?.message === "string"
          ? (reason as { message: string }).message
          : "";
      if (!message) return;
      let parsed: { phase?: string } | null = null;
      try {
        parsed = JSON.parse(message) as { phase?: string };
      } catch {
        return;
      }
      if (!parsed?.phase?.startsWith("decorate.")) return;
      event.preventDefault();
      void reportEduUiError({ message, lessonId: resolvedLessonId });
      void recordChatSoftError({
        stage: "decorate.unhandledrejection",
        error: reason,
        lessonId: resolvedLessonId,
        keyName: createRequestId(),
      });
    };
    window.addEventListener("unhandledrejection", handleDecorateAbortRejection);
    return () => {
      window.removeEventListener("unhandledrejection", handleDecorateAbortRejection);
    };
  }, [resolvedLessonId]);

  useEffect(() => {
    if (!isValidLesson) {
      router.replace(buildLessonLink("/edu/lesson"));
    }
  }, [buildLessonLink, isValidLesson, router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isValidLesson) return;
    const visitedKey = `eduLessonVisited:${resolvedLessonId}`;
    setWasLessonVisited(window.localStorage.getItem(visitedKey) === "1");
    window.localStorage.setItem(visitedKey, "1");
  }, [isValidLesson, resolvedLessonId]);

  useEffect(() => {
    if (publishError) {
      setPublishFlow("FAILED");
    }
  }, [publishError]);

  useEffect(() => {
    if (publishFlow !== "WAITING_TURNSTILE") {
      clearTurnstileWaitTimer();
      setTurnstileWaitTooLong(false);
    }
  }, [clearTurnstileWaitTimer, publishFlow]);

  useEffect(() => {
    if (!shouldRedirectLegacyCode || legacyCodeRedirectedRef.current) return;
    legacyCodeRedirectedRef.current = true;
    router.replace(`/edu?code=${encodeURIComponent(assignmentCodeParam)}`);
  }, [assignmentCodeParam, router, shouldRedirectLegacyCode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!profileCode) return;
    if (publishFlow === "PUBLISHED") return;
    const raw = window.sessionStorage.getItem(PENDING_KEY);
    const hint = getPendingDiscardHint(raw, profileCode, resolvedLessonId);
    if (hint) {
      clearPending();
      setRecoveredPending(null);
      setPublishHint(hint);
      setPublishError(null);
      setPublishMessage(null);
      setPublishFlow((prev) => (prev === "WAITING_TURNSTILE" ? "IDLE" : prev));
      return;
    }
    const pending = loadPending(profileCode, resolvedLessonId);
    if (!pending) return;
    pendingCommitRef.current = pending;
    setRecoveredPending(pending);
    setPublishHint("업로드됨 · 인증만 남음");
    setPublishError(null);
    setPublishMessage(null);
    setPublishFlow((prev) => (prev === "IDLE" ? "WAITING_TURNSTILE" : prev));
  }, [profileCode, publishFlow, resolvedLessonId]);


  useEffect(() => {
    const nextLessonId = getLessonIdFromNumber(resolvedLessonId);
    if (!nextLessonId) return;
    setLessonLock((prev) => (prev.enabled ? prev : { ...prev, lessonId: nextLessonId }));
  }, [resolvedLessonId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const focusParam = searchParams.get("focus");
    if (focusParam === "1") {
      setFocusMode(true);
      return;
    }
    const storedFocus = window.localStorage.getItem(focusStorageKey);
    if (storedFocus === "true") {
      setFocusMode(true);
    }
  }, [focusStorageKey, searchParams]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (!teacherUiEnabled) {
        window.localStorage.removeItem(TEACHER_FLAG_KEY);
        setIsTeacherMode(false);
        return;
      }
      const teacherFromQuery = searchParams.get("teacher") === "1";
      if (teacherFromQuery) {
        window.localStorage.setItem(TEACHER_FLAG_KEY, "1");
      }
      const storedFlag = window.localStorage.getItem(TEACHER_FLAG_KEY) === "1";
      setIsTeacherMode(
        resolveTeacherMode({ teacherUiEnabled, teacherFromQuery, storedFlag }),
      );
    } catch {
      setIsTeacherMode(false);
    }
  }, [searchParams, teacherUiEnabled]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.sessionStorage.getItem(qualityStorageKey);
    setQualityDismissed(stored === "1");
  }, [qualityStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem("edu:focus:broadcast") === "1") {
      setFocusMode(true);
      window.localStorage.removeItem("edu:focus:broadcast");
    }
    const handler = () => {
      setFocusMode(true);
    };
    window.addEventListener("edu:focus-broadcast", handler);
    return () => window.removeEventListener("edu:focus-broadcast", handler);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(focusStorageKey, String(focusMode));
  }, [focusMode, focusStorageKey]);

  useTeacherHotkeys({
    enabled: isTeacherMode,
    onSetLessonId: (id) => setLessonLock((prev) => ({ ...prev, lessonId: id })),
    onToggleLessonLock: () => setLessonLock((prev) => ({ ...prev, enabled: !prev.enabled })),
    onGenerate: () => chatPanelRef.current?.generate(),
    onToggleAutosave: () => chatPanelRef.current?.toggleAutosave(),
    onAbortAll: () => chatPanelRef.current?.abortAll(),
    onResetEngine: () => chatPanelRef.current?.resetEngine(),
    onHardReset: () => chatPanelRef.current?.hardReset(),
    onUndo: () => chatPanelRef.current?.undo(),
    onRedo: () => chatPanelRef.current?.redo(),
    onTogglePresentationMode: () => setPresentationMode((prev) => !prev),
    onExportDiagnostics: () => chatPanelRef.current?.exportDiagnostics(),
  });

  useEffect(() => {
    if (!focusMode) return;
  }, [focusMode]);

  useEffect(() => {
    if (joinSessionMissing) {
      setProfileCode("");
      setProfileName("");
      setCompletedLessons([]);
      return;
    }

    const profile = getEduProfile();
    const resolvedCode = initialJoinSession?.shareCode ?? profile.code;
    const resolvedName = resolveEduNickname(initialJoinSession?.nickname, initialLocalNickname, profile.name);
    const shouldSyncName = !profileName.trim();
    const nextName = shouldSyncName ? resolvedName : profileName.trim();

    if (resolvedCode) {
      setEduProfile({ code: resolvedCode, name: nextName });
      setEduBoardId(resolvedCode, initialJoinSession?.boardId ?? null);
    }
    if (resolvedName && shouldSyncName) {
      setLocalEduNickname(resolvedName);
    }

    setProfileCode((prev) => prev || resolvedCode || "");
    setProfileName((prev) => prev || (shouldSyncName ? resolvedName || "" : ""));

    if (resolvedCode) {
      const progress = getEduProgress(resolvedCode);
      setCompletedLessons(progress.completedLessons);
    }
  }, [initialJoinSession, initialLocalNickname, joinSessionMissing, numericLessonId, profileName]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (profileName.trim()) return;
    const storedNickname = getLocalEduNickname();
    if (storedNickname) {
      setProfileName(storedNickname);
    }
  }, [profileName]);

  useEffect(() => {
    setDraftName(profileName);
  }, [profileName]);

  useEffect(() => {
    if (profileName) {
      lastSyncedNameRef.current = profileName.trim();
    }
  }, [profileName]);

  const persistNickname = useCallback(
    async (nextName: string) => {
      const trimmed = nextName.trim();
      if (!trimmed) return;
      setProfileName(trimmed);
      setLocalEduNickname(trimmed);
      setEduProfile({ code: profileCode.trim(), name: trimmed });
      if (!joinToken || trimmed === lastSyncedNameRef.current) return;
      const result = await updateEduJoinSessionNickname({ token: joinToken, nickname: trimmed });
      if (result.ok) {
        lastSyncedNameRef.current = trimmed;
      }
    },
    [joinToken, profileCode],
  );

  useEffect(() => {
    if (joinSessionMissing) {
      setAssignment(null);
      setAssignmentStatus("idle");
      setAssignmentError(null);
      return;
    }

    if (!assignmentId) {
      setAssignment(null);
      setAssignmentStatus("idle");
      setAssignmentError(null);
      return;
    }

    let active = true;
    const controller = new AbortController();

    const loadAssignment = async () => {
      setAssignmentStatus("loading");
      setAssignmentError(null);
      const profile = getEduProfile();
      const shareCode = assignmentCodeParam || profile.code;

      if (!shareCode) {
        setAssignmentStatus("error");
        setAssignmentError("과제에 접근하려면 공유코드가 필요합니다.");
        return;
      }

      const response = await fetch(
        apiV1Path(`edu/assignment/get?id=${encodeURIComponent(assignmentId)}&code=${encodeURIComponent(shareCode)}`),
        { signal: controller.signal },
      );
      const payload = (await response.json().catch(() => null)) as
        | { ok: true; assignment: AssignmentInfo }
        | { ok: false; message?: string }
        | null;

      if (!response.ok || !payload || !payload.ok) {
        throw new Error(
          payload && "message" in payload ? payload.message ?? "과제를 불러오지 못했습니다." : "과제를 불러오지 못했습니다.",
        );
      }

      if (!active) return;
      setAssignment(payload.assignment);
      setAssignmentStatus("ready");
    };

    loadAssignment().catch((error) => {
      if (!active) return;
      const message = error instanceof Error ? error.message : "과제를 불러오지 못했습니다.";
      const requestId = reportLessonLoadFailure("assignment_load_failed", {
        assignmentId,
        detail: message,
      });
      setAssignment(null);
      setAssignmentStatus("error");
      setAssignmentError(`${message} (RID: ${requestId})`);
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, [assignmentCodeParam, assignmentId, joinSessionMissing, reportLessonLoadFailure]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedMotion = window.localStorage.getItem("edu:reduceMotion");
    const storedSound = window.localStorage.getItem("edu:soundEnabled");
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let cleanup: (() => void) | undefined;

    if (storedMotion !== null) {
      setReduceMotion(storedMotion === "true");
      setMotionOverride(true);
    } else {
      setReduceMotion(media.matches);
      const handler = (event: MediaQueryListEvent) => {
        setReduceMotion(event.matches);
      };
      media.addEventListener("change", handler);
      cleanup = () => media.removeEventListener("change", handler);
    }

    if (storedSound !== null) {
      setSoundEnabled(storedSound === "true");
    }

    return cleanup;
  }, []);

  useEffect(() => {
    if (!motionOverride || typeof window === "undefined") return;
    window.localStorage.setItem("edu:reduceMotion", String(reduceMotion));
  }, [motionOverride, reduceMotion]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("edu:soundEnabled", String(soundEnabled));
  }, [soundEnabled]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (shouldIgnoreHotkeyEvent(event)) return;
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      if (isDev) {
        console.debug("[lesson] global_keydown", {
          key: event.key,
          code: event.code,
          targetTag: tagName ?? null,
          isContentEditable: target?.isContentEditable ?? false,
        });
      }
      if (event.key !== "f" && event.key !== "F") return;
      if (tagName === "input" || tagName === "textarea" || target?.isContentEditable) {
        return;
      }
      setFocusMode((prev) => {
        const next = !prev;
        if (isDev) {
          console.debug("[lesson] focus_mode_toggled", { key: event.key, prev, next });
        }
        return next;
      });
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!settingsOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (!settingsRef.current?.contains(event.target as Node)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [settingsOpen]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 2400);
  }, []);

  useEffect(() => {
    if (profileName.trim()) return;
    const fallbackName = resolvedProfileName || "나";
    setProfileName(fallbackName);
    if (isLesson1 && fallbackName === "나" && !lesson1NameHintRef.current) {
      lesson1NameHintRef.current = true;
      showToast("이름을 바꿔보세요.");
    }
  }, [isLesson1, profileName, resolvedProfileName, showToast]);

  const playSuccessSound = () => {
    if (!soundEnabled || typeof window === "undefined") return;
    const webkitAudioContext = (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    const AudioContextConstructor = window.AudioContext ?? webkitAudioContext;
    if (!AudioContextConstructor) return;
    const audioContext = new AudioContextConstructor();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.2, audioContext.currentTime + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.6);
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.65);
    oscillator.onended = () => {
      audioContext.close();
    };
  };

  const triggerConfetti = async () => {
    if (reduceMotion) return;
    const { burstConfetti } = await import("@/lib/edu/confetti");
    burstConfetti({ particleCount: 36, durationMs: 320, colors: ["#38bdf8", "#facc15", "#34d399"] });
  };

  const resetTurnstile = useCallback(() => {
    setTurnstileToken(null);
    setTurnstileKey((prev) => prev + 1);
  }, []);

  const handleComplete = () => {
    setStatusMessage("");

    if (!profileCode) {
      setStatusMessage(eduCopy.completionRequireProfile);
      return;
    }

    const progress = getEduProgress(profileCode);
    const updated = Array.from(new Set([...progress.completedLessons, resolvedLessonId]));
    setEduProgress(profileCode, { completedLessons: updated });
    setCompletedLessons(updated);
    setStatusMessage(eduCopy.completionSaved);
    setCompleteOpen(true);
    showToast("대단해요! ⭐️");
    void triggerConfetti();
    playSuccessSound();
    void postEduProgress({
      shareCode: profileCode,
      completedLesson: resolvedLessonId,
      lastLesson: resolvedLessonId,
    }).then((result) => {
      if (!result.ok) {
        setStatusMessage(eduCopy.completionServerFail);
      }
    });
  };

  const shareToBoardWithToken = useCallback(
    async (token: string) => {
      if (!publishUrl || !profileCode || !profileName || isSharing) {
        return;
      }

      setShareMessage(null);
      setShareError(null);
      setIsSharing(true);

      try {
        const feedResponse = await fetch(apiV1Path(`share/${profileCode}/feed?limit=1`));
        const feedPayload = (await feedResponse.json().catch(() => null)) as
          | {
              ok: true;
              board: { share_write_enabled: boolean };
              walls: Array<{ wall: { id: string; title: string; student_write_enabled: boolean } }>;
            }
          | { ok: false; error?: { message?: string } }
          | null;

        if (!feedResponse.ok || !feedPayload || !feedPayload.ok) {
          throw new Error(
            feedPayload && "error" in feedPayload ? feedPayload.error?.message : "보드 정보를 불러오지 못했습니다.",
          );
        }

        if (!feedPayload.board.share_write_enabled) {
          setShareError("보드 공유가 잠겨 있어 카드 생성이 불가합니다.");
          return;
        }

        const walls = feedPayload.walls.map((item) => item.wall);
        const preferredWall =
          walls.find((wall) => wall.title.includes("제출")) ??
          walls.find((wall) => wall.title.toLowerCase().includes("submit")) ??
          walls[0];

        if (!preferredWall) {
          setShareError("보드에 사용할 섹션을 찾지 못했습니다.");
          return;
        }

        if (!preferredWall.student_write_enabled) {
          setShareError("선택한 섹션이 잠겨 있어 제출할 수 없습니다.");
          return;
        }

        const cardResponse = await fetch(apiV1Path(`share/${profileCode}/walls/${preferredWall.id}/cards`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: `${profileName}의 작품: ${publishUrl}`,
            authorName: profileName,
            turnstileToken: token,
            clientId: crypto.randomUUID(),
          }),
        });

        const cardPayload = (await cardResponse.json().catch(() => null)) as
          | { ok: true }
          | { ok: false; error?: { message?: string } }
          | null;

        if (!cardResponse.ok || !cardPayload || !cardPayload.ok) {
          throw new Error(
            cardPayload && "error" in cardPayload ? cardPayload.error?.message : "보드 카드 생성 실패",
          );
        }

        setShareMessage("보드에 공유했어요! 친구들이 곧 볼 수 있어요.");
        setPublishAuthOpen(false);
        setTurnstileAction(null);
        resetTurnstile();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "보드 공유 중 문제가 발생했습니다. 게시 자체는 완료되었습니다.";
        setShareError(`보드 공유만 실패: ${message}`);
        void reportEduUiError({
          lessonId: resolvedLessonId,
          slug: publishUrl ? getSlugFromPublishUrl(publishUrl) : null,
          message: `edu_share_failed:${message}`,
        });
        if (requiresTurnstileRetry(message)) {
          resetTurnstile();
          setPublishAuthOpen(true);
          setTurnstileAction("share_to_board");
        }
      } finally {
        setIsSharing(false);
      }
    },
    [isSharing, profileCode, profileName, publishUrl, resetTurnstile, resolvedLessonId],
  );

  const shareToBoard = useCallback(() => {
    if (!publishUrl || !profileCode || !profileName || isSharing) {
      return;
    }

    setShareMessage(null);
    setShareError(null);
    resetTurnstile();
    setPublishAuthOpen(true);
    setTurnstileAction("share_to_board");
  }, [isSharing, profileCode, profileName, publishUrl, resetTurnstile]);

  const templateFiles = useMemo(() => {
    if (!lesson) {
      return [];
    }
    return getLessonTemplateFiles(lesson.id, assignment?.templateKey ?? null);
  }, [assignment?.templateKey, lesson]);

  const templateFirstFiles = useMemo<Record<string, WorkspaceFile> | null>(() => {
    if (!lessonKey) return null;
    if (lessonKey === "P1") {
      const base = lessonInsuranceContent("P1");
      const content = {
        ...base,
        title: "자기소개 페이지",
        intro: `이름: ${resolvedProfileName} · 취미: ${defaultHobby}`,
        profile: {
          name: resolvedProfileName,
          slogan: "한줄 슬로건: 나를 한 문장으로 소개해요.",
        },
        cards: [
          { title: "나의 키워드", desc: "#호기심 #성장 #친절" },
          { title: "좋아하는 것", desc: "좋아하는 색/음식/장소를 적어보세요." },
          { title: "오늘의 목표", desc: "나만의 첫 자기소개 페이지 완성!" },
        ],
        highlight: {
          label: "사진 자리",
          message: "여기에 사진이 들어갈 자리를 만들어 보세요.",
        },
        footerNote: "프로필 카드 3개로 나를 소개해요.",
      };
      const rendered = renderLessonSite("P1", content);
      return {
        "index.html": { content: rendered["index.html"] ?? "", contentType: "text/html" },
        "style.css": { content: rendered["style.css"] ?? "", contentType: "text/css" },
        "script.js": { content: rendered["script.js"] ?? "", contentType: "text/javascript" },
      };
    }
    if (lessonKey === "P2") {
      const base = lessonInsuranceContent("P2");
      const content = {
        ...base,
        about: {
          ...base.about,
          name: resolvedProfileName,
        },
      };
      const rendered = renderLessonSite("P2", content);
      return {
        "index.html": { content: rendered["index.html"] ?? "", contentType: "text/html" },
        "style.css": { content: rendered["style.css"] ?? "", contentType: "text/css" },
        "script.js": { content: rendered["script.js"] ?? "", contentType: "text/javascript" },
      };
    }
    if (lessonKey === "P3") {
      const base = lessonInsuranceContent("P3");
      const content = {
        ...base,
        title: `${resolvedProfileName}의 미니 퀴즈 챌린지`,
      };
      const rendered = renderLessonSite("P3", content);
      return {
        "index.html": { content: rendered["index.html"] ?? "", contentType: "text/html" },
        "style.css": { content: rendered["style.css"] ?? "", contentType: "text/css" },
        "script.js": { content: rendered["script.js"] ?? "", contentType: "text/javascript" },
      };
    }
    const base = lessonInsuranceContent("P4");
    const content = {
      ...base,
      profile: {
        ...base.profile,
        name: resolvedProfileName,
      },
    };
    const rendered = renderLessonSite("P4", content);
    return {
      "index.html": { content: rendered["index.html"] ?? "", contentType: "text/html" },
      "style.css": { content: rendered["style.css"] ?? "", contentType: "text/css" },
      "script.js": { content: rendered["script.js"] ?? "", contentType: "text/javascript" },
    };
  }, [defaultHobby, lessonKey, resolvedProfileName]);

  const initialFiles = useMemo(() => {
    if (!lesson) {
      return {} as Record<string, WorkspaceFile>;
    }
    return templateFiles.reduce<Record<string, WorkspaceFile>>((acc, file) => {
      acc[file.filename] = { content: file.content, contentType: file.contentType };
      return acc;
    }, {});
  }, [lesson, templateFiles]);

  const [files, setFiles] = useState<Record<string, WorkspaceFile>>(initialFiles);
  const indexHtmlContent = files["index.html"]?.content ?? "";
  const fastAppliedSlots = useMemo(
    () => (lessonKey ? fastApplySlotsByLesson[lessonKey] ?? [] : []),
    [fastApplySlotsByLesson, lessonKey],
  );
  const checklistStatus = useMemo(
    () =>
      computeChecklistStatus({
        lessonKey,
        profileName,
        workspaceFiles: { "index.html": { content: indexHtmlContent } },
        workspaceIndexHtml: indexHtmlContent,
        fastAppliedSlots,
      }),
    [fastAppliedSlots, indexHtmlContent, lessonKey, profileName],
  );
  const completedChecklistCount = useMemo(
    () => checklistItems.reduce((count, item) => (checklistStatus[item.id] ? count + 1 : count), 0),
    [checklistItems, checklistStatus],
  );
  const isChecklistComplete = checklistItems.length > 0 && completedChecklistCount === checklistItems.length;
  const previousChecklistCountRef = useRef(0);
  const lessonOpenSentRef = useRef(false);
  useEffect(() => {
    const previous = previousChecklistCountRef.current;
    if (
      completedChecklistCount > previous &&
      lastFastApply?.lessonKey === lessonKey &&
      Date.now() - lastFastApply.at < 5000
    ) {
      showToast(`체크 ${completedChecklistCount - previous}개 완료!`);
    }
    previousChecklistCountRef.current = completedChecklistCount;
  }, [completedChecklistCount, lastFastApply, lessonKey, showToast]);
  const getOrCreateAnonId = useCallback(() => {
    if (typeof window === "undefined") return null;
    const existing = window.localStorage.getItem(EDU_ANON_ID_KEY);
    if (existing) return existing;
    const created = crypto.randomUUID();
    window.localStorage.setItem(EDU_ANON_ID_KEY, created);
    return created;
  }, []);
  const buildAnonIdHash = useCallback(async () => {
    if (typeof window === "undefined") return null;
    const anonId = getOrCreateAnonId();
    if (!anonId) return null;
    try {
      return await digestHex("SHA-256", anonId);
    } catch {
      return null;
    }
  }, [getOrCreateAnonId]);
  const sendLessonCompleteEvent = useCallback(
    async (key: string) => {
      if (!joinToken || !key) return;
      const anonIdHash = await buildAnonIdHash();
      if (!anonIdHash) return;
      try {
        await fetch(apiV1Path("edu/telemetry/lesson-complete"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jt: joinToken,
            lessonKey: key,
            anonIdHash,
            ts: Date.now(),
          }),
        });
      } catch {
        // ignore network errors
      }
    },
    [buildAnonIdHash, joinToken],
  );
  const sendLessonOpenEvent = useCallback(
    async (key: string) => {
      if (!joinToken || !key) return;
      const anonIdHash = await buildAnonIdHash();
      if (!anonIdHash) return;
      try {
        await fetch(apiV1Path("edu/telemetry/lesson-open"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jt: joinToken,
            lessonKey: key,
            anonIdHash,
            ts: Date.now(),
          }),
        });
      } catch {
        // ignore network errors
      }
    },
    [buildAnonIdHash, joinToken],
  );
  const shouldSkipLessonComplete = useCallback(
    (stored: string | null) => {
      if (!stored) return false;
      const parsed = new Date(stored);
      if (Number.isNaN(parsed.getTime())) return false;
      return formatDateKst(parsed) === todayKst();
    },
    [],
  );
  const handleChecklistComplete = useCallback(() => {
    if (!checklistStorageKey || typeof window === "undefined") return;
    const existing = window.localStorage.getItem(checklistStorageKey);
    if (!shouldSkipLessonComplete(existing) && lessonKey) {
      void sendLessonCompleteEvent(lessonKey);
    }
    const timestamp = new Date().toISOString();
    window.localStorage.setItem(checklistStorageKey, timestamp);
    setLocalCompletedAt(timestamp);
  }, [checklistStorageKey, lessonKey, sendLessonCompleteEvent, shouldSkipLessonComplete]);

  useEffect(() => {
    setFiles(initialFiles);
  }, [initialFiles]);

  useEffect(() => {
    if (lessonOpenSentRef.current) return;
    if (!lessonKey || !joinToken) return;
    if (typeof window === "undefined") return;
    const dayBucket = todayKst();
    const storageKey = `eduLessonOpen:${lessonKey}:${dayBucket}`;
    const existing = window.localStorage.getItem(storageKey);
    if (existing) {
      lessonOpenSentRef.current = true;
      return;
    }
    window.localStorage.setItem(storageKey, new Date().toISOString());
    lessonOpenSentRef.current = true;
    void sendLessonOpenEvent(lessonKey);
  }, [joinToken, lessonKey, sendLessonOpenEvent]);

  useEffect(() => {
    templateFirstAppliedRef.current = false;
  }, [lessonKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(max-width: 640px)").matches) {
      setChecklistOpen(false);
    } else {
      setChecklistOpen(true);
    }
  }, [lessonKey]);

  useEffect(() => {
    if (!checklistStorageKey || typeof window === "undefined") return;
    const stored = window.localStorage.getItem(checklistStorageKey);
    setLocalCompletedAt(stored);
  }, [checklistStorageKey]);

  useEffect(() => {
    if (!lessonKey || !fastApplyStorageKey || typeof window === "undefined") return;
    const stored = window.localStorage.getItem(fastApplyStorageKey);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return;
      const cleaned = parsed.filter((slot) => typeof slot === "string");
      setFastApplySlotsByLesson((prev) => ({
        ...prev,
        [lessonKey]: cleaned,
      }));
    } catch {
      // ignore malformed storage
    }
  }, [fastApplyStorageKey, lessonKey]);

  useEffect(() => {
    if (!isTemplateFirstLesson || !templateFirstFiles) return;
    if (templateFirstAppliedRef.current) return;
    const hasFiles = Object.keys(files).length > 0;
    const matchesInitial =
      Object.keys(initialFiles).length > 0 &&
      Object.keys(initialFiles).every((key) => initialFiles[key]?.content === files[key]?.content);
    if (hasFiles && !matchesInitial) {
      return;
    }
    templateFirstAppliedRef.current = true;
    setFiles(templateFirstFiles);
    showToast("템플릿으로 먼저 완성했어요. 이제 내용을 바꿔보세요!");
  }, [files, initialFiles, isTemplateFirstLesson, templateFirstFiles, showToast]);

  const handleFastApplyAppliedSlots = useCallback(
    (appliedSlots: string[]) => {
      if (!lessonKey || typeof window === "undefined") return;
      const cleaned = appliedSlots.filter((slot) => typeof slot === "string");
      setFastApplySlotsByLesson((prev) => ({
        ...prev,
        [lessonKey]: cleaned,
      }));
      window.localStorage.setItem(fastApplyStorageKey, JSON.stringify(cleaned));
      setLastFastApply({ lessonKey, appliedSlots: cleaned, at: Date.now() });
    },
    [fastApplyStorageKey, lessonKey],
  );

  const handleFilesMerged = (nextFiles: Record<string, WorkspaceFile>) => {
    setFiles((prev) => ({
      ...prev,
      ...nextFiles,
    }));
  };

  const handleResetToTemplate = () => {
    if (isTemplateFirstLesson && templateFirstFiles) {
      setFiles(templateFirstFiles);
      return;
    }
    setFiles(initialFiles);
  };

  const runQualityCheck = useCallback(() => {
    const contentMap = Object.fromEntries(Object.entries(files).map(([path, file]) => [path, file.content]));
    const result = analyzeFiles(resolvedLessonId, contentMap);
    setQualityResult(result);
    return result;
  }, [files, resolvedLessonId]);

  const openQualityChecklist = useCallback(() => {
    runQualityCheck();
    setQualityOpen(true);
  }, [runQualityCheck]);

  const markQualityDismissed = useCallback(() => {
    setQualityDismissed(true);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(qualityStorageKey, "1");
    }
  }, [qualityStorageKey]);

  const handlePublish = useCallback(
    async (filesOverride?: Record<string, WorkspaceFile>) => {
      if (isPublishing) return;

      setPublishFlow("PREPARING");
      setPublishError(null);
      setPublishMessage(null);
      setPublishReused(false);
      setPublishVersion(null);
      setPublishHint(null);
      setPublishDbInfo(null);
      setShareMessage(null);
      setShareError(null);
      pendingCommitRef.current = null;

      if (!profileCode || !profileName) {
        setPublishError("공유코드와 이름을 먼저 저장해주세요.");
        return;
      }

      if (!lesson) {
        setPublishError("교시 정보를 불러오지 못했습니다. 다시 시도해주세요.");
        return;
      }

      const activeFiles = filesOverride ?? files;
      const lesson4Warnings =
        lesson.id === 4 ? collectLesson4PublishWarnings(activeFiles["index.html"]?.content ?? "") : [];
      if (lesson4Warnings.length > 0) {
        const warningMessage =
          lesson4Warnings.length > 1
            ? "게시는 진행되지만 대표 링크 비활성화/갤러리 카드 비노출이 생길 수 있어요."
            : lesson4Warnings[0] === "featured-link-invalid"
              ? "게시는 진행되지만 대표 링크가 비활성화될 수 있어요."
              : "게시는 진행되지만 갤러리 카드가 사라질 수 있어요.";
        showToast(warningMessage);
      }
      const publishFileContents =
        lesson.id === 4
          ? {
              ...activeFiles,
              "index.html": {
                ...(activeFiles["index.html"] ?? { contentType: "text/html" }),
                content: transformLesson4ForPublish(activeFiles["index.html"]?.content ?? ""),
              },
            }
          : lesson.id === 3
            ? {
                ...activeFiles,
                "index.html": {
                  ...(activeFiles["index.html"] ?? { contentType: "text/html" }),
                  content: transformLesson3ForPublish(activeFiles["index.html"]?.content ?? ""),
                },
              }
          : activeFiles;
      const htmlContent = publishFileContents["index.html"]?.content ?? "";
      const titleHints = extractTitleHintsFromHtml(htmlContent);
      const publishTitle = assignment?.title ?? lesson.title;
      const thumbnailTitle = titleHints.title?.trim() || `${publishTitle} 작품`;

      const thumbBlob = await makeEduThumbnailBlob({
        title: thumbnailTitle,
        authorName: profileName,
        lessonTitle: lesson.title,
        h1: titleHints.h1,
      });

      const publishUploadSources: PublishUploadSource[] = Object.entries(publishFileContents).map(
        ([path, file]) => ({
          path,
          contentType: file.contentType,
          body: file.content,
        }),
      );

      if (thumbBlob) publishUploadSources.push({ path: "thumb.png", contentType: "image/png", body: thumbBlob });

      const legacyPublishFiles = publishUploadSources.map(({ path, contentType, body }) => ({
        path,
        contentType,
        sizeBytes: typeof body === "string" ? new TextEncoder().encode(body).byteLength : body instanceof Blob ? body.size : body.byteLength,
      }));
      let publishFiles = legacyPublishFiles;
      let evidenceFields: ForwardablePendingManifestEvidenceV1 | null = null;

      setIsPublishing(true);

      try {
        try {
          const evidence = await createClientPublishPrepareEvidence(publishUploadSources);
          publishFiles = evidence.files;
          evidenceFields = {
            manifestSchemaVersion: evidence.manifestSchemaVersion,
            declaredManifestDigest: evidence.declaredManifestDigest,
            declaredManifest: evidence.declaredManifest,
          };
        } catch {
          // Declared evidence is observational; preserve the legacy prepare request on failure.
        }

        // Publish boundary (phase-62): decorate applies only to in-memory workspace files.
        // Persistence/share linkage starts here via prepare -> R2 upload -> commit.
        const prepareResponse = await fetch(apiV1Path("edu/publish/prepare"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shareCode: profileCode,
            authorName: profileName,
            title: publishTitle,
            files: publishFiles,
            lessonId: lesson.id,
            ...(evidenceFields ?? {}),
          }),
        });

        const preparePayload = (await prepareResponse.json().catch(() => null)) as
          | {
              ok: true;
              slug: string;
              uploads: { path: string; putUrl: string }[];
              publishAttemptId?: unknown;
              declaredManifestDigest?: unknown;
              manifestSchemaVersion?: unknown;
              publishCapability?: unknown;
            }
          | { ok: false; error?: { code?: string; message?: string }; requestId?: string };

        if (!prepareResponse.ok || !preparePayload || !preparePayload.ok) {
          throw new Error(
            buildPublishErrorMessage(
              "게시 준비 실패",
              preparePayload && "error" in preparePayload ? preparePayload : undefined,
            ),
          );
        }

        const prepareSecuritySelection = selectClientPreparePublishSecurity(preparePayload, evidenceFields);

        setPublishFlow("UPLOADING");
        // Upload step uses presigned PUT URLs returned by prepare route.
        const uploadSourceByPath = new Map(publishUploadSources.map((source) => [source.path, source]));
        await Promise.all(
          preparePayload.uploads.map(async (upload) => {
            const source = uploadSourceByPath.get(upload.path);
            if (!source) {
              throw new Error(`업로드 정보가 누락되었습니다: ${upload.path}`);
            }

            const body = source.body instanceof Blob
              ? source.body
              : new Blob([source.body as unknown as BlobPart], { type: source.contentType });
            const putResponse = await fetch(upload.putUrl, {
              method: "PUT",
              headers: { "Content-Type": source.contentType },
              body,
            });

            if (!putResponse.ok) {
              throw new Error(`업로드 실패: ${upload.path}`);
            }
          }),
        );

        const pending: PendingCommit = {
          v: 1,
          createdAt: Date.now(),
          shareCode: profileCode,
          lessonId: lesson.id,
          slug: preparePayload.slug,
          publishTitle,
          publishFiles,
          assignmentId: assignment?.id ?? null,
          ...(evidenceFields ?? {}),
          ...prepareSecuritySelection.fields,
        };
        pendingCommitRef.current = pending;
        savePending(pending);
        setRecoveredPending(pending);

        setPublishFlow("WAITING_TURNSTILE");
        // Commit is intentionally separated (with Turnstile) to keep publish state resumable.
        startTurnstileWaitTimer();
        resetTurnstile();
        setPublishMessage("업로드 완료! 인증을 완료하면 게시가 끝나요.");
        setPublishError(null);
        setPublishAuthOpen(true);
        setTurnstileAction("publish_commit");
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : "게시 중 오류가 발생했습니다.";
        setPublishError(message);
        void reportEduUiError({
          lessonId: resolvedLessonId,
          slug: publishUrl ? getSlugFromPublishUrl(publishUrl) : null,
          message: `edu_publish_failed:${message}`,
        });
      } finally {
        setIsPublishing(false);
      }
    },
    [
      assignment?.id,
      assignment?.title,
      files,
      isPublishing,
      lesson,
      profileCode,
      profileName,
      publishUrl,
      resetTurnstile,
      resolvedLessonId,
      showToast,
      startTurnstileWaitTimer,
    ],
  );

  const handleCommit = useCallback(
    async (token: string) => {
      const pending = pendingCommitRef.current;
      if (!pending) {
        setPublishError("게시 정보가 만료되었습니다. 다시 게시를 눌러주세요.");
        return;
      }
      if (!pending.publishTitle || !pending.publishFiles?.length) {
        clearPending();
        setRecoveredPending(null);
        setPublishError("게시 정보가 부족합니다. 다시 게시를 눌러주세요.");
        return;
      }

      const pendingForwarding = classifyPendingPublishCommitForForwarding(pending);
      const commitEvidenceFields = pendingForwarding.fields;

      if (isPublishing) return;
      setPublishFlow("COMMITTING");
      clearTurnstileWaitTimer();
      setIsPublishing(true);

      try {
        const commitResponse = await fetch(apiV1Path("edu/publish/commit"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: pending.slug,
            shareCode: profileCode,
            authorName: profileName,
            title: pending.publishTitle,
            files: pending.publishFiles,
            turnstileToken: token,
            assignmentId: pending.assignmentId,
            lessonId: pending.lessonId,
            ...commitEvidenceFields,
          }),
        });

        const commitPayload = (await commitResponse.json().catch(() => null)) as
          | {
              ok: true;
              url?: string;
              reused?: boolean;
              publish?: {
                slug?: string;
                version?: number;
                publicUrl?: string;
                previewUrl?: string;
                classroomUrl?: string;
                projectId?: string;
                state?: string;
              };
              notice?: { code?: string; message?: string };
              links?: { publicUrl?: string };
            }
          | {
              ok: false;
              error?: { code?: string; message?: string };
              requestId?: string;
              code?: string;
              message?: string;
              supabaseRef?: string;
              missing?: string[];
            };

        if (!commitResponse.ok || !commitPayload || !commitPayload.ok) {
          const errorPayload = commitPayload && "error" in commitPayload ? commitPayload : null;
          const payloadCode = errorPayload?.error?.code ?? ("code" in commitPayload ? commitPayload.code : undefined);
          const payloadMessage =
            errorPayload?.error?.message ?? ("message" in commitPayload ? commitPayload.message : undefined);
          const payloadRequestId =
            errorPayload?.requestId ?? ("requestId" in commitPayload ? commitPayload.requestId : undefined);
          const payloadSupabaseRef = "supabaseRef" in commitPayload ? commitPayload.supabaseRef : undefined;
          const payloadMissing = "missing" in commitPayload ? commitPayload.missing : undefined;

          if (payloadCode === "DB_NOT_READY") {
            setPublishFlow("FAILED");
            setPublishError("서버 게시 기능이 준비되지 않았어요. 선생님께 알려주세요.");
            setPublishHint("DB 준비가 완료되어야 다시 게시할 수 있어요.");
            setPublishDbInfo({
              requestId: payloadRequestId ?? null,
              supabaseRef: payloadSupabaseRef ?? null,
              missing: payloadMissing?.length ? payloadMissing : ["unknown"],
            });
            setPublishAuthOpen(false);
            setTurnstileAction(null);
            resetTurnstile();
            return;
          }

          const code = payloadCode ? `(${payloadCode}) ` : "";
          const rid = payloadRequestId ? ` · ${payloadRequestId}` : "";
          const msg = payloadMessage ?? "게시 완료 실패";
          throw new Error(`${code}${msg}${rid}`);
        }

        const publishUrlValue =
          commitPayload.publish?.publicUrl ?? commitPayload.links?.publicUrl ?? commitPayload.url ?? null;

        pendingCommitRef.current = null;
        clearPending();
        setRecoveredPending(null);
        setPublishUrl(publishUrlValue);
        setPublishVersion(typeof commitPayload.publish?.version === "number" ? commitPayload.publish.version : null);
        const reused = Boolean(commitPayload.reused);
        setPublishReused(reused);
        setPublishMessage(reused ? "이미 게시된 링크를 찾았어요!" : "게시가 완료되었습니다!");
        setPublishFlow("PUBLISHED");
        setPublishAuthOpen(false);
        setTurnstileAction(null);
        resetTurnstile();
        const publishedSlug = commitPayload.publish?.slug ?? pending.slug;
        void postEduProgress({
          shareCode: profileCode,
          publishedSlug,
          lastLesson: resolvedLessonId,
        });

        if (publishUrlValue && navigator.clipboard?.writeText) {
          try {
            await navigator.clipboard.writeText(publishUrlValue);
            setPublishMessage(reused ? "이미 게시된 링크를 복사했어요." : "게시가 완료되었습니다! 링크를 복사했어요.");
          } catch {
            // ignore clipboard errors
          }
        }

        if (publishUrlValue) {
          window.open(publishUrlValue, "_blank", "noopener,noreferrer");
        }
      } catch (error) {
        const rawMessage = error instanceof Error ? error.message : "게시 중 오류가 발생했습니다.";
        setPublishFlow("FAILED");
        setPublishError(rawMessage);
        setPublishReused(false);
        setPublishVersion(null);
        void reportEduUiError({
          lessonId: resolvedLessonId,
          slug: pending.slug,
          message: `edu_publish_failed:${rawMessage}`,
        });
        if (rawMessage.includes("TURNSTILE_FAILED") || rawMessage.includes("Turnstile")) {
          resetTurnstile();
          setPublishAuthOpen(true);
          setTurnstileAction("publish_commit");
        }
      } finally {
        setIsPublishing(false);
      }
    },
    [clearTurnstileWaitTimer, isPublishing, profileCode, profileName, resetTurnstile, resolvedLessonId],
  );

  const handlePublishClick = useCallback(() => {
    if (!qualityDismissed) {
      openQualityChecklist();
      return;
    }
    void handlePublish();
  }, [handlePublish, openQualityChecklist, qualityDismissed]);

  const handleChecklistPublish = useCallback(() => {
    markQualityDismissed();
    setQualityOpen(false);
    void handlePublish();
  }, [handlePublish, markQualityDismissed]);

  const handleChecklistApplyFixes = useCallback(() => {
    const result = qualityResult ?? runQualityCheck();
    const nextFiles: Record<string, WorkspaceFile> = { ...files };
    const htmlBase = nextFiles["index.html"]?.content ?? "<!doctype html><html><head></head><body></body></html>";
    const baseTitle = assignment?.title ?? lesson?.title ?? "나의 프로젝트";
    let updatedHtml = htmlBase;

    const findCheck = (key: string) => result.checks.find((check) => check.key === key);
    if (findCheck("title") && !findCheck("title")?.ok) {
      updatedHtml = addTitle(updatedHtml, baseTitle);
    }
    if (findCheck("h1") && !findCheck("h1")?.ok) {
      updatedHtml = addH1(updatedHtml, baseTitle);
    }
    if (findCheck("sections") && !findCheck("sections")?.ok) {
      updatedHtml = ensureTwoSections(updatedHtml);
    }

    nextFiles["index.html"] = {
      content: updatedHtml,
      contentType: "text/html",
    };

    const colorCheck = findCheck("colors");
    if (colorCheck && !colorCheck.ok) {
      const currentCss = nextFiles["style.css"]?.content ?? "";
      const updatedCss = ensureAccentCss(currentCss);
      nextFiles["style.css"] = {
        content: updatedCss,
        contentType: "text/css",
      };
    }

    setFiles(nextFiles);
    markQualityDismissed();
    setQualityOpen(false);
    void handlePublish(nextFiles);
  }, [
    assignment?.title,
    files,
    handlePublish,
    lesson?.title,
    markQualityDismissed,
    qualityResult,
    runQualityCheck,
  ]);

  const loadSlug = useMemo(() => searchParams.get("load")?.trim() ?? "", [searchParams]);

  useEffect(() => {
    if (!loadSlug) {
      setLoadStatus("idle");
      setLoadMessage(null);
      setLoadedSlug(null);
      return;
    }

    let active = true;
    const controller = new AbortController();

    const loadProjectFiles = async () => {
      setLoadStatus("loading");
      setLoadMessage(null);
      setFiles(initialFiles);

      const response = await fetch(apiV1Path(`edu/projects/files?slug=${encodeURIComponent(loadSlug)}`), {
        signal: controller.signal,
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok: true; files: { path: string; contentType: string; url: string }[] }
        | { ok: false; error?: { message?: string } }
        | null;

      if (!response.ok || !payload || !payload.ok) {
        throw new Error(payload && "error" in payload ? payload.error?.message ?? "불러오기에 실패했습니다." : "불러오기에 실패했습니다.");
      }

      const allowed = new Map<string, WorkspaceFile>();
      await Promise.all(
        payload.files.map(async (file) => {
          if (!["text/html", "text/css", "text/javascript"].includes(file.contentType)) {
            return;
          }
          const fileResponse = await fetch(file.url, { signal: controller.signal });
          if (!fileResponse.ok) {
            throw new Error(`파일을 불러오지 못했습니다: ${file.path}`);
          }
          const content = await fileResponse.text();
          allowed.set(file.path, { content, contentType: file.contentType as WorkspaceFile["contentType"] });
        }),
      );

      if (!active) return;
      setFiles((prev) => ({
        ...prev,
        ...Object.fromEntries(allowed.entries()),
      }));
      setLoadStatus("loaded");
      setLoadedSlug(loadSlug);
      setLoadMessage("이전 작품을 불러왔어요. 다시 게시하면 새로운 링크가 생성됩니다.");
    };

    loadProjectFiles().catch((error) => {
      if (!active) return;
      const message = error instanceof Error ? error.message : "불러오기에 실패했습니다.";
      const requestId = reportLessonLoadFailure("project_load_failed", {
        slug: loadSlug,
        detail: message,
      });
      setLoadStatus("error");
      setLoadMessage(`${message} (RID: ${requestId})`);
      setLoadedSlug(null);
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, [initialFiles, loadSlug, reportLessonLoadFailure]);

  const handlePublishToken = (token: string | null) => {
    setTurnstileToken(token);
    if (!token || !turnstileAction) return;

    if (turnstileAction === "publish_commit") {
      void handleCommit(token);
      return;
    }
    if (turnstileAction === "share_to_board") {
      void shareToBoardWithToken(token);
    }
  };

  const handlePublishRetry = () => {
    setPublishHint(null);
    setPublishDbInfo(null);
    if (pendingCommitRef.current) {
      setPublishFlow("WAITING_TURNSTILE");
      startTurnstileWaitTimer();
      resetTurnstile();
      setPublishAuthOpen(true);
      setTurnstileAction("publish_commit");
      return;
    }
    void handlePublish();
  };

  if (shouldRedirectLegacyCode) {
    return null;
  }

  if (joinSessionMissing) {
    return (
      <div className="edu-panel flex flex-col items-center gap-4 bg-white/80 p-6 text-center text-sm font-semibold text-slate-600">
        <p>세션이 만료되었어요.</p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => router.replace("/edu")}
            className="rounded-2xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            다시 들어가기
          </button>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.reload();
              }
            }}
            className="rounded-2xl border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300"
          >
            새로고침
          </button>
        </div>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="edu-panel bg-white/80 p-8 text-center">
        <p className="text-base font-semibold text-slate-600">교시 정보를 찾을 수 없어요.</p>
      </div>
    );
  }

  const assignmentMismatch = assignment && assignment.lessonId !== numericLessonId;
  const nextLessonId = resolvedLessonId < Math.max(...VALID_LESSONS) ? resolvedLessonId + 1 : null;
  const visitedLessonIds = new Set<number>(completedLessons);
  if (Boolean(wasLessonVisited)) {
    visitedLessonIds.add(resolvedLessonId);
  }
  const hasSavedProgress = Boolean(
    localCompletedAt || completedChecklistCount > 0 || checklistItems.some((item) => Boolean(checklistStatus[item.id])),
  );
  const lessonEntryState = resolveLessonEntryState({
    lessonId: resolvedLessonId,
    wasVisited: Boolean(wasLessonVisited),
    hasSavedProgress,
    isFreeMode: resolvedLessonId === 0,
  });
  const recommendedCoreLessonId = resolveRecommendedCoreLessonId(visitedLessonIds);
  const isRecommendedLesson = resolvedLessonId === recommendedCoreLessonId;
  const lessonEntryGuidance = getLessonEntryGuidanceCopy({
    lessonId: resolvedLessonId,
    entryState: lessonEntryState,
    isRecommended: isRecommendedLesson,
  });
  const firstActionHint = getLessonFirstActionHint(resolvedLessonId);
  const lessonStepLabel = getLessonStepLabel(resolvedLessonId);
  const workspaceContext = getLessonWorkspaceContext(resolvedLessonId);
  const lessonHeaderStatus = getLessonHeaderStatus({
    entryState: lessonEntryState,
    isRecommended: isRecommendedLesson,
  });
  const lessonEntryA11ySummary = getLessonEntryA11ySummary({
    lessonStepLabel,
    lessonTitle: lesson.title,
    entryState: lessonEntryState,
    workspaceContext,
    firstActionHint,
  });

  return (
    <div className="space-y-12 lg:space-y-14">
      <header className="sticky top-0 z-30 -mx-4 border-b border-slate-200/70 bg-white/70 px-4 py-3 backdrop-blur sm:px-6 lg:px-8 2xl:px-10">
        <div className="grid items-center gap-3 lg:grid-cols-[1fr_auto_1fr]">
          <div className="flex items-center gap-3">
            <EduBadge variant="brand">🐻 곰도리 EDU</EduBadge>
          </div>
          <div className="text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{lessonStepLabel}</p>
            <h1 className="text-base font-semibold text-slate-900 sm:text-lg">{lesson.title}</h1>
          </div>
          <div className="flex items-center justify-end gap-2">
            <EduBadge variant="progress">{progressLabel}</EduBadge>
            {isCompleted ? <EduBadge variant="done">완료 ✓</EduBadge> : null}
            <button
              type="button"
              onClick={() => setFocusMode((prev) => !prev)}
              title="F 키로 전환"
              className="rounded-full border border-slate-200/80 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600"
            >
              {focusMode ? "집중 해제" : "집중 모드"}
            </button>
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="rounded-full border border-slate-200/80 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600"
            >
              도움말
            </button>
            <Link
              href={buildLessonLink("/edu/lesson")}
              className="rounded-full border border-slate-200/80 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600"
            >
              홈
            </Link>
            <div className="relative" ref={settingsRef}>
              <button
                type="button"
                onClick={() => setSettingsOpen((prev) => !prev)}
                aria-label={eduCopy.settingsOpenLabel}
                className="inline-flex min-h-[40px] items-center justify-center rounded-full border border-slate-200/80 bg-white/80 px-3 text-sm shadow-sm transition hover:border-sky-300 hover:text-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              >
                ⚙️
              </button>
              {settingsOpen ? (
                <div className="absolute right-0 top-[48px] z-20 w-64 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-700">{eduCopy.settingsTitle}</p>
                    <button
                      type="button"
                      onClick={() => setSettingsOpen(false)}
                      aria-label={eduCopy.settingsCloseLabel}
                      className="min-h-[40px] rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                    >
                      닫기
                    </button>
                  </div>
                  <div className="mt-3 space-y-2">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={soundEnabled}
                      onClick={() => setSoundEnabled((prev) => !prev)}
                      className="flex min-h-[40px] w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                    >
                      <span>{soundEnabled ? eduCopy.settingsSoundOn : eduCopy.settingsSoundOff}</span>
                      <span
                        className={`h-5 w-10 rounded-full p-1 transition-colors ${
                          soundEnabled ? "bg-emerald-400" : "bg-slate-300"
                        }`}
                      >
                        <span
                          className={`block h-3 w-3 rounded-full bg-white transition-transform ${
                            soundEnabled ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </span>
                    </button>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={reduceMotion}
                      onClick={() => {
                        setReduceMotion((prev) => !prev);
                        setMotionOverride(true);
                      }}
                      className="flex min-h-[40px] w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                    >
                      <span>{eduCopy.settingsReduceMotion}</span>
                      <span
                        className={`h-5 w-10 rounded-full p-1 transition-colors ${
                          reduceMotion ? "bg-emerald-400" : "bg-slate-300"
                        }`}
                      >
                        <span
                          className={`block h-3 w-3 rounded-full bg-white transition-transform ${
                            reduceMotion ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </span>
                    </button>
                    <p className="text-xs text-slate-500">시스템의 “동작 줄이기” 설정을 따릅니다.</p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <section className="space-y-4 lg:space-y-6">
        {!isTeacherMode ? (
          <div className="edu-panel bg-white/90 px-6 py-5" aria-label={lessonEntryA11ySummary}>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold text-sky-700">
                  {lessonHeaderStatus.chipLabel}
                </span>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{lessonEntryGuidance.eyebrow}</p>
              </div>
              <h2 className="text-lg font-bold text-slate-900">{lessonEntryGuidance.title}</h2>
              <p className="text-sm text-slate-600">{workspaceContext}</p>
              <p className="text-sm text-slate-600">{lessonEntryGuidance.support}</p>
              {lessonHeaderStatus.metadata ? (
                <p className="text-xs text-slate-500">{lessonHeaderStatus.metadata}</p>
              ) : null}
              {lessonEntryGuidance.continuity ? (
                <p className="text-xs font-semibold text-sky-700">{lessonEntryGuidance.continuity}</p>
              ) : null}
              <p className="rounded-xl border border-sky-100 bg-sky-50/70 px-3 py-2 text-sm font-medium text-slate-700">
                첫 행동 힌트: {firstActionHint}
              </p>
            </div>
          </div>
        ) : null}
        {checklistItems.length ? (
          <div
            className={`edu-panel bg-white/80 px-5 py-4 ${
              isChecklistComplete ? "ring-1 ring-emerald-200" : ""
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {localCompletedAt ? "완료!" : "오늘의 체크"}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <p className="text-base font-semibold text-slate-900">체크리스트</p>
                  {localCompletedAt ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                      ✅ 완료
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                <span>
                  {completedChecklistCount}/{checklistItems.length}
                </span>
                <button
                  type="button"
                  onClick={() => setChecklistOpen((prev) => !prev)}
                  className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-500 transition hover:border-sky-300 hover:text-sky-600 sm:hidden"
                >
                  {checklistOpen ? "접기" : "체크 보기"}
                </button>
              </div>
            </div>
            <ul
              className={`mt-3 grid gap-2 text-xs font-semibold text-slate-700 ${
                checklistOpen ? "grid" : "hidden sm:grid"
              }`}
            >
              {checklistItems.map((item) => {
                const done = Boolean(checklistStatus[item.id]);
                return (
                  <li
                    key={item.id}
                    className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-white/80 px-3 py-2"
                  >
                    <span className="flex items-center gap-2">
                      <span className={done ? "text-emerald-500" : "text-slate-400"}>
                        {done ? "✅" : "⬜"}
                      </span>
                      <span>{item.label}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
            {!localCompletedAt ? (
              <div className={`mt-3 flex ${checklistOpen ? "flex" : "hidden sm:flex"}`}>
                <button
                  type="button"
                  onClick={handleChecklistComplete}
                  className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-600 shadow-sm transition hover:border-emerald-300 hover:text-emerald-700"
                >
                  완료했어요 ✅
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="edu-panel flex flex-wrap items-center justify-between gap-4 bg-white/80 px-5 py-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">오늘의 목표</p>
            <p className="text-base font-semibold text-slate-900">{lesson.goal}</p>
            <p className="text-sm text-slate-600">{lesson.description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <div className="rounded-xl border border-slate-200/80 bg-white/80 px-4 py-3 text-slate-600">
              <p className="text-xs font-semibold text-slate-500">학습자</p>
              <p className="mt-1 font-semibold text-slate-700">
                {profileName ? `${profileName} (${profileCode})` : "저장된 정보 없음"}
              </p>
              <button
                type="button"
                onClick={() => setIsEditingName((prev) => !prev)}
                className="mt-2 inline-flex rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-500 transition hover:border-sky-300 hover:text-sky-600"
              >
                {isEditingName ? "닫기" : "이름 수정"}
              </button>
              {isEditingName ? (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    value={draftName}
                    onChange={(event) => setDraftName(event.target.value)}
                    placeholder="예: 민지"
                    autoComplete="name"
                    maxLength={20}
                    className="w-32 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      void persistNickname(draftName);
                      setIsEditingName(false);
                    }}
                    className="rounded-full bg-sky-600 px-3 py-1 text-[11px] font-semibold text-white shadow-sm transition hover:bg-sky-500"
                  >
                    저장
                  </button>
                </div>
              ) : null}
            </div>
            <Link
              href={buildLessonLink("/edu/lesson")}
              className="rounded-full border border-slate-200/80 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600"
            >
              ← 교시 목록
            </Link>
          </div>
        </div>
      </section>
      {assignmentId ? (
        <section className="edu-panel bg-white/80 p-4 text-sm text-slate-600">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-slate-500">과제 모드</p>
              <p className="mt-1 text-base font-semibold text-slate-800">
                {assignment?.title ?? "과제 정보를 불러오는 중..."}
              </p>
              {assignment?.dueAt ? (
                <p className="mt-1 text-xs text-slate-500">
                  마감:{" "}
                  {new Date(assignment.dueAt).toLocaleString("ko-KR", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              ) : (
                <p className="mt-1 text-xs text-slate-500">마감 없음</p>
              )}
            </div>
            {assignment ? (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-500">
                  템플릿: {assignment.templateKey}
                </span>
                <span
                  className={`rounded-full px-3 py-1 font-semibold ${
                    assignment.allowNetwork ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-600"
                  }`}
                >
                  네트워크 {assignment.allowNetwork ? "허용" : "차단"}
                </span>
              </div>
            ) : null}
          </div>
          {assignmentStatus === "loading" ? (
            <p className="mt-3 text-xs text-slate-400">과제 정보를 확인하고 있어요...</p>
          ) : null}
          {assignmentError ? <p className="mt-3 text-xs text-rose-600">{assignmentError}</p> : null}
          {assignmentMismatch ? (
            <p className="mt-3 text-xs text-rose-600">
              과제 교시와 현재 페이지가 일치하지 않습니다. 과제 링크로 다시 접속해 주세요.
            </p>
          ) : null}
          {assignment?.isClosed ? (
            <p className="mt-3 text-xs font-semibold text-rose-600">이 과제는 마감되었습니다.</p>
          ) : null}
        </section>
      ) : null}
      <BroadcastBanner
        boardId={broadcastBoardId}
        onFocus={() => setFocusMode(true)}
        onGenerate={() => {
          setFocusMode(false);
          const target = document.getElementById("edu-coach-panel");
          if (!target) return;
          try {
            target.scrollIntoView({ behavior: "smooth", block: "start" });
          } catch (error) {
            void recordChatSoftError({
              stage: "edu_scroll_into_view",
              error,
              keyName: "edu-coach-panel",
              lessonId: resolvedLessonId,
            });
          }
        }}
      />

      {loadSlug ? (
        <section className="edu-panel bg-white/80 p-4 text-sm text-slate-600">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold text-slate-800">다시 편집 모드</p>
              <p className="text-xs text-slate-500">
                {loadStatus === "loading"
                  ? "작품을 불러오는 중이에요..."
                  : loadMessage ?? "작품을 불러오면 기존 코드를 작업공간에 채워드립니다."}
              </p>
            </div>
            {loadedSlug ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                load: {loadedSlug}
              </span>
            ) : null}
          </div>
          {loadStatus === "error" ? <p className="mt-2 text-xs text-rose-600">{loadMessage}</p> : null}
        </section>
      ) : null}

      <section className="min-h-0">
        <div className="edu-surface space-y-6 p-4 sm:p-6 lg:space-y-8 lg:p-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="rounded-full border border-slate-200/80 bg-white/80 px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm">
              AI와 협동해서 만드는 나만의 첫 웹페이지
            </p>
          </div>
          {focusMode ? (
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => {
                  if (isDev) {
                    console.debug("[lesson] back_to_coach_click", { messageCount: coachMessageCount });
                  }
                  setFocusMode(false);
                }}
                className="rounded-full border border-slate-200/80 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600"
              >
                AI 코치 보기
              </button>
            </div>
          ) : null}
          {focusMode ? (
            <div className="min-h-0 lg:h-[calc(100vh-220px)]">
              <Workspace
                files={files}
                onFilesChange={setFiles}
                onResetToTemplate={handleResetToTemplate}
                lessonTitle={lesson.title}
                projectTitle={assignment?.title ?? "프로젝트"}
                previewSlug={publishUrl ? getSlugFromPublishUrl(publishUrl) : null}
                initialPresentOpen={presentParam}
              />
            </div>
          ) : (
            <div className="relative flex min-h-0 gap-6 lg:h-[calc(100vh-220px)] lg:gap-8 xl:gap-10">
              <div className="min-h-0 min-w-[320px] flex-1">
                <Workspace
                  files={files}
                  onFilesChange={setFiles}
                  onResetToTemplate={handleResetToTemplate}
                  lessonTitle={lesson.title}
                  projectTitle={assignment?.title ?? "프로젝트"}
                  previewSlug={publishUrl ? getSlugFromPublishUrl(publishUrl) : null}
                  initialPresentOpen={presentParam}
                />
              </div>
              <RightSidebarCoach>
                <AiCoachPanel
                  panelRef={chatPanelRef}
                  title={lesson.title}
                  goal={lesson.goal}
                  starterPromptSuggestions={lesson.starterPromptSuggestions}
                  lessonId={resolvedLessonId}
                  lessonLock={lessonLock}
                  teacherUiEnabled={teacherUiEnabled}
                  shareCode={profileCode ?? null}
                  profileName={profileName}
                  onSetLessonId={(id) => setLessonLock((prev) => ({ ...prev, lessonId: id }))}
                  onToggleLessonLock={(next) => setLessonLock((prev) => ({ ...prev, enabled: next }))}
                  allowedFilenames={templateFiles.map((file) => file.filename)}
                  currentFiles={files}
                  onFilesMerged={handleFilesMerged}
                  onFastApplyAppliedSlots={handleFastApplyAppliedSlots}
                  onHelpClick={() => setHelpOpen(true)}
                  onTemplateStart={handleResetToTemplate}
                  presentationMode={presentationMode}
                  onTogglePresentationMode={setPresentationMode}
                  onMessageCountChange={setCoachMessageCount}
                  templateFirstMode={isTemplateFirstLesson}
                />
              </RightSidebarCoach>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-8 lg:space-y-10">
        <section
          id="publish"
          className="edu-panel flex flex-wrap items-center justify-between gap-10 bg-white/80 p-6 lg:gap-12"
        >
          <div className="max-w-xl space-y-2">
            <h3 className="text-lg font-bold text-slate-900">게시하기</h3>
            <p className="text-sm text-slate-600">
              Turnstile 인증 후 현재 작업물을 웹에 게시하고 링크를 공유하세요.
            </p>
            <p className="text-xs text-slate-500">
              게시 정보: {profileName ? `${profileName} · ${profileCode || "공유코드 없음"}` : "학습자 정보 없음"}
            </p>
            <p className="text-xs text-slate-500">상태: {publishFlowLabel[publishFlow]}</p>
            {publishHint && !recoveredPending ? (
              <p className="text-xs font-semibold text-slate-500">{publishHint}</p>
            ) : null}
            {recoveredPending && publishFlow !== "PUBLISHED" ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <p className="text-xs text-slate-500">{publishHint ?? "업로드됨 · 인증만 남음"}</p>
                <button
                  type="button"
                  onClick={() => {
                    pendingCommitRef.current = recoveredPending;
                    setPublishAuthOpen(true);
                    setTurnstileAction("publish_commit");
                    setPublishFlow("WAITING_TURNSTILE");
                    startTurnstileWaitTimer();
                  }}
                  className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white"
                >
                  게시 이어하기
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearPending();
                    pendingCommitRef.current = null;
                    setRecoveredPending(null);
                    setPublishFlow("IDLE");
                    setPublishHint(null);
                    setPublishError(null);
                    setPublishMessage(null);
                  }}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
                >
                  기록 지우기
                </button>
              </div>
            ) : null}
            {publishError ? <p className="text-sm font-semibold text-rose-600">{publishError}</p> : null}
            {publishDbInfo ? (
              <div className="space-y-1 text-xs text-rose-600">
                <p>
                  (RID: {publishDbInfo.requestId ?? "unknown"} · DB: {publishDbInfo.supabaseRef ?? "unknown"})
                </p>
                <p className="text-[11px] text-rose-500">missing: {publishDbInfo.missing.join(", ")}</p>
              </div>
            ) : null}
            {publishMessage ? <p className="text-sm font-semibold text-emerald-600">{publishMessage}</p> : null}
            {shareError ? <p className="text-sm font-semibold text-rose-600">{shareError}</p> : null}
            {shareMessage ? <p className="text-sm font-semibold text-emerald-600">{shareMessage}</p> : null}
            {publishFlow === "WAITING_TURNSTILE" && turnstileWaitTooLong ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-rose-600">
                  인증이 완료되지 않았어요. 광고차단/네트워크를 확인하고 ‘인증 다시 열기’를 눌러주세요.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setPublishHint(null);
                    setPublishFlow("WAITING_TURNSTILE");
                    startTurnstileWaitTimer();
                    resetTurnstile();
                    setPublishAuthOpen(true);
                    setTurnstileAction("publish_commit");
                  }}
                  className="rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold text-white"
                >
                  인증 다시 열기
                </button>
              </div>
            ) : null}
            {publishFlow === "FAILED" ? (
              <div className="mt-2 flex flex-col gap-1">
                <button
                  type="button"
                  onClick={handlePublishRetry}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
                >
                  게시 다시 시도
                </button>
                {publishDbInfo ? (
                  <p className="text-xs text-slate-500">DB 준비 완료 후 다시 시도하면 정상 게시됩니다.</p>
                ) : null}
              </div>
            ) : null}
            {publishUrl ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                  {publishReused ? (
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                      이미 게시됨
                    </span>
                  ) : null}
                  {publishVersion ? (
                    <span className="rounded-full bg-slate-900/10 px-2.5 py-1 text-xs font-semibold text-slate-700">
                      v{publishVersion}
                    </span>
                  ) : null}
                  <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold">{publishUrl}</span>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!publishUrl || !navigator.clipboard?.writeText) return;
                      await navigator.clipboard.writeText(publishUrl);
                      setPublishMessage(publishReused ? "이미 게시된 링크를 복사했어요." : "링크를 복사했습니다!");
                    }}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600"
                  >
                    URL 복사
                  </button>
                  <a
                    href={publishUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white"
                  >
                    새 탭 열기
                  </a>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <button
                    type="button"
                    onClick={shareToBoard}
                    disabled={!publishUrl || isSharing}
                    className={`rounded-full px-4 py-2 text-xs font-semibold shadow-sm transition ${
                      !publishUrl || isSharing
                        ? "cursor-not-allowed bg-slate-200 text-slate-400"
                        : "bg-emerald-500 text-white hover:-translate-y-0.5"
                    }`}
                  >
                    {isSharing ? "공유 중..." : "보드에 공유하기"}
                  </button>
                  <span>게시 완료 후 보드 첫 번째(또는 제출) 섹션에 카드가 생성됩니다.</span>
                </div>
              </div>
            ) : null}
          </div>
          <div className="flex flex-col items-end gap-3">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={openQualityChecklist}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-800"
              >
                체크리스트
              </button>
              <button
                type="button"
                onClick={handlePublishClick}
                disabled={!profileCode || !profileName || isPublishing}
                className={`rounded-2xl px-6 py-3 text-sm font-semibold shadow-lg transition ${
                  !profileCode || !profileName || isPublishing
                    ? "cursor-not-allowed bg-slate-200 text-slate-400"
                    : "bg-slate-900 text-white hover:-translate-y-0.5"
                }`}
              >
                {isPublishing ? "게시 중..." : "게시하기"}
              </button>
            </div>
          </div>
        </section>

        <section className="edu-panel flex items-center justify-between gap-4 bg-white/80 p-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900">다른 학생 작품</h3>
            <p className="mt-1 text-sm text-slate-600">
              다음 단계에서 친구들의 작품을 함께 볼 수 있어요.
            </p>
          </div>
          {profileCode ? (
            <Link
              href={`/edu/class/${profileCode}/gallery`}
              className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5"
            >
              다른 학생 작품 보기
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded-2xl border border-slate-200 bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-400"
            >
              공유코드를 저장하면 볼 수 있어요
            </button>
          )}
        </section>

        <section className="edu-panel flex flex-wrap items-center justify-between gap-4 bg-white/80 p-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900">교시 마무리</h3>
            <p className="mt-1 text-sm text-slate-600">
              {isCompleted
                ? "이미 완료한 교시예요. 다른 교시로 이동해도 좋아요!"
                : "완료 버튼을 눌러 진행률을 업데이트하세요."}
            </p>
            {statusMessage ? (
              <p className="mt-2 text-sm font-semibold text-emerald-600">{statusMessage}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <a
              href="#publish"
              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600"
            >
              내 작품 게시하기
            </a>
            {profileCode ? (
              <Link
                href={`/edu/class/${profileCode}/gallery`}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600"
              >
                다른 친구 작품 구경하기
              </Link>
            ) : (
              <button
                type="button"
                disabled
                className="cursor-not-allowed rounded-2xl border border-slate-200 bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-400"
              >
                다른 친구 작품 구경하기
              </button>
            )}
            <button
              type="button"
              onClick={handleComplete}
              className={`min-h-[44px] rounded-2xl px-6 py-3 text-sm font-semibold shadow-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                isCompleted
                  ? "bg-emerald-500 text-white"
                  : "bg-slate-900 text-white hover:-translate-y-0.5"
              }`}
            >
              {isCompleted ? "완료됨 ✅" : "이 교시 완료!"}
            </button>
          </div>
        </section>
      </section>

      {completeOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-emerald-500">완료!</p>
                <h3 className="mt-2 text-2xl font-bold text-slate-900">{eduCopy.completionModalTitle}</h3>
                <p className="mt-3 text-sm text-slate-600">{eduCopy.completionModalBody}</p>
              </div>
              <button
                type="button"
                onClick={() => setCompleteOpen(false)}
                aria-label="완료 모달 닫기"
                className="min-h-[44px] rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              >
                닫기
              </button>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <Link
                href={buildLessonLink("/edu/lesson")}
                className="min-h-[44px] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              >
                {eduCopy.completionBackToMap}
              </Link>
              <Link
                href={
                  nextLessonId
                    ? buildLessonLink(`/edu/lesson/${nextLessonId}`)
                    : buildLessonLink("/edu/lesson")
                }
                aria-disabled={!nextLessonId}
                className={`min-h-[44px] rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 ${
                  nextLessonId
                    ? "bg-emerald-500 hover:-translate-y-0.5"
                    : "pointer-events-none bg-slate-300 text-slate-100"
                }`}
              >
                {eduCopy.completionNextLesson}
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      <QualityChecklistModal
        open={qualityOpen}
        result={qualityResult}
        onClose={() => setQualityOpen(false)}
        onPublish={handleChecklistPublish}
        onApplyFixes={handleChecklistApplyFixes}
      />

      <HelpModal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        examplePrompts={lesson.starterPromptSuggestions}
        lessonTitle={lesson.title}
      />

      {publishAuthOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6">
          <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-sky-600">보안 확인</p>
                <h3 className="mt-2 text-xl font-bold text-slate-900">Turnstile 인증</h3>
                <p className="mt-2 text-sm text-slate-500">
                  {turnstileAction === "share_to_board"
                    ? "보드에 공유하기 전에 인증이 필요해요."
                    : "업로드가 끝났어요. 인증 후 게시를 마무리합니다."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPublishAuthOpen(false);
                  setTurnstileAction(null);
                  if (publishFlow === "WAITING_TURNSTILE") {
                    setPublishHint("인증을 닫았어요. 게시를 끝내려면 ‘게시하기’를 다시 눌러 인증을 완료하세요.");
                  }
                }}
                className="min-h-[44px] rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              >
                닫기
              </button>
            </div>
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <TurnstileWidget key={turnstileKey} onToken={handlePublishToken} showStatus={false} />
            </div>
          </div>
        </div>
      ) : null}

      {toastMessage ? (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm font-semibold text-slate-700 shadow-lg">
          {toastMessage}
        </div>
      ) : null}
    </div>
  );
}
