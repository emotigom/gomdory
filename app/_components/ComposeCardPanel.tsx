"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { uploadFileToCard } from "@/app/dashboard/boards/[boardId]/walls/[wallId]/uploadClient";
import TurnstileWidget from "@/app/_components/TurnstileWidget";
import { useAttachmentQueue } from "@/app/_components/useAttachmentQueue";
import {
  cancelTask,
  enqueue,
  retryTask,
  startNext,
  type UploadTask,
} from "@/lib/uploads/uploadQueue";
import { routes } from "@/lib/standards/routes";
import { getOrCreateStudentDeviceId } from "@/lib/student/deviceId";
import {
  buildGenericFileAcceptValue,
  buildImageAcceptValue,
  isAllowedCardAttachmentContentType,
} from "@/lib/data/safeAttachmentTypes";
import { formatCardUrlLabel, normalizeHttpUrl, upsertCardUrlAttachment } from "@/lib/cards/urlAttachment";
import { extractAttachmentsFromDrop, extractUrlFromPaste } from "@/lib/uploads/clipboardDrop";
import {
  VIBE_COMPOSE_TEMPLATES,
  insertVibeTemplateText,
} from "@/lib/edu/vibe-coding/lesson-03-04-compose-templates";
import { classifyUploadError, createUploadError, toUserMessage } from "@/lib/uploads/uploadErrors";
import {
  clearDraft,
  createDebouncedSaver,
  loadDraft,
  makeDraftKey,
  saveDraft,
  type ComposeDraftPayload,
} from "@/lib/dashboard/composeDraft";

const MAX_STUDENT_TEXT_LENGTH = 1000;
const isDev = process.env.NODE_ENV !== "production";

type ComposeWall = {
  id: string;
  title: string;
  studentWriteEnabled?: boolean;
};

type DraftState = {
  text: string;
  authorName: string;
  url: string;
  attachments: File[];
};

type ComposeCardPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  walls: ComposeWall[];
  initialWallId: string;
  initialTemplate?: ComposeInitialTemplate | null;
  initialFiles?: File[];
  onInitialFilesConsumed?: () => void;
  mode: "teacher" | "student";
  boardId?: string;
  code?: string;
  writeLocked?: boolean;
  writeLockedMessage?: string;
  lessonMode?: "vibe_coding" | null;
};

type ComposeInitialTemplate = {
  id: string;
  revision: number;
  label: string;
  body: string;
  guidance: string[];
};

const acceptedImageTypes = buildImageAcceptValue();
const acceptedGenericFileTypes = buildGenericFileAcceptValue();

const emptyDraft: DraftState = {
  text: "",
  authorName: "",
  url: "",
  attachments: [],
};

type RestoreCandidate = ComposeDraftPayload;

function formatFileSize(size: number): string {
  const kilobyte = 1024;
  const megabyte = kilobyte * 1024;

  if (size >= megabyte) {
    return `${(size / megabyte).toFixed(1)} MB`;
  }

  if (size >= kilobyte) {
    return `${(size / kilobyte).toFixed(1)} KB`;
  }

  return `${size} B`;
}

export default function ComposeCardPanel({
  isOpen,
  onClose,
  walls,
  initialWallId,
  initialTemplate = null,
  initialFiles = [],
  onInitialFilesConsumed,
  mode,
  boardId,
  code,
  writeLocked = false,
  writeLockedMessage,
  lessonMode = null,
}: ComposeCardPanelProps) {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [selectedWallId, setSelectedWallId] = useState(initialWallId);
  const [drafts, setDrafts] = useState<Record<string, DraftState>>({});
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryHint, setRetryHint] = useState<"submit" | "files" | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [widgetKey, setWidgetKey] = useState(0);
  const [uploadTasksByWall, setUploadTasksByWall] = useState<Record<string, UploadTask[]>>({});
  const [uploadCardIdsByWall, setUploadCardIdsByWall] = useState<Record<string, string>>({});
  const [restoreCandidates, setRestoreCandidates] = useState<Record<string, RestoreCandidate>>({});
  const [isDropHovering, setIsDropHovering] = useState(false);
  const [expandedDiagnosticsTaskIds, setExpandedDiagnosticsTaskIds] = useState<Record<string, boolean>>({});
  const dropEnterCountRef = useRef(0);
  const lastInitialFilesSignature = useRef<string | null>(null);
  const lastAppliedInitialTemplateRevisionRef = useRef<number | null>(null);
  const saveDebounceByWallRef = useRef<
    Record<string, { key: string; trigger: () => void; cancel: () => void }>
  >({});
  const draftsRef = useRef(drafts);

  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);

  const activeWallId = selectedWallId || initialWallId || walls[0]?.id || "";
  const activeWall = useMemo(
    () => walls.find((wall) => wall.id === activeWallId),
    [activeWallId, walls],
  );

  const draft = drafts[activeWallId] ?? emptyDraft;
  const uploadTasks = uploadTasksByWall[activeWallId] ?? [];
  const activeUploadCardId = uploadCardIdsByWall[activeWallId] ?? null;

  const isStudent = mode === "student";
  const wallWriteLocked = isStudent && activeWall?.studentWriteEnabled === false;
  const submissionLocked = writeLocked || wallWriteLocked;
  const showVibeCodingTemplates = isStudent && lessonMode === "vibe_coding";

  const attachmentQueue = useAttachmentQueue({
    files: draft.attachments,
    disabled: writeLocked || submitting,
    onChange: (nextFiles) => {
      setDrafts((prev) => ({
        ...prev,
        [activeWallId]: {
          ...emptyDraft,
          ...prev[activeWallId],
          attachments: nextFiles,
        },
      }));
    },
  });

  useEffect(() => {
    if (!isOpen) return;
    setSelectedWallId(initialWallId);
    setErrorMessage(null);
    setRetryHint(null);
    setStatusMessage(null);
    const raf = window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(raf);
  }, [initialWallId, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const panelElement = panelRef.current;
      if (!panelElement) return;
      const path = typeof event.composedPath === "function" ? event.composedPath() : [];
      if (path.includes(panelElement)) return;
      onClose();
    };
    window.addEventListener("pointerdown", handlePointerDown, true);
    return () => window.removeEventListener("pointerdown", handlePointerDown, true);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) return;
    lastInitialFilesSignature.current = null;
  }, [isOpen]);

  const draftKey = useMemo(() => {
    if (!activeWallId) return null;
    return makeDraftKey({
      boardId: boardId ?? `share:${code ?? "unknown"}`,
      wallId: activeWallId,
    });
  }, [activeWallId, boardId, code]);

  useEffect(() => {
    if (!isOpen || !activeWallId || !draftKey) return;
    const loaded = loadDraft(draftKey);
    if (!loaded) {
      setRestoreCandidates((prev) => {
        const next = { ...prev };
        delete next[activeWallId];
        return next;
      });
      return;
    }

    const hasLocalInput = Boolean(draft.text.trim() || draft.url.trim() || draft.attachments.length > 0);
    if (hasLocalInput) return;

    setRestoreCandidates((prev) => ({
      ...prev,
      [activeWallId]: loaded,
    }));
  }, [activeWallId, draft.attachments.length, draft.text, draft.url, draftKey, isOpen]);

  const { enqueueFiles } = attachmentQueue;

  useEffect(() => {
    if (!isOpen || !activeWallId || !initialTemplate) return;
    if (lastAppliedInitialTemplateRevisionRef.current === initialTemplate.revision) return;
    lastAppliedInitialTemplateRevisionRef.current = initialTemplate.revision;

    setDrafts((prev) => {
      const current = { ...emptyDraft, ...prev[activeWallId] };
      const nextText = current.text.trim()
        ? current.text.includes(initialTemplate.body)
          ? current.text
          : `${current.text.trimEnd()}\n\n${initialTemplate.body}`
        : initialTemplate.body;

      return {
        ...prev,
        [activeWallId]: {
          ...current,
          text: nextText,
        },
      };
    });
  }, [activeWallId, initialTemplate, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (!initialFiles.length) return;
    const signature = initialFiles
      .map((file) => `${file.name}-${file.size}-${file.lastModified}`)
      .join("|");
    if (signature === lastInitialFilesSignature.current) return;
    lastInitialFilesSignature.current = signature;
    enqueueFiles(initialFiles);
    onInitialFilesConsumed?.();
  }, [enqueueFiles, initialFiles, isOpen, onInitialFilesConsumed]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isStudent) return;
    if (typeof window === "undefined") return;
    const storedName = window.localStorage.getItem("student-card-author-name");
    if (storedName) {
      setDrafts((prev) => ({
        ...prev,
        [activeWallId]: {
          ...emptyDraft,
          ...prev[activeWallId],
          authorName: prev[activeWallId]?.authorName ?? storedName,
        },
      }));
    }
  }, [activeWallId, isStudent]);

  const wallOptions = useMemo(
    () => walls.map((wall) => ({ id: wall.id, title: wall.title })),
    [walls],
  );

  const updateDraft = (partial: Partial<DraftState>) => {
    setDrafts((prev) => ({
      ...prev,
      [activeWallId]: {
        ...emptyDraft,
        ...prev[activeWallId],
        ...partial,
      },
    }));
  };

  useEffect(() => {
    if (!isOpen || !activeWallId || !draftKey) return;
    if (uploadTasks.length > 0) return;

    const existingDebounce = saveDebounceByWallRef.current[activeWallId];
    if (existingDebounce && existingDebounce.key !== draftKey) {
      existingDebounce.cancel();
      delete saveDebounceByWallRef.current[activeWallId];
    }

    if (!saveDebounceByWallRef.current[activeWallId]) {
      saveDebounceByWallRef.current[activeWallId] = {
        key: draftKey,
        ...createDebouncedSaver(() => {
          const current = draftsRef.current[activeWallId] ?? emptyDraft;
          const nextText = current.text.trim();
          const nextUrl = current.url.trim();
          if (!nextText && !nextUrl) {
            clearDraft(draftKey);
            return;
          }

          saveDraft(draftKey, {
            text: current.text,
            url: current.url,
            updatedAt: Date.now(),
          });
        }, 800),
      };
    }

    saveDebounceByWallRef.current[activeWallId]?.trigger();
  }, [activeWallId, draft.attachments.length, draft.text, draft.url, draftKey, isOpen, uploadTasks.length]);

  useEffect(() => {
    if (isOpen) return;
    const entries = Object.values(saveDebounceByWallRef.current);
    entries.forEach((entry) => entry.cancel());
    saveDebounceByWallRef.current = {};
  }, [isOpen]);

  useEffect(() => {
    return () => {
      const entries = Object.values(saveDebounceByWallRef.current);
      entries.forEach((entry) => entry.cancel());
      saveDebounceByWallRef.current = {};
    };
  }, []);

  const enqueueAllowedFiles = (files: File[]) => {
    const allowedFiles = files.filter((file) => isAllowedCardAttachmentContentType(file.type));
    const blockedCount = files.length - allowedFiles.length;

    if (blockedCount > 0) {
      setErrorMessage("지원되는 이미지/문서 파일만 첨부할 수 있어요.");
      setRetryHint("files");
    }

    if (allowedFiles.length > 0) {
      attachmentQueue.enqueueFiles(allowedFiles);
    }

    return blockedCount;
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) return;
    const selected = Array.from(event.target.files);
    enqueueAllowedFiles(selected);
    event.target.value = "";
  };

  const handleComposeDragEnter = (event: React.DragEvent<HTMLElement>) => {
    if (writeLocked || submitting) return;
    if (!event.dataTransfer?.types.includes("Files")) return;
    dropEnterCountRef.current += 1;
    setIsDropHovering(true);
  };

  const handleComposeDragLeave = (event: React.DragEvent<HTMLElement>) => {
    if (writeLocked || submitting) return;
    if (!event.dataTransfer?.types.includes("Files")) return;
    dropEnterCountRef.current -= 1;
    if (dropEnterCountRef.current <= 0) {
      dropEnterCountRef.current = 0;
      setIsDropHovering(false);
    }
  };

  const handleComposeDragOver = (event: React.DragEvent<HTMLElement>) => {
    if (writeLocked || submitting) return;
    event.preventDefault();
    if (event.dataTransfer?.types.includes("Files")) {
      setIsDropHovering(true);
    }
  };

  const handleComposeDrop = (event: React.DragEvent<HTMLElement>) => {
    if (writeLocked || submitting) return;
    event.preventDefault();
    dropEnterCountRef.current = 0;
    setIsDropHovering(false);

    const droppedFiles = extractAttachmentsFromDrop(event.dataTransfer);
    if (!droppedFiles.length) return;
    enqueueAllowedFiles(droppedFiles);
  };

  const handleComposePaste = (event: React.ClipboardEvent<HTMLElement>) => {
    if (writeLocked || submitting) return;

    const pastedFiles = extractAttachmentsFromDrop(event.clipboardData);
    if (pastedFiles.length > 0) {
      event.preventDefault();
      enqueueAllowedFiles(pastedFiles);
      return;
    }

    const pastedText = event.clipboardData?.getData("text") ?? "";
    const pastedUrl = extractUrlFromPaste(pastedText);
    if (!pastedUrl) return;

    event.preventDefault();
    updateDraft({ url: pastedUrl });
    setStatusMessage("붙여넣은 URL을 첨부에 채웠어요.");
  };

  const resetDraft = () => {
    setDrafts((prev) => ({
      ...prev,
      [activeWallId]: { ...emptyDraft },
    }));

    if (draftKey) {
      clearDraft(draftKey);
    }
    setRestoreCandidates((prev) => {
      const next = { ...prev };
      delete next[activeWallId];
      return next;
    });
  };

  const restoreCandidate = restoreCandidates[activeWallId];

  const handleRestoreDraft = () => {
    if (!restoreCandidate) return;
    updateDraft({ text: restoreCandidate.text, url: restoreCandidate.url });
    setRestoreCandidates((prev) => {
      const next = { ...prev };
      delete next[activeWallId];
      return next;
    });
  };

  const handleDeleteStoredDraft = () => {
    if (draftKey) {
      clearDraft(draftKey);
    }
    setRestoreCandidates((prev) => {
      const next = { ...prev };
      delete next[activeWallId];
      return next;
    });
  };

  const setActiveUploadTasks = (tasks: UploadTask[]) => {
    setUploadTasksByWall((prev) => ({
      ...prev,
      [activeWallId]: tasks,
    }));
  };

  const cancelUploadTask = (taskId: string) => {
    setUploadTasksByWall((prev) => ({
      ...prev,
      [activeWallId]: cancelTask(prev[activeWallId] ?? [], taskId),
    }));
  };

  const runPendingUploads = async (cardId: string, studentClientId: string | null) => {
    setStatusMessage("첨부 파일을 업로드하는 중...");
    let queuedTasks = uploadTasksByWall[activeWallId] ?? [];
    let totalSavedBytes = 0;

    while (queuedTasks.some((task) => task.state === "pending")) {
      queuedTasks = await startNext(
        queuedTasks,
        async (task, signal) => {
          const uploadResult = await uploadFileToCard(cardId, task.file, {
            initiateUrl: isStudent
              ? routes.api.v1("share", code ?? "", "cards", cardId, "files", "initiate")
              : undefined,
            finalizeUrl: isStudent
              ? (fileId) => routes.api.v1("share", code ?? "", "files", fileId, "finalize")
              : undefined,
            initiateBodyExtras: isStudent ? { clientId: studentClientId } : undefined,
            finalizeBody: isStudent ? { clientId: studentClientId } : undefined,
            signal,
          });

          if (!uploadResult.ok) {
            throw createUploadError(uploadResult.error, {
              message: uploadResult.error,
              requestId: uploadResult.errorDiagnostics?.requestId,
              status: uploadResult.errorDiagnostics?.status,
              code: uploadResult.errorDiagnostics?.code,
            });
          }

          totalSavedBytes += uploadResult.savedBytes ?? 0;
        },
        setActiveUploadTasks,
      );
    }

    const failedTasks = queuedTasks.filter((task) => task.state === "failed");
    if (failedTasks.length > 0) {
      if (isDev) {
        for (const task of failedTasks) {
          if (task.errorDiagnostics) {
            console.debug("[upload:failed]", task.errorDiagnostics);
          }
        }
      }
      setRetryHint("submit");
      setStatusMessage("업로드 실패 · 재시도/취소를 선택해 주세요.");
      setErrorMessage(toUserMessage(classifyUploadError(failedTasks[0]?.error)));
      return false;
    }

    if (totalSavedBytes > 0) {
      setStatusMessage(`첨부 업로드 완료 · 절감 ${formatFileSize(totalSavedBytes)}`);
    } else {
      setStatusMessage("카드와 첨부 업로드가 완료되었습니다.");
    }

    return true;
  };

  const retryUploadTask = (taskId: string) => {
    setUploadTasksByWall((prev) => ({
      ...prev,
      [activeWallId]: retryTask(prev[activeWallId] ?? [], taskId),
    }));

    if (activeUploadCardId && !submitting) {
      void handleSubmit();
    }
  };

  const uploadStateLabel = (state: UploadTask["state"]) => {
    if (state === "uploading") return "업로드 중";
    if (state === "committed") return "완료";
    if (state === "failed") return "실패";
    return "대기 중";
  };

  const handleSubmit = async () => {
    if (!activeWallId || submitting || submissionLocked) return;

    const hasQueuedUploads = uploadTasks.some(
      (task) => task.state === "pending" || task.state === "failed" || task.state === "uploading",
    );

    if (!hasQueuedUploads && isStudent && !turnstileToken) {
      setErrorMessage("Turnstile 인증을 완료해주세요.");
      return;
    }

    const trimmedText = draft.text.trim();
    const normalizedUrl = normalizeHttpUrl(draft.url);
    const textValue = trimmedText.length > 0 ? trimmedText : normalizedUrl ?? "첨부 파일";
    const externalAttachments = upsertCardUrlAttachment([], normalizedUrl);

    if (
      !hasQueuedUploads &&
      isStudent &&
      trimmedText.length === 0 &&
      draft.attachments.length === 0 &&
      externalAttachments.length === 0
    ) {
      setErrorMessage("내용 또는 첨부를 입력해주세요.");
      return;
    }

    if (!hasQueuedUploads && isStudent && trimmedText.length > MAX_STUDENT_TEXT_LENGTH) {
      setErrorMessage(`카드 내용은 ${MAX_STUDENT_TEXT_LENGTH}자 이내로 입력해주세요.`);
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    setRetryHint(null);

    try {
      let cardId: string | null = activeUploadCardId;
      const studentClientId = isStudent ? getOrCreateStudentDeviceId() : null;

      if (cardId && hasQueuedUploads) {
        setActiveUploadTasks(
          uploadTasks.map((task) =>
            task.state === "failed" ? { ...task, state: "pending", error: undefined } : task,
          ),
        );

        const uploadDone = await runPendingUploads(cardId, studentClientId);
        if (!uploadDone) {
          return;
        }

        if (isStudent && draft.authorName.trim()) {
          window.localStorage.setItem("student-card-author-name", draft.authorName.trim());
        }
        resetDraft();
        setActiveUploadTasks([]);
        setUploadCardIdsByWall((prev) => {
          const next = { ...prev };
          delete next[activeWallId];
          return next;
        });
        setTurnstileToken(null);
        setWidgetKey((prev) => prev + 1);
        router.refresh();
        return;
      }

      setStatusMessage("카드를 생성하는 중...");

      if (mode === "teacher") {
        if (!boardId) {
          throw new Error("보드 정보를 확인할 수 없습니다.");
        }
        const response = await fetch(routes.api.v1("dashboard", "walls", activeWallId, "cards"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ boardId, text: textValue, externalAttachments }),
        });
        const payload = (await response.json()) as { ok?: boolean; error?: string; cardId?: string };
        if (!response.ok || !payload.cardId) {
          throw new Error(payload.error ?? "카드 생성에 실패했습니다.");
        }
        cardId = payload.cardId;
      } else {
        if (!code) {
          throw new Error("공유 코드를 확인할 수 없습니다.");
        }
        const response = await fetch(routes.api.v1("share", code, "walls", activeWallId, "cards"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: textValue,
            authorName: draft.authorName.trim() || undefined,
            turnstileToken,
            clientId: studentClientId,
            externalAttachments,
          }),
        });
        const payload = (await response.json()) as {
          ok?: boolean;
          error?: string | { code?: string; message?: string };
          cardId?: string;
        };

        const errorMessage =
          typeof payload.error === "string" ? payload.error : payload.error?.message;
        const errorCode =
          typeof payload.error === "string" ? payload.error : payload.error?.code;

        if (response.status === 429 || errorMessage === "too_fast" || errorCode === "RATE_LIMITED") {
          setErrorMessage("잠시만요! 10초 후에 다시 작성할 수 있어요.");
          setWidgetKey((prev) => prev + 1);
          setTurnstileToken(null);
          return;
        }

        if (response.status === 403 && (errorMessage === "class_ended" || errorCode === "CLASS_ENDED")) {
          setErrorMessage("오늘 수업은 종료되었어요. 다음에 다시 만나요!");
          setWidgetKey((prev) => prev + 1);
          setTurnstileToken(null);
          return;
        }

        if (!response.ok || !payload.cardId) {
          throw new Error(errorMessage ?? "카드 작성에 실패했습니다.");
        }

        cardId = payload.cardId;
      }

      if (!cardId) {
        throw new Error("카드를 생성하지 못했습니다.");
      }

      if (draft.attachments.length === 0) {
        setStatusMessage("카드를 추가했습니다.");
        resetDraft();
        setTurnstileToken(null);
        setWidgetKey((prev) => prev + 1);
        router.refresh();
        return;
      }

      const queuedTasks = enqueue([], draft.attachments);
      setActiveUploadTasks(queuedTasks);
      setUploadCardIdsByWall((prev) => ({
        ...prev,
        [activeWallId]: cardId,
      }));

      const uploadDone = await runPendingUploads(cardId, studentClientId);
      if (!uploadDone) {
        return;
      }

      if (isStudent && draft.authorName.trim()) {
        window.localStorage.setItem("student-card-author-name", draft.authorName.trim());
      }
      resetDraft();
      setActiveUploadTasks([]);
      setUploadCardIdsByWall((prev) => {
        const next = { ...prev };
        delete next[activeWallId];
        return next;
      });
      setTurnstileToken(null);
      setWidgetKey((prev) => prev + 1);
      router.refresh();
    } catch (error) {
      const uploadError = createUploadError(error);
      setErrorMessage(uploadError.message);
      setRetryHint((prev) => prev ?? "submit");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = () => {
    if (retryHint === "files") {
      setErrorMessage(null);
      return;
    }
    void handleSubmit();
  };

  const panelClasses = isOpen
    ? "translate-y-0 sm:translate-x-0"
    : "translate-y-full sm:translate-y-0 sm:translate-x-full";

  return (
    <div
      ref={panelRef}
      data-wheel-layer="compose-panel"
      className={`fixed inset-x-0 bottom-0 z-50 flex max-h-[90vh] flex-col rounded-t-2xl border bg-white shadow-2xl transition-transform duration-300 sm:inset-y-0 sm:right-0 sm:left-auto sm:max-h-full sm:w-[420px] sm:rounded-none ${isDropHovering ? "border-indigo-400" : "border-gray-200"} ${panelClasses}`}
      style={{ pointerEvents: isOpen ? "auto" : "none" }}
      onPaste={handleComposePaste}
      onDrop={handleComposeDrop}
      onDragEnter={handleComposeDragEnter}
      onDragLeave={handleComposeDragLeave}
      onDragOver={handleComposeDragOver}
    >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-gray-900">카드 작성</p>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs text-gray-500">{isStudent ? "학생" : "교사"} 모드</p>
              {initialTemplate ? (
                <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                  {initialTemplate.label}
                </span>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
          >
            닫기
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {isDropHovering ? (
            <div className="border border-dashed border-indigo-300 px-3 py-2 text-xs text-indigo-700">
              파일을 놓아 첨부 목록에 추가하세요.
            </div>
          ) : null}

          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-700" htmlFor="compose-wall-select">
              담벼락 선택
            </label>
            <select
              id="compose-wall-select"
              value={activeWallId}
              onChange={(event) => setSelectedWallId(event.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
              disabled={walls.length === 0}
            >
              {wallOptions.map((wall) => (
                <option key={wall.id} value={wall.id}>
                  {wall.title}
                </option>
              ))}
            </select>
          </div>

          {restoreCandidate ? (
            <div className="flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
              <p className="text-[11px] text-emerald-900">임시저장된 초안이 있습니다.</p>
              <div className="ml-3 flex items-center gap-2 text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={handleRestoreDraft}
                  className="text-emerald-700 hover:text-emerald-900"
                >
                  복원
                </button>
                <button
                  type="button"
                  onClick={handleDeleteStoredDraft}
                  className="text-emerald-700/80 hover:text-emerald-900"
                >
                  삭제
                </button>
              </div>
            </div>
          ) : null}

          {isStudent ? (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-700" htmlFor="compose-author-name">
                닉네임 (선택)
              </label>
              <input
                id="compose-author-name"
                type="text"
                maxLength={20}
                value={draft.authorName}
                onChange={(event) => updateDraft({ authorName: event.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                placeholder="예: 즐거운 학생"
                disabled={writeLocked || submitting}
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-700" htmlFor="compose-text">
              글쓰기
            </label>
            {initialTemplate?.guidance.length ? (
              <div className="space-y-1 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2">
                <p className="text-xs font-semibold text-indigo-900">{initialTemplate.label} 안내</p>
                <ul className="space-y-0.5 text-[11px] leading-5 text-indigo-800">
                  {initialTemplate.guidance.map((line) => (
                    <li key={line}>· {line}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {showVibeCodingTemplates ? (
              <div className="space-y-2 rounded-md border border-violet-200 bg-violet-50 px-3 py-2">
                <p className="text-xs font-semibold text-violet-900">바이브코딩 제출 도우미</p>
                <p className="text-[11px] text-violet-800">링크가 있으면 URL 칸에 붙여넣고, 링크가 없으면 오늘 시도한 내용을 글로 남기세요.</p>
                <p className="text-[11px] font-medium text-violet-900">실명, 전화번호, 주소, 학교명, 얼굴 사진은 넣지 마세요.</p>
                <div className="flex flex-wrap gap-1.5">
                  {VIBE_COMPOSE_TEMPLATES.map((template) => (
                    <button
                      key={template.key}
                      type="button"
                      onClick={() => updateDraft({ text: insertVibeTemplateText(draft.text, template.body) })}
                      className="rounded-full border border-violet-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-violet-700 hover:bg-violet-100"
                      disabled={writeLocked || submitting}
                    >
                      {template.label.replace(" 제출", "")}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <textarea
              id="compose-text"
              ref={textareaRef}
              rows={4}
              value={draft.text}
              onChange={(event) => updateDraft({ text: event.target.value })}
              maxLength={isStudent ? MAX_STUDENT_TEXT_LENGTH : undefined}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none"
              placeholder="내용 입력"
              disabled={writeLocked || submitting}
            />
            {isStudent ? (
              <p className="text-[11px] text-gray-500">
                최대 {MAX_STUDENT_TEXT_LENGTH}자까지 입력할 수 있어요.
              </p>
            ) : null}
          </div>

          <div className="space-y-2 rounded-md border border-gray-200 p-3">
            <p className="text-xs font-semibold text-gray-800">첨부</p>
            <div className="space-y-2">
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
                <span className="text-xs text-gray-500">🔗 URL</span>
                <input
                  type="url"
                  value={draft.url}
                  onChange={(event) => updateDraft({ url: event.target.value })}
                  placeholder="https://"
                  className="min-w-0 rounded-md border border-gray-300 px-2 py-1.5 text-xs text-gray-900"
                  disabled={writeLocked || submitting}
                />
                <a
                  href={normalizeHttpUrl(draft.url) ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) => {
                    if (!normalizeHttpUrl(draft.url)) event.preventDefault();
                  }}
                  className={`rounded-md border px-2 py-1 text-xs font-semibold ${
                    normalizeHttpUrl(draft.url)
                      ? "border-gray-300 text-gray-700 hover:bg-gray-50"
                      : "cursor-not-allowed border-gray-200 text-gray-400"
                  }`}
                  aria-disabled={!normalizeHttpUrl(draft.url)}
                >
                  입장
                </a>
              </div>

              <div className="grid grid-cols-[auto_1fr] items-center gap-2">
                <span className="text-xs text-gray-500">🖼 그림</span>
                <label
                  className={`inline-flex w-fit cursor-pointer items-center rounded-md border px-2 py-1 text-xs font-semibold ${
                    writeLocked || submitting
                      ? "cursor-not-allowed border-gray-200 text-gray-400"
                      : "border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="file"
                    multiple
                    accept={acceptedImageTypes}
                    className="hidden"
                    onChange={handleFileInputChange}
                    disabled={writeLocked || submitting}
                  />
                  그림 넣기
                </label>
              </div>

              <div className="grid grid-cols-[auto_1fr] items-center gap-2">
                <span className="text-xs text-gray-500">📎 파일</span>
                <label
                  className={`inline-flex w-fit cursor-pointer items-center rounded-md border px-2 py-1 text-xs font-semibold ${
                    writeLocked || submitting
                      ? "cursor-not-allowed border-gray-200 text-gray-400"
                      : "border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="file"
                    multiple
                    accept={acceptedGenericFileTypes}
                    className="hidden"
                    onChange={handleFileInputChange}
                    disabled={writeLocked || submitting}
                  />
                  파일 첨부
                </label>
              </div>
            </div>

            {normalizeHttpUrl(draft.url) || draft.attachments.length > 0 || uploadTasks.length > 0 ? (
              <div className="space-y-1">
                <p className="text-[11px] font-semibold text-gray-600">첨부 항목</p>
                <ul className="space-y-1 text-[11px] text-gray-700">
                  {normalizeHttpUrl(draft.url) ? (
                    <li className="flex items-center justify-between rounded-md border border-gray-200 px-2 py-1.5">
                      <span className="min-w-0 truncate">🔗 {formatCardUrlLabel(normalizeHttpUrl(draft.url) ?? "")}</span>
                      <button
                        type="button"
                        onClick={() => updateDraft({ url: "" })}
                        className="ml-2 text-[11px] font-semibold text-gray-500 hover:text-gray-800"
                        disabled={writeLocked || submitting}
                      >
                        제거
                      </button>
                    </li>
                  ) : null}
                  {(uploadTasks.length > 0
                    ? uploadTasks.map((task, index) => ({
                        key: task.id,
                        file: task.file,
                        state: task.state,
                        error: task.error,
                        diagnostics: task.errorDiagnostics,
                        index,
                      }))
                    : draft.attachments.map((file, index) => ({
                        key: `${file.name}-${file.size}-${index}`,
                        file,
                        state: "pending" as const,
                        error: undefined,
                        diagnostics: undefined,
                        index,
                      }))).map((item) => (
                    <li
                      key={item.key}
                      className="flex items-center justify-between rounded-md border border-gray-200 px-2 py-1.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate">📎 {item.file.name}</p>
                        <p className="text-[10px] text-gray-500">{formatFileSize(item.file.size)} · {uploadStateLabel(item.state)}</p>
                        {item.state === "failed" ? (
                          <div className="mt-0.5 space-y-1">
                            <p className="text-[10px] text-gray-600">업로드 실패 · 재시도/취소를 선택해 주세요.</p>
                            {isDev && item.diagnostics ? (
                              <div className="text-[10px] text-gray-500">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedDiagnosticsTaskIds((prev) => ({
                                      ...prev,
                                      [item.key]: !prev[item.key],
                                    }))
                                  }
                                  className="font-semibold text-gray-500 hover:text-gray-800"
                                >
                                  자세히
                                </button>
                                {expandedDiagnosticsTaskIds[item.key] ? (
                                  <p className="mt-0.5">
                                    debug token: {item.diagnostics.debugToken}
                                    {item.diagnostics.requestId ? ` · requestId: ${item.diagnostics.requestId}` : ""}
                                  </p>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                      {uploadTasks.length > 0 ? (
                        <div className="ml-2 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => cancelUploadTask(item.key)}
                            className="text-[11px] font-semibold text-gray-500 hover:text-gray-800"
                            disabled={writeLocked || item.state === "committed"}
                          >
                            취소
                          </button>
                          <button
                            type="button"
                            onClick={() => retryUploadTask(item.key)}
                            className="text-[11px] font-semibold text-gray-500 hover:text-gray-800"
                            disabled={writeLocked || item.state !== "failed"}
                          >
                            재시도
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => attachmentQueue.removeFile(item.index)}
                          className="ml-2 text-[11px] font-semibold text-gray-500 hover:text-gray-800"
                          disabled={writeLocked || submitting}
                        >
                          제거
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-[11px] text-gray-500">첨부 항목 없음</p>
            )}
          </div>

          {isStudent ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-700">스팸 방지 인증</p>
              <TurnstileWidget key={widgetKey} onToken={setTurnstileToken} action="share_card_create" cData="share-card-create" />
            </div>
          ) : null}

          {submissionLocked ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              {wallWriteLocked
                ? "이 섹션은 제출이 닫혔어요."
                : (writeLockedMessage ?? "지금은 글쓰기가 잠겨 있습니다.")}
            </div>
          ) : null}

          {statusMessage ? (
            <p className="text-xs text-gray-600">{statusMessage}</p>
          ) : null}
          {errorMessage ? (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              <div className="flex items-center justify-between gap-3">
                <p className="line-clamp-2">{errorMessage}</p>
                <button
                  type="button"
                  onClick={handleRetry}
                  className="shrink-0 rounded border border-rose-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-100"
                >
                  재시도
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="border-t border-gray-200 px-5 py-4">
          {wallWriteLocked ? (
            <p className="mb-2 text-xs font-semibold text-amber-600">
              이 섹션은 제출이 닫혔어요.
            </p>
          ) : null}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={
              submitting ||
              submissionLocked ||
              !activeWallId ||
              (isStudent && !turnstileToken)
            }
            className="w-full rounded-lg bg-black px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {submitting ? "작성 중..." : "카드 작성"}
          </button>
        </div>
    </div>
  );
}
