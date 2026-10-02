"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type DragEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";
import { useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";

import {
  buildLocalPreviewDocument,
  type ManualFile,
} from "@/app/dashboard/boards/[boardId]/board/_components/studentAppLocalPreview";
import {
  buildSelectedFileSummary,
  buildSelectedManualFileSummary,
} from "@/app/dashboard/boards/[boardId]/board/_components/studentAppSourceInspectorHelpers";
import {
  HTML_LESSON_KIT_REGISTRY,
  getHtmlLessonKitById,
  getLessonKitSampleUrls,
  getLessonKitStudentDownloads,
  type LessonKitDownloadFile,
} from "@/lib/curriculum/lessonKitRegistry";
import { fileToStudentAppManualFile, filesToStudentAppManualFiles } from "@/lib/student-apps/clientFilePayload";
import { checkStudentAppFileRule, studentAppIssueMessage, STUDENT_APP_MAX_FILE_COUNT, STUDENT_APP_MAX_TOTAL_SIZE_BYTES } from "@/lib/student-apps/fileRules";
import {
  runRuleBasedCodeCoach,
  type CodeCoachItem,
  type CodeCoachLevel,
} from "@/lib/student-apps/ruleBasedCodeCoach";
import { apiV1Path } from "@/lib/standards/pathTypes";
import { useModalScrollLock } from "@/lib/ui/useModalScrollLock";
import { loadSubmissionStatusCapabilities, saveSubmissionStatusCapability } from "@/lib/student-apps/clientSubmissionStatusCapabilities";
import StudentAppGalleryPanel from "./StudentAppGalleryPanel";

type DisplayMode = "button" | "inline" | "modal-host";
type SourceFileKey = "html" | "css" | "js";
type SubmitSuccessPayload = {
  ok: true;
  submission?: { id?: unknown; statusCapability?: unknown };
  autoPublish?: { status?: "published" | "publish_failed" | "needs_teacher_review" | "teacher_review" | "session_closed"; publicUrl?: unknown };
};
type SubmitErrorPayload = { ok?: false; reason?: string; errors?: string[]; error?: { code?: string } };
type LessonKitCodeViewerState = {
  path: string;
  label: string;
  codeView: "html" | "css" | "js";
  content: string;
};
type StudentSubmissionStatus = {
  version?: number | null;
  isLatest?: boolean | null;
  id: string;
  title: string | null;
  status: "submitted" | "needs_fix" | "accepted" | "archived" | string;
  teacherNote: string | null;
  reviewedAt: string | null;
  archivedAt: string | null;
  createdAt: string | null;
};
type SourceFiles = Record<SourceFileKey, string>;
type DroppedFileCandidate = { file: File; path: string };
type WebkitFileSystemEntry = {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  fullPath: string;
};
type WebkitFileSystemFileEntry = WebkitFileSystemEntry & {
  isFile: true;
  file: (success: (file: File) => void, error?: (error: DOMException) => void) => void;
};
type WebkitFileSystemDirectoryEntry = WebkitFileSystemEntry & {
  isDirectory: true;
  createReader: () => {
    readEntries: (
      success: (entries: WebkitFileSystemEntry[]) => void,
      error?: (error: DOMException) => void,
    ) => void;
  };
};
type StudentAppSubmitPanelProps = {
  boardId: string;
  shareCode?: string | null;
  accessCode?: string | null;
  studentSessionToken?: string | null;
  guestToken?: string | null;
  classId?: string | null;
  displayMode?: DisplayMode;
};
type SubmitModalCloseReason = "backdrop" | "escape" | "close-button" | "submit-success" | "programmatic";
type SubmitModalCloseEvent = Event | MouseEvent<HTMLElement>;

const submitModalOpenByBoard = new Map<string, boolean>();
const submitModalListenersByBoard = new Map<string, Set<(open: boolean) => void>>();

function getSubmitModalStateKey(boardId: string, shareCode?: string | null) {
  return `${boardId}:${shareCode?.trim().toLowerCase() || "unknown-share"}`;
}

export function isStudentAppSubmitModalOpenForDebug(boardId: string, shareCode?: string | null) {
  return submitModalOpenByBoard.get(getSubmitModalStateKey(boardId, shareCode)) === true;
}

function setSubmitModalState(stateKey: string, nextOpen: boolean) {
  submitModalOpenByBoard.set(stateKey, nextOpen);
  submitModalListenersByBoard.get(stateKey)?.forEach((listener) => listener(nextOpen));
}

function subscribeToSubmitModalState(stateKey: string, listener: (open: boolean) => void) {
  const listeners = submitModalListenersByBoard.get(stateKey) ?? new Set<(open: boolean) => void>();
  listeners.add(listener);
  submitModalListenersByBoard.set(stateKey, listeners);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) submitModalListenersByBoard.delete(stateKey);
  };
}

const MAX_FILES = STUDENT_APP_MAX_FILE_COUNT;
const MAX_TOTAL_SIZE = STUDENT_APP_MAX_TOTAL_SIZE_BYTES;
const FOLDER_DROP_UNSUPPORTED_MESSAGE =
  "이 브라우저에서는 폴더 드롭이 제한될 수 있어요. ZIP으로 압축해서 가져와 주세요.";
const STATIC_DROP_READY_MESSAGE = "여기에 놓으면 정적 파일을 가져옵니다";
const STATIC_IMPORT_GUIDANCE =
  "HTML/CSS/JS 파일과 이미지·음원(MIDI 포함)·폰트가 들어 있는 폴더나 ZIP을 여기에 끌어다 놓을 수 있어요. React/Vite/Next.js 프로젝트는 먼저 빌드한 뒤 dist 폴더나 ZIP으로 가져와 주세요.";
const STUDENT_APP_SUBMIT_MODAL_Z_CLASS = "z-[10000]";
const LOCAL_SUBMISSION_IDS_MAX = 20;
const EMPTY_SOURCE_FILES: SourceFiles = { html: "", css: "", js: "" };
const LESSON_TEMPLATE_OVERWRITE_CONFIRM =
  "수업 템플릿을 불러오면 현재 HTML/CSS/JS 초안이나 선택한 파일이 바뀝니다. 계속할까요?";
const LESSON_TEMPLATE_LOAD_ERROR =
  "수업 템플릿을 불러오지 못했어요. HTML/CSS/JS를 직접 입력하거나 ZIP을 가져올 수 있어요.";
const LESSON_NAVIGATION_CONFIRM =
  "다른 차시로 이동하면 아직 제출하지 않은 수정 내용이 사라질 수 있어요. 이동할까요?";
const STUDENT_APP_DOWNLOAD_EMPTY_CONFIRM = "아직 저장할 코드가 거의 없어요. 그래도 다운로드할까요?";
const THEME_STORAGE_KEY = "gomdory:student-coding-workspace-theme";
const SPLIT_STORAGE_KEY = "gomdory:student-coding-workspace-split";
const DRAFT_STORAGE_VERSION = 1;
const SUBMISSION_NETWORK_ERROR_MESSAGE =
  "연결이 잠시 불안정해요. 작성 내용은 이 브라우저에 남아 있어요. 잠시 후 다시 제출해 주세요.";
const LESSON_11_3D_MISSION_ROOM_ID = "lesson-11-ai-3d-mission-room";
const LESSON_11_3D_PLAY_MODE_SRC = "/lesson-kits/html/lesson-11-ai-3d-mission-room/index.html?mode=play";
const LESSON_11_3D_DOCK_MODE_SRC = "/lesson-kits/html/lesson-11-ai-3d-mission-room/index.html?mode=play&dock=1";
const LESSON_13_AI_CAMERA_CARD_ID = "lesson-13-ai-camera-card";
const LESSON_13_AWARD_VR_LAB_HREF = "/events/teacher-day/award-vr-lab";
const MIN_SPLIT_PERCENT = 35;
const MAX_SPLIT_PERCENT = 70;
const CODE_COACH_LEVELS: CodeCoachLevel[] = ["pass", "warn", "challenge"];
const CODE_COACH_LEVEL_LABELS: Record<CodeCoachLevel, string> = {
  pass: "확인됨",
  warn: "살펴보기",
  challenge: "도전 미션",
};

const describeSubmitModalEventTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return null;
  return {
    tag: target.tagName.toLowerCase(),
    class: typeof target.className === "string" ? target.className : "",
    data: { ...target.dataset },
  };
};

const LESSON_KIT_NAV_LABELS: Record<string, { lessonNumber: string; title: string }> = {
  "lesson-05-html-structure": { lessonNumber: "5차시", title: "HTML 구조 이해" },
  "lesson-06-css-styling": { lessonNumber: "6차시", title: "CSS로 화면 꾸미기" },
  "lesson-07-js-interaction": { lessonNumber: "7차시", title: "JavaScript 버튼 응원함" },
  "lesson-08-web-core-basics": { lessonNumber: "8차시", title: "HTML/CSS/JS 핵심 보충" },
  "lesson-09-vscode-file-structure": { lessonNumber: "9차시", title: "VS Code와 파일 구조" },
  "lesson-10-js-reaction-lab": { lessonNumber: "보충", title: "JavaScript 반응 복습" },
  "lesson-10-ai-favorite-page": { lessonNumber: "10차시", title: "AI와 함께 만드는 주제 소개 페이지" },
  "lesson-11-ai-3d-mission-room": { lessonNumber: "11차시", title: "AI 3D 미션룸 만들기" },
  "lesson-13-ai-camera-card": { lessonNumber: "13차시", title: "카메라 인식과 AI 포토 카드" },
  "lesson-12-ai-quiz-maker": { lessonNumber: "12차시", title: "AI 문제 만들기와 미니 퀴즈 게임" },
};

const SOURCE_FILE_META: Record<
  SourceFileKey,
  { label: string; fileName: string; helper: string; placeholder: string }
> = {
  html: {
    label: "HTML",
    fileName: "index.html",
    helper: "화면 내용",
    placeholder: "<main>\n  <h1>나의 앱</h1>\n  <button id=\"helloButton\">눌러 보기</button>\n</main>",
  },
  css: {
    label: "CSS",
    fileName: "style.css",
    helper: "색과 모양",
    placeholder: "body {\n  font-family: system-ui, sans-serif;\n}\nbutton {\n  cursor: pointer;\n}",
  },
  js: {
    label: "JS",
    fileName: "script.js",
    helper: "버튼 움직임",
    placeholder: "document.querySelector('#helloButton')?.addEventListener('click', () => {\n  alert('작동해요!');\n});",
  },
};

const formatBytes = (size?: number | null) =>
  !size || size <= 0
    ? "0 B"
    : size < 1024
      ? `${size} B`
      : size < 1024 * 1024
        ? `${(size / 1024).toFixed(1)} KB`
        : `${(size / (1024 * 1024)).toFixed(2)} MB`;

const statusLabel = (value: StudentSubmissionStatus["status"]) =>
  value === "submitted"
    ? "제출됨"
    : value === "needs_fix"
      ? "수정 필요"
      : value === "accepted"
        ? "확인됨"
        : value === "archived"
          ? "숨김"
          : "제출됨";

const statusHelpText = (value: StudentSubmissionStatus["status"]) =>
  value === "needs_fix"
    ? "선생님이 수정을 요청했어요. 파일을 고친 뒤 다시 제출해요."
    : value === "accepted"
      ? "선생님이 작품을 확인했어요. 공개되면 친구 작품도 함께 살펴볼 수 있어요."
      : value === "archived"
        ? "이 작품은 갤러리에 보이지 않아요."
        : "작품을 제출했어요. 선생님 확인 뒤 친구 작품도 함께 살펴볼 수 있어요.";

const clampSplitPercent = (value: number) => Math.min(MAX_SPLIT_PERCENT, Math.max(MIN_SPLIT_PERCENT, value));
const normalizeDroppedPath = (value: string) =>
  value.trim().replace(/\\+/g, "/").replace(/\/+/g, "/").replace(/^\/+/, "").replace(/^\.\//, "");
const shouldSkipDroppedPath = (path: string) =>
  !path ||
  path.endsWith("/") ||
  /(^|\/)(node_modules|\.git)(\/|$)/i.test(path) ||
  /(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db)$/i.test(path);
const isZipFile = (file: File) =>
  file.name.toLowerCase().endsWith(".zip") ||
  file.type === "application/zip" ||
  file.type === "application/x-zip-compressed";

function getWebkitEntry(item: DataTransferItem): WebkitFileSystemEntry | null {
  const maybeItem = item as DataTransferItem & {
    webkitGetAsEntry?: () => WebkitFileSystemEntry | null;
  };
  return typeof maybeItem.webkitGetAsEntry === "function" ? maybeItem.webkitGetAsEntry() : null;
}

function readWebkitFile(entry: WebkitFileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

function readDirectoryEntries(entry: WebkitFileSystemDirectoryEntry): Promise<WebkitFileSystemEntry[]> {
  const reader = entry.createReader();
  const entries: WebkitFileSystemEntry[] = [];

  return new Promise((resolve, reject) => {
    const readBatch = () => {
      reader.readEntries((batch) => {
        if (batch.length === 0) {
          resolve(entries);
          return;
        }
        entries.push(...batch);
        readBatch();
      }, reject);
    };
    readBatch();
  });
}

async function readDroppedEntryFiles(
  entry: WebkitFileSystemEntry,
  basePath = "",
): Promise<DroppedFileCandidate[]> {
  const path = normalizeDroppedPath(`${basePath}/${entry.name}`);
  if (shouldSkipDroppedPath(path)) return [];

  if (entry.isFile) {
    const file = await readWebkitFile(entry as WebkitFileSystemFileEntry);
    return [{ file, path }];
  }

  if (!entry.isDirectory) return [];

  const children = await readDirectoryEntries(entry as WebkitFileSystemDirectoryEntry);
  const nested = await Promise.all(children.map((child) => readDroppedEntryFiles(child, path)));
  return nested.flat();
}

async function dataTransferToDroppedFiles(dataTransfer: DataTransfer): Promise<{
  files: DroppedFileCandidate[];
  sawDirectory: boolean;
  unsupportedDirectory: boolean;
}> {
  const items = Array.from(dataTransfer.items ?? []).filter((item) => item.kind === "file");
  const entries = items.map(getWebkitEntry).filter((entry): entry is WebkitFileSystemEntry => Boolean(entry));

  if (entries.length > 0) {
    const nested = await Promise.all(entries.map((entry) => readDroppedEntryFiles(entry)));
    return {
      files: nested.flat(),
      sawDirectory: entries.some((entry) => entry.isDirectory),
      unsupportedDirectory: false,
    };
  }

  const files = Array.from(dataTransfer.files ?? []).map((file) => ({ file, path: file.name }));
  return {
    files,
    sawDirectory: false,
    unsupportedDirectory: items.length > 0 && files.length === 0,
  };
}

function sourceFilesToManualFiles(sourceFiles: SourceFiles): ManualFile[] {
  return [
    { name: "index.html", path: "index.html", contentType: "text/html", contentText: sourceFiles.html },
    { name: "style.css", path: "style.css", contentType: "text/css", contentText: sourceFiles.css },
    { name: "script.js", path: "script.js", contentType: "text/javascript", contentText: sourceFiles.js },
  ];
}

function hasSourceContent(sourceFiles: SourceFiles) {
  return Boolean(sourceFiles.html.trim() || sourceFiles.css.trim() || sourceFiles.js.trim());
}

function parseDraftSourceFiles(raw: string | null): SourceFiles | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { sourceFiles?: Partial<SourceFiles> };
    const draft = parsed.sourceFiles;
    if (!draft) return null;
    return {
      html: typeof draft.html === "string" ? draft.html : "",
      css: typeof draft.css === "string" ? draft.css : "",
      js: typeof draft.js === "string" ? draft.js : "",
    };
  } catch {
    return null;
  }
}

function buildStudentCodingLessonPath(code: string, lessonKitId: string) {
  return `/s/${encodeURIComponent(code)}?view=student-app&lessonKit=${encodeURIComponent(lessonKitId)}`;
}

type SubmissionIssue = { path: string; reason: string; solution: string };
function manualFileSize(file: ManualFile) {
  if (typeof file.contentText === "string") return new TextEncoder().encode(file.contentText).byteLength;
  const base64 = file.contentBase64?.replace(/\s+/g, "") ?? "";
  return Math.max(0, Math.floor((base64.length * 3) / 4) - (base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0));
}
function describeSubmissionErrors(errors: readonly string[]): SubmissionIssue[] {
  return errors.map((error) => {
    const [kind, ...rest] = error.split(":");
    const path = rest.join(":") || "작품";
    if (kind === "missing_index_html") return { path: "index.html", reason: "시작 파일이 없어요", solution: "작품의 첫 화면 파일 이름을 index.html로 저장해요." };
    if (kind === "total_size_exceeds_limit") return { path: "전체 작품", reason: "전체 용량이 20MB를 넘어요", solution: "이미지나 음원(MIDI 포함) 크기를 줄인 뒤 다시 제출해요." };
    if (kind === "file_count_exceeds_limit") return { path: "전체 작품", reason: "파일 수가 100개를 넘어요", solution: "사용하지 않는 파일을 빼고 다시 제출해요." };
    const message = studentAppIssueMessage(kind as Parameters<typeof studentAppIssueMessage>[0]);
    return message ? { path, ...message } : { path, reason: "제출할 수 없는 파일", solution: "파일 이름과 형식을 확인한 뒤 다시 제출해요." };
  });
}

export default function StudentAppSubmitPanel({
  boardId,
  shareCode,
  accessCode,
  studentSessionToken,
  guestToken,
  classId = null,
  displayMode = "button",
}: StudentAppSubmitPanelProps) {
  const searchParams = useSearchParams();
  const submitModalStateKey = getSubmitModalStateKey(boardId, shareCode);
  const [open, setOpen] = useState(() => submitModalOpenByBoard.get(submitModalStateKey) === true);
  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [templateBusy, setTemplateBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [submissionIssues, setSubmissionIssues] = useState<SubmissionIssue[]>([]);
  const [coachItems, setCoachItems] = useState<CodeCoachItem[] | null>(null);
  const [submittedByName, setSubmittedByName] = useState("");
  const [studentNote, setStudentNote] = useState("");
  const [sourceFiles, setSourceFiles] = useState<SourceFiles>(EMPTY_SOURCE_FILES);
  const [activeFile, setActiveFile] = useState<SourceFileKey>("html");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedManualFiles, setSelectedManualFiles] = useState<ManualFile[]>([]);
  const [zipImportedFiles, setZipImportedFiles] = useState<ManualFile[]>([]);
  const [intakeIgnoredFiles, setIntakeIgnoredFiles] = useState<SubmissionIssue[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("light");
  const [splitPercent, setSplitPercent] = useState(55);
  const [previewRevision, setPreviewRevision] = useState(0);
  const [submissionStatuses, setSubmissionStatuses] = useState<StudentSubmissionStatus[]>([]);
  const [statusBusy, setStatusBusy] = useState(false);
  const [playModeOpen, setPlayModeOpen] = useState(false);
  const [workModeOpen, setWorkModeOpen] = useState(false);
  const [workModeRevision, setWorkModeRevision] = useState(0);
  const [draftReadyKey, setDraftReadyKey] = useState<string | null>(null);
  const [resourceHelpOpen, setResourceHelpOpen] = useState(false);
  const [codeViewer, setCodeViewer] = useState<LessonKitCodeViewerState | null>(null);
  const [codeActionBusyPath, setCodeActionBusyPath] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const zipInputRef = useRef<HTMLInputElement | null>(null);
  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  const submitInFlightRef = useRef(false);

  const accessProof = useMemo(
    () => ({
      shareCode: shareCode ?? undefined,
      accessCode: accessCode ?? undefined,
      studentSessionToken: studentSessionToken ?? undefined,
      guestToken: guestToken ?? undefined,
    }),
    [accessCode, guestToken, shareCode, studentSessionToken],
  );
  const hasAccessProof = Boolean(
    accessProof.shareCode || accessProof.accessCode || accessProof.studentSessionToken || accessProof.guestToken,
  );
  const editorManualFiles = useMemo(() => sourceFilesToManualFiles(sourceFiles), [sourceFiles]);
  const editorSummary = useMemo(() => buildSelectedManualFileSummary(editorManualFiles), [editorManualFiles]);
  const hasEditorFiles = hasSourceContent(sourceFiles);
  const importedManualFiles =
    zipImportedFiles.length > 0
      ? zipImportedFiles
      : selectedManualFiles.length > 0
        ? selectedManualFiles
        : editorManualFiles;
  const classifiedManualFiles = useMemo(() => importedManualFiles.map((file) => ({
    file,
    rule: checkStudentAppFileRule({ path: file.path ?? file.name, contentType: file.contentType, sizeBytes: manualFileSize(file) }),
  })), [importedManualFiles]);
  const previewManualFiles = useMemo(
    () => classifiedManualFiles.filter(({ rule }) => !rule.skip && rule.classification === "supported").map(({ file }) => file),
    [classifiedManualFiles],
  );
  const hasPreviewFiles = zipImportedFiles.length > 0 || selectedManualFiles.length > 0 || hasEditorFiles;
  const hasFiles = selectedFiles.length > 0 || selectedManualFiles.length > 0 || zipImportedFiles.length > 0 || hasEditorFiles;
  const currentSummary =
    zipImportedFiles.length > 0 || selectedManualFiles.length > 0
      ? buildSelectedManualFileSummary(previewManualFiles)
      : hasEditorFiles
        ? editorSummary
        : buildSelectedFileSummary(selectedFiles);
  const clientFileIssues = useMemo(() => classifiedManualFiles.flatMap(({ file, rule }) =>
    rule.skip || rule.classification !== "blocked-dangerous" || !rule.issue ? [] : [{ path: file.path ?? file.name, ...studentAppIssueMessage(rule.issue) }],
  ), [classifiedManualFiles]);
  const ignoredFiles = useMemo(() => [
    ...classifiedManualFiles.flatMap(({ file, rule }) => rule.skip || rule.classification !== "ignored-safe"
      ? []
      : [{ path: file.path ?? file.name, reason: rule.extension === ".zip" ? "압축 파일은 제출 대상에서 제외했어요." : "웹 작품에 사용하지 않는 원본 파일이라 제외했어요.", solution: "" }]),
    ...intakeIgnoredFiles,
  ], [classifiedManualFiles, intakeIgnoredFiles]);
  const hasValidationIssue =
    currentSummary.hasZip ||
    currentSummary.fileCount > MAX_FILES ||
    currentSummary.totalBytes > MAX_TOTAL_SIZE || clientFileIssues.length > 0 ||
    !currentSummary.hasIndexHtml;
  const looksLikeSourceOnly = currentSummary.hasProjectSourceSignals;
  const canSubmit = hasAccessProof && hasFiles && !hasValidationIssue && !busy;
  const submissionStorageKey = `gomdory:student-app-submissions:${boardId}`;
  const authorStorageKey = `gomdory:student-app-author-id:${boardId}`;
  const lessonKitId = searchParams.get("lessonKit")?.trim() ?? "";
  const debugStudentModal = searchParams.get("debugStudentModal") === "1";
  const draftStorageKey = [
    "gomdory:student-app-draft",
    boardId,
    shareCode?.trim() || "unknown-share",
    lessonKitId || "no-lesson",
  ].join(":");
  const lessonKit = useMemo(() => getHtmlLessonKitById(lessonKitId), [lessonKitId]);
  const lessonKitSampleUrls = useMemo(() => getLessonKitSampleUrls(lessonKitId), [lessonKitId]);
  const lessonKitDownloads = useMemo(() => getLessonKitStudentDownloads(lessonKitId), [lessonKitId]);
  const lessonStudentPreviewAction = lessonKit?.studentPreviewAction;
  const showLesson11PlayMode = lessonKitId === LESSON_11_3D_MISSION_ROOM_ID;
  const showLesson13Launcher = lessonKitId === LESSON_13_AI_CAMERA_CARD_ID;
  const hasUnknownLessonKitQuery = lessonKitId.length > 0 && !lessonKit;
  const lessonKitIndex = useMemo(
    () => HTML_LESSON_KIT_REGISTRY.findIndex((entry) => entry.lessonId === lessonKitId),
    [lessonKitId],
  );
  const lessonNavigation = useMemo(() => {
    if (lessonKitIndex < 0) return null;
    const current = HTML_LESSON_KIT_REGISTRY[lessonKitIndex];
    if (!current) return null;

    const toNavItem = (entry: (typeof HTML_LESSON_KIT_REGISTRY)[number] | undefined) => {
      if (!entry) return null;
      const label = LESSON_KIT_NAV_LABELS[entry.lessonId] ?? {
        lessonNumber: "수업",
        title: entry.title,
      };

      return {
        lessonId: entry.lessonId,
        ...label,
      };
    };

    return {
      previous: toNavItem(HTML_LESSON_KIT_REGISTRY[lessonKitIndex - 1]),
      current: toNavItem(current),
      next: toNavItem(HTML_LESSON_KIT_REGISTRY[lessonKitIndex + 1]),
    };
  }, [lessonKitIndex]);
  const lessonKitCodeFiles = useMemo(
    () =>
      (lessonKitDownloads?.files ?? []).filter(
        (file): file is LessonKitDownloadFile & { codeView: "html" | "css" | "js" } =>
          file.codeView === "html" || file.codeView === "css" || file.codeView === "js",
      ),
    [lessonKitDownloads],
  );
  const previewDocument = useMemo(() => buildLocalPreviewDocument(previewManualFiles), [previewManualFiles]);
  const activeMeta = SOURCE_FILE_META[activeFile];
  const coachItemsByLevel = useMemo(
    () =>
      CODE_COACH_LEVELS.map((level) => ({
        level,
        label: CODE_COACH_LEVEL_LABELS[level],
        items: coachItems?.filter((coachItem) => coachItem.level === level) ?? [],
      })),
    [coachItems],
  );

  const submitDisabledReason = !hasAccessProof
    ? "공유 코드나 학생 접속 정보가 없어 아직 제출할 수 없어요."
    : !hasFiles
      ? "HTML/CSS/JS를 입력하거나 수업 템플릿, 파일, ZIP을 먼저 준비해요."
      : currentSummary.hasZip
        ? "ZIP 파일 자체가 아니라 압축 안의 정적 파일을 제출해요."
        : currentSummary.fileCount > MAX_FILES
          ? `파일은 최대 ${MAX_FILES}개까지 제출할 수 있어요.`
          : currentSummary.totalBytes > MAX_TOTAL_SIZE
            ? `전체 용량은 ${formatBytes(MAX_TOTAL_SIZE)} 이하여야 해요.`
            : clientFileIssues.length > 0
              ? "제출할 수 없는 파일이 있어요. 아래 파일별 안내를 확인해요."
            : !currentSummary.hasIndexHtml
              ? "index.html이 필요해요."
              : null;

  const loadSubmissionIds = useCallback(() => {
    if (typeof window === "undefined") return [] as string[];
    try {
      const parsed = JSON.parse(window.localStorage.getItem(submissionStorageKey) ?? "[]");
      return Array.isArray(parsed)
        ? parsed
            .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
            .slice(0, LOCAL_SUBMISSION_IDS_MAX)
        : [];
    } catch {
      return [];
    }
  }, [submissionStorageKey]);

  const getAuthorClientId = useCallback(() => {
    if (typeof window === "undefined") return null as string | null;
    const existing = window.localStorage.getItem(authorStorageKey)?.trim() ?? "";
    if (existing.length >= 8) return existing;
    const generated =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `author-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(authorStorageKey, generated);
    return generated;
  }, [authorStorageKey]);

  const saveSubmissionId = useCallback(
    (id: string) => {
      if (typeof window === "undefined") return;
      const next = [id, ...loadSubmissionIds().filter((value) => value !== id)].slice(0, LOCAL_SUBMISSION_IDS_MAX);
      window.localStorage.setItem(submissionStorageKey, JSON.stringify(next));
    },
    [loadSubmissionIds, submissionStorageKey],
  );

  const loadSubmissionStatuses = useCallback(async () => {
    if (!hasAccessProof) return setSubmissionStatuses([]);
    const submissions = loadSubmissionStatusCapabilities(boardId, shareCode ?? accessCode).slice(0, LOCAL_SUBMISSION_IDS_MAX);
    if (submissions.length === 0) return setSubmissionStatuses([]);
    setStatusBusy(true);
    try {
      const response = await fetch(apiV1Path("student-apps/submissions/status"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ boardId, submissions, ...accessProof }),
      });
      const payload = (await response.json().catch(() => ({}))) as { submissions?: StudentSubmissionStatus[] };
      setSubmissionStatuses(Array.isArray(payload.submissions) ? payload.submissions : []);
    } finally {
      setStatusBusy(false);
    }
  }, [accessCode, accessProof, boardId, hasAccessProof, shareCode]);

  const updateSourceFile = (key: SourceFileKey, value: string) => {
    setSourceFiles((current) => ({ ...current, [key]: value }));
    setSelectedFiles([]);
    setSelectedManualFiles([]);
    setZipImportedFiles([]);
    setIntakeIgnoredFiles([]);
    setStatus(null); setSubmissionIssues([]);
    setCoachItems(null);
  };

  const toggleTheme = () => {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      if (typeof window !== "undefined") window.localStorage.setItem(THEME_STORAGE_KEY, next);
      return next;
    });
  };

  const updateSplitFromClientX = (clientX: number) => {
    const container = splitContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0) return;
    const next = clampSplitPercent(((clientX - rect.left) / rect.width) * 100);
    setSplitPercent(next);
    if (typeof window !== "undefined") window.localStorage.setItem(SPLIT_STORAGE_KEY, String(Math.round(next)));
  };

  const handleDividerPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    updateSplitFromClientX(event.clientX);
  };

  const handleDividerPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    updateSplitFromClientX(event.clientX);
  };

  const importManualFiles = (files: ManualFile[], message: string | null) => {
    setSelectedFiles([]);
    setSelectedManualFiles(files);
    setZipImportedFiles([]);
    setIntakeIgnoredFiles([]);
    setSourceFiles(EMPTY_SOURCE_FILES);
    setStatus(message); setSubmissionIssues([]);
    setCoachItems(null);
  };

  const importSelectedFiles = async (files: File[], message: string | null) => {
    const manualFiles = await filesToStudentAppManualFiles(files);
    setSelectedFiles(files);
    setSelectedManualFiles(manualFiles);
    setZipImportedFiles([]);
    setIntakeIgnoredFiles([]);
    setSourceFiles(EMPTY_SOURCE_FILES);
    setStatus(message); setSubmissionIssues([]);
    setCoachItems(null);
  };

  const importZipFile = async (zipFile: File) => {
    setStatus("ZIP 압축 사이트를 확인하는 중이에요...");
    const { importStudentStaticSiteZip } = await import("@/lib/student-apps/clientZipImport");
    const result = await importStudentStaticSiteZip(zipFile);
    if (!result.ok) {
      setSelectedFiles([]);
      setSelectedManualFiles([]);
      setZipImportedFiles([]);
      setIntakeIgnoredFiles([]);
      setStatus(result.message);
      setCoachItems(null);
      return;
    }
    setSelectedFiles([]);
    setSelectedManualFiles([]);
    setZipImportedFiles(result.files);
    setIntakeIgnoredFiles((result.ignoredFiles ?? []).map((path) => ({ path, reason: "ZIP 안의 압축 파일은 제출 대상에서 제외했어요.", solution: "" })));
    setSourceFiles(EMPTY_SOURCE_FILES);
    setStatus(result.message); setSubmissionIssues([]);
    setCoachItems(null);
  };

  const handleSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    const zipFiles = files.filter(isZipFile);
    const regularFiles = files.filter((file) => !isZipFile(file));
    if (zipFiles.length === 1 && regularFiles.length === 0) {
      await importZipFile(zipFiles[0]);
      return;
    }
    if (zipFiles.length > 0 && regularFiles.length === 0) {
      setSelectedFiles([]); setSelectedManualFiles([]); setZipImportedFiles([]); setIntakeIgnoredFiles([]);
      setStatus("작품 ZIP 하나만 선택해 주세요.");
      return;
    }
    if (zipFiles.length > 0) {
      await importSelectedFiles(regularFiles, `ZIP 파일 ${zipFiles.map((file) => file.name).join(", ")}은 제출 대상에서 제외하고 나머지 파일을 가져왔어요.`);
      setIntakeIgnoredFiles(zipFiles.map((file) => ({ path: file.name, reason: "압축 파일은 제출 대상에서 제외했어요.", solution: "" })));
      return;
    }
    await importSelectedFiles(files, null);
  };

  const handleZipSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const zipFile = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!zipFile) return;
    await importZipFile(zipFile);
  };

  const handleStaticImportDragEnter = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDragActive(true);
  };

  const handleStaticImportDragOver = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDragActive(true);
  };

  const handleStaticImportDragLeave = (event: DragEvent<HTMLElement>) => {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
    setIsDragActive(false);
  };

  const handleStaticImportDrop = async (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDragActive(false);

    try {
      const dropped = await dataTransferToDroppedFiles(event.dataTransfer);
      if (dropped.unsupportedDirectory) {
        setStatus(FOLDER_DROP_UNSUPPORTED_MESSAGE);
        return;
      }

      if (dropped.files.length === 0) {
        setStatus("가져올 파일을 찾지 못했어요. 파일이나 ZIP을 다시 놓아 주세요.");
        return;
      }

      const zipFiles = dropped.files.filter(({ file }) => isZipFile(file));
      const regularFiles = dropped.files.filter(({ file }) => !isZipFile(file));
      if (zipFiles.length === 1 && regularFiles.length === 0) {
        await importZipFile(zipFiles[0].file);
        return;
      }
      if (zipFiles.length > 0 && regularFiles.length === 0) {
        setSelectedFiles([]); setSelectedManualFiles([]); setZipImportedFiles([]); setIntakeIgnoredFiles([]);
        setStatus("작품 ZIP 하나만 선택해 주세요.");
        return;
      }

      const manualFiles: ManualFile[] = [];
      for (const { file, path } of regularFiles) {
        manualFiles.push(await fileToStudentAppManualFile(file, normalizeDroppedPath(path)));
      }
      const message = dropped.sawDirectory
        ? "폴더 안의 정적 파일을 가져왔어요. index.html 준비 상태를 확인해 주세요."
        : "정적 파일을 가져왔어요. index.html 준비 상태를 확인해 주세요.";
      importManualFiles(manualFiles, zipFiles.length > 0
        ? `ZIP 파일 ${zipFiles.map(({ file }) => file.name).join(", ")}은 제출 대상에서 제외하고 나머지 파일을 가져왔어요.`
        : message);
      if (zipFiles.length > 0) setIntakeIgnoredFiles(zipFiles.map(({ file }) => ({ path: file.name, reason: "압축 파일은 제출 대상에서 제외했어요.", solution: "" })));
    } catch {
      setStatus("파일을 읽지 못했어요. ZIP으로 압축하거나 파일을 다시 선택해 주세요.");
    }
  };

  const loadLessonTemplate = async () => {
    if (!lessonKit || !lessonKitSampleUrls || templateBusy) return;
    if (hasFiles && typeof window !== "undefined" && !window.confirm(LESSON_TEMPLATE_OVERWRITE_CONFIRM)) {
      return;
    }

    setTemplateBusy(true);
    setStatus("수업 템플릿을 불러오는 중이에요...");
    try {
      const fetchText = async (url: string) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`template_fetch_failed:${url}`);
        return response.text();
      };
      const [html, css, js] = await Promise.all([
        fetchText(lessonKitSampleUrls.indexHtmlUrl),
        fetchText(lessonKitSampleUrls.styleCssUrl),
        fetchText(lessonKitSampleUrls.scriptJsUrl),
      ]);

      setSelectedFiles([]);
      setSelectedManualFiles([]);
      setZipImportedFiles([]);
      setSourceFiles({ html, css, js });
      setActiveFile("html");
      setCoachItems(null);
      setStatus("수업 템플릿을 HTML/CSS/JS에 불러왔어요. 바꿔 보고 미리보기로 확인한 뒤 직접 제출해요.");
    } catch {
      setStatus(LESSON_TEMPLATE_LOAD_ERROR);
    } finally {
      setTemplateBusy(false);
    }
  };

  const runCodeCoach = () => {
    setCoachItems(
      runRuleBasedCodeCoach({
        lessonKitId: lessonKit?.lessonId ?? lessonKitId,
        html: sourceFiles.html,
        css: sourceFiles.css,
        js: sourceFiles.js,
      }),
    );
  };

  const downloadCurrentCode = async () => {
    if (
      !hasSourceContent(sourceFiles) &&
      typeof window !== "undefined" &&
      !window.confirm(STUDENT_APP_DOWNLOAD_EMPTY_CONFIRM)
    ) {
      return;
    }

    const { downloadStudentAppZip } = await import("@/lib/student-apps/downloadStudentAppZip");
    downloadStudentAppZip(sourceFiles);
  };

  const fetchLessonKitCodeFile = async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`lesson_resource_fetch_failed:${url}`);
    return response.text();
  };

  const showLessonKitCode = async (file: LessonKitDownloadFile & { codeView: "html" | "css" | "js" }) => {
    setCodeActionBusyPath(file.path);
    try {
      const content = await fetchLessonKitCodeFile(file.url);
      setCodeViewer({
        path: file.path,
        label: file.label,
        codeView: file.codeView,
        content,
      });
      setStatus(`${file.label} 코드를 열었어요.`);
    } catch {
      setStatus("코드를 불러오지 못했어요. 파일 다운로드를 다시 눌러 주세요.");
    } finally {
      setCodeActionBusyPath(null);
    }
  };

  const copyLessonKitCode = async (file: LessonKitDownloadFile & { codeView: "html" | "css" | "js" }) => {
    setCodeActionBusyPath(file.path);
    try {
      const content = await fetchLessonKitCodeFile(file.url);
      await navigator.clipboard.writeText(content);
      setStatus(`${file.label} 코드를 복사했어요. VS Code에 붙여넣을 수 있어요.`);
    } catch {
      setStatus("복사하지 못했어요. 코드 보기를 눌러 직접 선택해 주세요.");
    } finally {
      setCodeActionBusyPath(null);
    }
  };

  const submit = async () => {
    if (submitInFlightRef.current) return;
    if (!canSubmit) {
      setStatus(submitDisabledReason ?? "아직 제출할 수 없어요.");
      return;
    }
    setStatus("제출하는 중이에요...");
    setPublishedUrl(null);
    submitInFlightRef.current = true;
    setBusy(true);
    try {
      const files =
        zipImportedFiles.length > 0
          ? zipImportedFiles
          : selectedManualFiles.length > 0
            ? selectedManualFiles
          : selectedFiles.length > 0
            ? await filesToStudentAppManualFiles(selectedFiles)
            : editorManualFiles;
      const response = await fetch(apiV1Path("student-apps/submit"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          boardId,
          classId,
          submittedByName: submittedByName.trim() || null,
          studentNote: studentNote.trim() || null,
          authorClientId: getAuthorClientId(),
          source: "manual_files",
          files,
          ...accessProof,
        }),
      });
      const contentType = response.headers.get("content-type") ?? "";
      const payload = contentType.includes("application/json")
        ? await response.json().catch(() => ({})) as SubmitSuccessPayload | SubmitErrorPayload
        : {} as SubmitErrorPayload;
      if (response.status === 201) {
        const autoPublishStatus = payload.ok === true ? payload.autoPublish?.status : undefined;
        const publicUrl = payload.ok === true ? payload.autoPublish?.publicUrl : undefined;
        if (autoPublishStatus === "published" && typeof publicUrl === "string" && publicUrl.trim()) {
          setPublishedUrl(publicUrl);
          setStatus("제출과 공개가 완료되었습니다.");
        } else if (autoPublishStatus === "publish_failed") {
          setStatus("작품 제출은 완료되었습니다.\n공개 링크를 만드는 중 문제가 생겼습니다.\n선생님이 확인할 수 있습니다.");
        } else if (autoPublishStatus === "needs_teacher_review") {
          setStatus("작품 제출은 완료되었습니다.\n안전 확인이 필요한 항목이 있어 선생님이 확인할 수 있습니다.");
        } else if (autoPublishStatus === "session_closed") {
          setStatus("작품 제출은 완료되었습니다.\n제출이 끝나는 시점과 겹쳐 자동 공개되지 않았습니다. 선생님이 확인할 수 있습니다.");
        } else {
          setStatus("제출했어요. 선생님이 확인한 뒤 공개되면 친구 작품도 함께 살펴볼 수 있어요.");
        }
        const submissionId = payload.ok === true ? payload.submission?.id : undefined;
        if (typeof submissionId === "string" && submissionId.trim()) {
          const statusCapability = payload.ok === true ? payload.submission?.statusCapability : undefined;
          // Legacy/share-code submissions retain their existing ID-only behavior.
          // A trusted capability that cannot be persisted is deliberately not
          // added to polling; the successful upload is never retried here.
          const canPoll = typeof statusCapability !== "string"
            || saveSubmissionStatusCapability({ boardId, shareContext: shareCode ?? accessCode, submissionId, statusCapability });
          if (canPoll) {
            saveSubmissionId(submissionId);
            void loadSubmissionStatuses();
          }
        }
        return;
      }
      const errorCode = payload.ok === true ? undefined : payload.error?.code ?? payload.reason;
      if (response.status === 422 && errorCode === "validation_failed") {
        const issues = describeSubmissionErrors(payload.ok === true ? [] : payload.errors ?? []);
        setSubmissionIssues(issues);
        setStatus("제출할 수 없는 파일이 있어요. 아래 파일별 안내를 확인해 주세요.");
      } else if (response.status === 403 && errorCode === "session_closed") {
        setStatus("지금은 학생 앱 제출이 닫혀 있어요. 선생님께 제출을 열어 달라고 해 주세요.");
      } else if (response.status >= 500 && !contentType.includes("application/json")) {
        setStatus("작품 파일을 처리하는 중 서버 한도를 넘었어요. 파일 전체를 20MB 이하로 줄인 뒤 다시 제출해 주세요. 작성 내용은 이 브라우저에 그대로 남아 있어요.");
      } else if (response.status === 429) {
        setStatus("제출 요청이 많아요. 잠시 뒤 다시 시도해요.");
      } else {
        setStatus("제출하는 중 문제가 생겼어요.");
      }
    } catch {
      setStatus(SUBMISSION_NETWORK_ERROR_MESSAGE);
    } finally {
      submitInFlightRef.current = false;
      setBusy(false);
    }
  };

  const handleLessonNavigationClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!hasFiles || typeof window === "undefined") return;
    if (!window.confirm(LESSON_NAVIGATION_CONFIRM)) {
      event.preventDefault();
    }
  };

  const setSubmitModalOpen = useCallback((nextOpen: boolean) => {
    setSubmitModalState(submitModalStateKey, nextOpen);
    if (nextOpen && debugStudentModal) {
      console.info("[StudentAppSubmitPanel] modal open", {
        boardId,
        shareCode: shareCode ?? null,
        displayMode,
      });
    }
  }, [boardId, debugStudentModal, displayMode, shareCode, submitModalStateKey]);

  const closeSubmitModal = useCallback((reason: SubmitModalCloseReason, event?: SubmitModalCloseEvent) => {
    if (debugStudentModal) {
      console.info("[StudentAppSubmitPanel] closeSubmitModal", {
        reason,
        eventType: event?.type ?? null,
        target: describeSubmitModalEventTarget(event?.target ?? null),
        currentTarget: describeSubmitModalEventTarget(event?.currentTarget ?? null),
      });
    }
    if (submitInFlightRef.current || busy) {
      setStatus("제출하는 중에는 창을 닫지 않고 잠시 기다려 주세요.");
      return;
    }
    setSubmitModalOpen(false);
  }, [busy, debugStudentModal, setSubmitModalOpen]);

  const handleSubmitModalBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    event.preventDefault();
    event.stopPropagation();
    closeSubmitModal("backdrop", event);
  };

  const handleSubmitPanelTriggerClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (open) {
      closeSubmitModal("programmatic", event);
      return;
    }
    setSubmitModalOpen(true);
  };

  useEffect(() => {
    setMounted(true);
    if (debugStudentModal) {
      console.info("[StudentAppSubmitPanel] mount", {
        boardId,
        shareCode: shareCode ?? null,
        displayMode,
        restoredOpen: submitModalOpenByBoard.get(submitModalStateKey) === true,
      });
    }
    if (typeof window === "undefined") return;
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === "dark" || savedTheme === "light") setTheme(savedTheme);
    const savedSplit = Number(window.localStorage.getItem(SPLIT_STORAGE_KEY));
    if (Number.isFinite(savedSplit)) setSplitPercent(clampSplitPercent(savedSplit));
    return () => {
      if (debugStudentModal) {
        console.info("[StudentAppSubmitPanel] unmount", {
          boardId,
          shareCode: shareCode ?? null,
          displayMode,
          open: submitModalOpenByBoard.get(submitModalStateKey) === true,
        });
        if (displayMode === "modal-host") {
          console.info("[StudentAppSubmitPanel] stable modal host unmount", {
            boardId,
            shareCode: shareCode ?? null,
          });
        } else if (displayMode === "button" && submitModalOpenByBoard.get(submitModalStateKey) === true) {
          console.info("[StudentAppSubmitPanel] modal host preserved while trigger unmounted", {
            boardId,
            shareCode: shareCode ?? null,
            modalExists: typeof document !== "undefined" && Boolean(document.getElementById("student-app-submit-modal")),
          });
        }
      }
    };
  }, [boardId, debugStudentModal, displayMode, shareCode, submitModalStateKey]);

  useEffect(() => {
    const storedOpen = submitModalOpenByBoard.get(submitModalStateKey) === true;
    setOpen((currentOpen) => (currentOpen === storedOpen ? currentOpen : storedOpen));
  }, [submitModalStateKey]);

  useEffect(() => subscribeToSubmitModalState(submitModalStateKey, setOpen), [submitModalStateKey]);

  useEffect(() => {
    if (debugStudentModal && displayMode === "modal-host") {
      console.info("[StudentAppSubmitPanel] stable modal host mount", {
        boardId,
        shareCode: shareCode ?? null,
      });
    }
  }, [boardId, debugStudentModal, displayMode, shareCode]);

  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;
    setDraftReadyKey(null);
    try {
      const draft = parseDraftSourceFiles(window.localStorage.getItem(draftStorageKey));
      if (draft) {
        setSourceFiles(draft);
        setSelectedFiles([]);
        setSelectedManualFiles([]);
        setZipImportedFiles([]);
        setCoachItems(null);
      } else {
        setSourceFiles(EMPTY_SOURCE_FILES);
        setSelectedFiles([]);
        setSelectedManualFiles([]);
        setZipImportedFiles([]);
        setCoachItems(null);
      }
    } catch {
      // localStorage reads can fail in restricted browser modes.
    }
    setDraftReadyKey(draftStorageKey);
  }, [draftStorageKey, mounted]);

  useEffect(() => {
    if (!mounted || draftReadyKey !== draftStorageKey || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        draftStorageKey,
        JSON.stringify({
          version: DRAFT_STORAGE_VERSION,
          updatedAt: new Date().toISOString(),
          sourceFiles,
        }),
      );
    } catch {
      // localStorage can be unavailable in private mode or strict browser settings.
    }
  }, [draftReadyKey, draftStorageKey, mounted, sourceFiles]);

  useEffect(() => {
    if ((displayMode === "inline" || open) && mounted) void loadSubmissionStatuses();
  }, [displayMode, loadSubmissionStatuses, mounted, open]);

  useEffect(() => {
    if (!open || displayMode !== "button" || typeof window === "undefined") return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeSubmitModal("escape", event);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeSubmitModal, displayMode, open]);

  useModalScrollLock(open && mounted && displayMode === "modal-host");

  useEffect(() => {
    if (!playModeOpen || typeof window === "undefined") return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPlayModeOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [playModeOpen]);

  const workspaceStyle = {
    "--workspace-bg": theme === "dark" ? "#0b1020" : "#f7f9fc",
    "--workspace-panel": theme === "dark" ? "rgba(17, 24, 39, 0.94)" : "#ffffff",
    "--workspace-soft": theme === "dark" ? "rgba(31, 41, 55, 0.82)" : "#eef4f8",
    "--workspace-border": theme === "dark" ? "rgba(229, 231, 235, 0.14)" : "rgba(15, 23, 42, 0.16)",
    "--workspace-text": theme === "dark" ? "#f9fafb" : "#111827",
    "--workspace-muted": theme === "dark" ? "#cbd5e1" : "#475569",
    "--workspace-accent": theme === "dark" ? "#7dd3fc" : "#0369a1",
    "--workspace-button-text": theme === "dark" ? "#f0f9ff" : "#0f172a",
    "--workspace-editor-width": `${splitPercent}%`,
  } as CSSProperties;
  const isLightTheme = theme === "light";
  const templateButtonClassName = isLightTheme
    ? "min-h-11 rounded-lg border border-sky-500/45 bg-sky-50 px-4 text-sm font-semibold text-sky-800 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-55"
    : "min-h-11 rounded-lg border border-sky-300/45 bg-sky-300/15 px-4 text-sm font-semibold text-sky-100 hover:bg-sky-300/20 disabled:cursor-not-allowed disabled:opacity-55";
  const coachButtonClassName = isLightTheme
    ? "min-h-11 rounded-lg border border-emerald-500/45 bg-emerald-50 px-4 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
    : "min-h-11 rounded-lg border border-emerald-300/45 bg-emerald-300/15 px-4 text-sm font-semibold text-emerald-100 hover:bg-emerald-300/20";
  const shareHelpPanelClassName = isLightTheme
    ? "mt-3 flex flex-col gap-2 rounded-lg border border-cyan-500/30 bg-cyan-50 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between"
    : "mt-3 flex flex-col gap-2 rounded-lg border border-cyan-200/30 bg-cyan-300/10 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between";
  const shareHelpTextClassName = isLightTheme ? "text-xs leading-5 text-slate-700" : "text-xs leading-5 text-cyan-50";
  const sourceOnlyNoticeClassName = isLightTheme
    ? "mt-3 rounded-lg border border-sky-400/45 bg-sky-50 px-4 py-3 text-sm text-sky-800"
    : "mt-3 rounded-lg border border-sky-300/40 bg-sky-300/15 px-4 py-3 text-sm text-sky-100";
  const submittedBadgeClassName = isLightTheme
    ? "rounded-full border border-rose-300 bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700"
    : "rounded-full border border-rose-300/35 bg-rose-300/10 px-2 py-0.5 text-xs text-rose-100";

  const panelBody = (
    <div
      className={
        displayMode === "inline"
          ? "student-coding-workspace w-full rounded-lg border p-4 shadow-[0_18px_48px_rgba(15,23,42,0.28)] sm:p-5"
          : "student-coding-workspace max-h-[calc(100dvh_-_max(1.25rem,env(safe-area-inset-top)_+_env(safe-area-inset-bottom)))] w-full max-w-[1240px] overflow-y-auto overscroll-contain touch-pan-y rounded-lg border p-4 shadow-[0_24px_70px_rgba(15,23,42,0.58)] sm:p-5"
      }
      data-student-app-submit-panel="content"
      data-student-coding-modal-content="true"
      data-modal-scroll-container={displayMode !== "inline" ? "true" : undefined}
      data-theme={theme}
      style={workspaceStyle}
    >
      <style>{`
        .student-coding-workspace {
          background: var(--workspace-panel);
          border-color: var(--workspace-border);
          color: var(--workspace-text);
        }
        .student-coding-muted { color: var(--workspace-muted); }
        .student-coding-accent { color: var(--workspace-accent); }
        .student-coding-surface {
          background: var(--workspace-soft);
          border-color: var(--workspace-border);
        }
        .student-static-import-drop-active {
          border-color: var(--workspace-accent);
          background: ${theme === "dark" ? "rgba(14, 165, 233, 0.16)" : "#e0f2fe"};
          box-shadow: 0 0 0 3px ${theme === "dark" ? "rgba(125, 211, 252, 0.18)" : "rgba(14, 165, 233, 0.18)"};
        }
        .student-static-import-drop-ready {
          border-color: var(--workspace-accent);
          background: ${theme === "dark" ? "rgba(14, 165, 233, 0.22)" : "#bae6fd"};
          color: ${theme === "dark" ? "#e0f2fe" : "#075985"};
        }
        .student-coding-field {
          background: ${theme === "dark" ? "#050816" : "#ffffff"};
          border-color: var(--workspace-border);
          color: var(--workspace-text);
        }
        .student-coding-main {
          display: grid;
          grid-template-columns: minmax(0, var(--workspace-editor-width)) 16px minmax(320px, 1fr);
          min-height: 660px;
          gap: 0;
        }
        .student-coding-work-left {
          display: contents;
        }
        .student-coding-main[data-lesson-11-work-mode="true"] {
          grid-template-columns: minmax(0, 1fr) minmax(360px, 0.46fr);
          gap: 1rem;
        }
        .student-coding-main[data-lesson-11-work-mode="true"] .student-coding-work-left {
          display: grid;
          grid-template-columns: minmax(340px, var(--workspace-editor-width)) 16px minmax(300px, 1fr);
          min-height: 660px;
        }
        .student-coding-divider {
          cursor: col-resize;
          touch-action: none;
        }
        .lesson-11-work-panel {
          position: sticky;
          top: 1rem;
          align-self: start;
          max-height: calc(100vh - 2rem);
        }
        .lesson-11-work-iframe {
          min-height: min(640px, calc(100vh - 13rem));
        }
        @media (max-width: 1280px) {
          .student-coding-main[data-lesson-11-work-mode="true"] {
            grid-template-columns: minmax(0, 1fr);
            gap: 1rem;
          }
          .student-coding-main[data-lesson-11-work-mode="true"] .student-coding-work-left {
            grid-template-columns: minmax(0, 1fr);
            gap: 1rem;
            min-height: 0;
          }
          .student-coding-main[data-lesson-11-work-mode="true"] .student-coding-divider {
            display: none;
          }
          .lesson-11-work-panel {
            position: static;
            max-height: none;
          }
          .lesson-11-work-iframe {
            min-height: 520px;
          }
        }
        @media (max-width: 1023px) {
          .student-coding-main {
            display: flex;
            flex-direction: column;
            min-height: 0;
            gap: 1rem;
          }
          .student-coding-divider {
            display: none;
          }
        }
      `}</style>

      <div className="sticky top-0 z-20 -mx-4 -mt-4 mb-4 flex flex-col gap-3 bg-[var(--workspace-panel)] px-4 pb-3 pt-4 sm:-mx-5 sm:-mt-5 sm:px-5 sm:pt-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-2xl font-bold tracking-tight sm:text-[1.75rem]">
            {showLesson13Launcher ? "AI 포토카드 실습" : "학생 코딩 화면"}
          </h3>
          <p className="student-coding-muted mt-2 max-w-3xl text-sm leading-6">
            {showLesson13Launcher
              ? "먼저 체험 페이지를 열어 완성된 모습을 확인한 뒤, 스타터 소스를 다운로드해서 VS Code에서 직접 수정해 봅니다."
              : "HTML/CSS/JS를 수정하고 오른쪽 미리보기로 확인한 뒤 제출해요."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-semibold"
            style={{ borderColor: "var(--workspace-border)", color: "var(--workspace-button-text)" }}
          >
            {theme === "dark" ? "밝은 테마" : "어두운 테마"}
          </button>
          {displayMode !== "inline" ? (
            <button
              type="button"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border px-4 text-sm font-semibold"
              style={{ borderColor: "var(--workspace-border)", color: "var(--workspace-button-text)" }}
              onClick={(event) => closeSubmitModal("close-button", event)}
            >
              닫기
            </button>
          ) : null}
        </div>
      </div>

      {showLesson13Launcher ? (
        <section className="student-coding-surface mt-4 rounded-lg border p-4">
          <h4 className="text-sm font-semibold">오늘 할 일 3단계</h4>
          <ol className="mt-3 grid gap-2 sm:grid-cols-3">
            {["체험 페이지 확인", "스타터 소스 다운로드", "VS Code에서 수정"].map((step, index) => (
              <li key={step} className="rounded-lg border px-3 py-3" style={{ borderColor: "var(--workspace-border)" }}>
                <span className="student-coding-muted text-[11px] font-semibold">STEP {index + 1}</span>
                <p className="mt-1 text-sm font-semibold">{step}</p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {lessonNavigation && shareCode?.trim() ? (
        <section
          className="student-coding-surface mt-4 rounded-lg border p-4"
          data-student-coding-lesson-navigation="true"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="text-sm font-semibold">차시 이동</h4>
              {lessonNavigation.current ? (
                <p className="student-coding-muted mt-1 text-xs">
                  현재 차시: {lessonNavigation.current.lessonNumber} {lessonNavigation.current.title}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {lessonNavigation.previous ? (
                <a
                  href={buildStudentCodingLessonPath(shareCode.trim(), lessonNavigation.previous.lessonId)}
                  onClick={handleLessonNavigationClick}
                  className="inline-flex min-h-10 items-center justify-center rounded-lg border px-3 text-xs font-semibold"
                  style={{ borderColor: "var(--workspace-border)", color: "var(--workspace-button-text)" }}
                >
                  이전 차시: {lessonNavigation.previous.lessonNumber} {lessonNavigation.previous.title}
                </a>
              ) : null}
              {lessonNavigation.next ? (
                <a
                  href={buildStudentCodingLessonPath(shareCode.trim(), lessonNavigation.next.lessonId)}
                  onClick={handleLessonNavigationClick}
                  className="inline-flex min-h-10 items-center justify-center rounded-lg border px-3 text-xs font-semibold"
                  style={{ borderColor: "var(--workspace-border)", color: "var(--workspace-button-text)" }}
                >
                  다음 차시: {lessonNavigation.next.lessonNumber} {lessonNavigation.next.title}
                </a>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {!showLesson13Launcher && lessonKit && lessonKitSampleUrls ? (
        <section className="student-coding-surface mt-4 rounded-lg border p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="text-sm font-semibold">수업 템플릿</h4>
              <p className="student-coding-muted mt-1 text-xs leading-relaxed">
                {lessonKit.title} 템플릿을 HTML/CSS/JS 편집기에 불러와요. 기존 내용이 있으면 덮어쓰기 확인을 먼저 해요.
              </p>
              <p className="student-coding-muted mt-1 text-xs">템플릿을 불러와도 자동 제출되지 않아요.</p>
            </div>
            <div className="flex flex-col gap-2 sm:items-end">
              <button
                type="button"
                onClick={() => void loadLessonTemplate()}
                disabled={templateBusy}
                className={templateButtonClassName}
              >
                {templateBusy ? "불러오는 중..." : "수업 템플릿 불러오기"}
              </button>
              {lessonStudentPreviewAction ? (
                <div className="max-w-sm rounded-lg border px-3 py-2" style={{ borderColor: "var(--workspace-border)" }}>
                  <p className="student-coding-muted text-xs leading-relaxed">
                    {showLesson11PlayMode
                      ? "코드를 고치면서 오른쪽에서 기본 3D 미션룸을 함께 볼 수 있어요."
                      : lessonStudentPreviewAction.description}
                  </p>
                  {showLesson11PlayMode ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setWorkModeOpen(true)}
                        className="inline-flex min-h-10 items-center justify-center rounded-lg border border-sky-500/45 bg-sky-50 px-3 text-xs font-semibold text-sky-800 hover:bg-sky-100"
                      >
                        3D 작업 모드
                      </button>
                      <button
                        type="button"
                        onClick={() => setPlayModeOpen(true)}
                        className="inline-flex min-h-10 items-center justify-center rounded-lg border border-violet-500/45 bg-violet-50 px-3 text-xs font-semibold text-violet-800 hover:bg-violet-100"
                      >
                        3D 크게 보기
                      </button>
                    </div>
                  ) : (
                    <a
                      href={lessonStudentPreviewAction.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex min-h-10 items-center justify-center rounded-lg border border-violet-500/45 bg-violet-50 px-3 text-xs font-semibold text-violet-800 hover:bg-violet-100"
                    >
                      {lessonStudentPreviewAction.label}
                    </a>
                  )}
                  <p className="student-coding-muted mt-2 text-[11px] leading-relaxed">
                    {showLesson11PlayMode
                      ? "3D 작업 모드는 기본 예제 화면이에요. 내가 바꾼 코드는 코딩 화면 미리보기와 제출물에서 확인해요."
                      : lessonStudentPreviewAction.note}
                  </p>
                  {showLesson11PlayMode ? (
                    <a
                      href={lessonStudentPreviewAction.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="student-coding-muted mt-2 inline-flex text-[11px] font-semibold underline underline-offset-2"
                    >
                      새 창으로 열기
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {lessonKit && lessonKitDownloads ? (
        <section className="student-coding-surface mt-4 rounded-lg border p-4" aria-labelledby="lesson-kit-download-title">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h4 id="lesson-kit-download-title" className="text-sm font-semibold">
                수업자료 받기
              </h4>
              <p className="mt-1 text-sm font-semibold">{lessonKit.title}</p>
              <p className="student-coding-muted mt-1 text-xs leading-relaxed">
                {lessonKit.description}
              </p>
            </div>
            {lessonKitDownloads.zipUrl ? (
              <a
                href={lessonKitDownloads.zipUrl}
                download
                aria-label={`${lessonKit.title} 전체 ZIP 다운로드`}
                className="inline-flex min-h-12 items-center justify-center rounded-lg border border-sky-500/45 bg-sky-50 px-5 text-sm font-semibold text-sky-800 hover:bg-sky-100"
              >
                {lessonKitDownloads.zipLabel ?? "전체 ZIP 다운로드"}
              </a>
            ) : null}
          </div>

          <div className="mt-3 rounded-lg border px-3 py-3" style={{ borderColor: "var(--workspace-border)" }}>
            <button
              type="button"
              aria-expanded={resourceHelpOpen}
              aria-controls="lesson-kit-download-fallback"
              onClick={() => setResourceHelpOpen((value) => !value)}
              className="flex min-h-10 w-full items-center justify-between gap-3 text-left text-sm font-semibold"
            >
              <span>압축이 안 풀리나요?</span>
              <span aria-hidden="true">{resourceHelpOpen ? "접기" : "열기"}</span>
            </button>
            {resourceHelpOpen ? (
              <div id="lesson-kit-download-fallback" className="mt-3">
                <p className="student-coding-muted text-xs leading-relaxed">
                  압축이 안 풀리면 아래 파일을 하나씩 받아 표시된 경로대로 넣어주세요. HTML/CSS/JS는 같은 폴더에, notes 파일은 notes 폴더에 넣어요.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {lessonKitDownloads.files.map((file) => (
                    <a
                      key={file.path}
                      href={file.url}
                      download={file.path.split("/").pop() ?? file.label}
                      aria-label={`${file.label} 파일 다운로드`}
                      className="inline-flex min-h-10 items-center justify-center rounded-lg border px-3 text-xs font-semibold"
                      style={{ borderColor: "var(--workspace-border)", color: "var(--workspace-button-text)" }}
                    >
                      {file.label} 다운로드
                    </a>
                  ))}
                </div>

                {lessonKitCodeFiles.length > 0 ? (
                  <div className="mt-4 border-t pt-3" style={{ borderColor: "var(--workspace-border)" }}>
                    <p className="student-coding-muted text-xs leading-relaxed">
                      다운로드도 막히면 코드 보기 버튼을 눌러 VS Code에 직접 붙여넣을 수 있어요.
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {lessonKitCodeFiles.map((file) => {
                        const busyForFile = codeActionBusyPath === file.path;
                        return (
                          <div
                            key={file.path}
                            className="rounded-lg border px-3 py-3"
                            style={{ borderColor: "var(--workspace-border)" }}
                          >
                            <p className="text-xs font-semibold">{file.label}</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => void showLessonKitCode(file)}
                                disabled={busyForFile}
                                aria-label={`${file.label} 코드 보기`}
                                className="min-h-10 rounded-lg border px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-55"
                                style={{ borderColor: "var(--workspace-border)", color: "var(--workspace-button-text)" }}
                              >
                                코드 보기
                              </button>
                              <button
                                type="button"
                                onClick={() => void copyLessonKitCode(file)}
                                disabled={busyForFile}
                                aria-label={`${file.label} 코드 복사하기`}
                                className="min-h-10 rounded-lg border px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-55"
                                style={{ borderColor: "var(--workspace-border)", color: "var(--workspace-button-text)" }}
                              >
                                복사하기
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {codeViewer ? (
                  <div className="mt-4 rounded-lg border bg-slate-950 p-3 text-slate-50" style={{ borderColor: "var(--workspace-border)" }}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold">
                        {codeViewer.label} 코드
                      </p>
                      <button
                        type="button"
                        onClick={() => setCodeViewer(null)}
                        aria-label={`${codeViewer.label} 코드 보기 닫기`}
                        className="min-h-9 rounded-lg border border-white/20 px-3 text-xs font-semibold text-white hover:bg-white/10"
                      >
                        닫기
                      </button>
                    </div>
                    <pre className="mt-3 max-h-72 overflow-auto rounded-lg bg-black/35 p-3 text-xs leading-5">
                      <code>{codeViewer.content}</code>
                    </pre>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {hasUnknownLessonKitQuery ? (
        <div className="mt-4 rounded-lg border border-amber-300/45 bg-amber-200/15 px-4 py-3 text-sm text-amber-100">
          등록되지 않은 lessonKit이에요. 직접 입력하거나 ZIP을 가져와 제출할 수 있어요.
        </div>
      ) : null}

      {showLesson13Launcher ? (
        <section className="student-coding-surface mt-4 rounded-lg border p-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.55fr)]">
            <div className="rounded-lg border bg-white px-5 py-8 text-center text-slate-700" style={{ borderColor: "var(--workspace-border)" }}>
              <p className="text-sm font-semibold text-slate-900">체험으로 완성 예시를 확인하고, 스타터 소스로 직접 만들어 봅니다.</p>
              <p className="mt-2 text-sm leading-6">
                ZIP 파일을 압축 해제한 뒤, lesson-13-ai-photo-card-starter 폴더를 VS Code로 열어 주세요.
              </p>
            </div>
            <div className="flex flex-col justify-center rounded-lg border p-4" style={{ borderColor: "var(--workspace-border)" }}>
              <h4 className="text-sm font-semibold">AI 포토카드 실습</h4>
              <p className="student-coding-muted mt-2 text-xs leading-relaxed">
                먼저 체험 페이지를 열어 완성된 모습을 확인한 뒤, 스타터 소스를 다운로드해서 VS Code에서 직접 수정해 봅니다.
              </p>
              <a
                href={LESSON_13_AWARD_VR_LAB_HREF}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex min-h-12 items-center justify-center rounded-lg border border-rose-300/50 bg-rose-500 px-5 text-sm font-semibold text-white hover:bg-rose-600"
              >
                AI 포토 카드 체험 열기
              </a>
              <a
                href={lessonKitDownloads?.zipUrl ?? "#"}
                download
                className="mt-3 inline-flex min-h-12 items-center justify-center rounded-lg border border-sky-500/45 bg-sky-50 px-5 text-sm font-semibold text-sky-800 hover:bg-sky-100"
              >
                전체 ZIP 다운로드
              </a>
            </div>
          </div>
        </section>
      ) : (
        <>
      <div
        ref={splitContainerRef}
        className="student-coding-main mt-5"
        data-lesson-11-work-mode={showLesson11PlayMode && workModeOpen ? "true" : undefined}
      >
        <div className="student-coding-work-left">
          <section className="student-coding-surface flex min-h-[620px] flex-col rounded-lg border p-4 lg:rounded-r-none">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold">HTML/CSS/JS 코드 편집</h4>
              <p className="student-coding-muted mt-1 text-xs">탭을 골라 한 파일씩 크게 편집해요.</p>
              <p className="student-coding-muted mt-1 text-xs">
                Wi-Fi가 불안정해도 작성 중인 코드는 이 브라우저에 임시 저장됩니다.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="min-h-10 rounded-lg border px-3 text-xs font-semibold"
                style={{ borderColor: "var(--workspace-border)", color: "var(--workspace-button-text)" }}
                onClick={() => setPreviewRevision((value) => value + 1)}
              >
                미리보기 새로고침
              </button>
              <button
                type="button"
                className="min-h-10 rounded-lg border px-3 text-xs font-semibold"
                style={{ borderColor: "var(--workspace-border)", color: "var(--workspace-button-text)" }}
                onClick={() => {
                  setSourceFiles(EMPTY_SOURCE_FILES);
                  setSelectedFiles([]);
                  setSelectedManualFiles([]);
                  setZipImportedFiles([]);
                  setStatus(null);
                  setCoachItems(null);
                }}
              >
                코드 비우기
              </button>
              {lessonKit && lessonKitSampleUrls ? (
                <button
                  type="button"
                  className="min-h-10 rounded-lg border px-3 text-xs font-semibold"
                  style={{ borderColor: "var(--workspace-border)", color: "var(--workspace-button-text)" }}
                  onClick={() => void loadLessonTemplate()}
                  disabled={templateBusy}
                >
                  템플릿 다시 불러오기
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2" role="tablist" aria-label="코드 파일">
            {(Object.keys(SOURCE_FILE_META) as SourceFileKey[]).map((key) => {
              const meta = SOURCE_FILE_META[key];
              const selected = activeFile === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setActiveFile(key)}
                  className="rounded-lg border px-3 py-2 text-left transition"
                  style={{
                    borderColor: selected ? "var(--workspace-accent)" : "var(--workspace-border)",
                    background: selected ? "rgba(14, 165, 233, 0.16)" : "transparent",
                    color: "var(--workspace-text)",
                  }}
                >
                  <span className="block text-sm font-bold">{meta.label}</span>
                  <span className="student-coding-muted block text-[11px]">{meta.helper}</span>
                </button>
              );
            })}
          </div>

          <label className="student-coding-muted mt-4 flex min-h-0 flex-1 flex-col text-xs font-semibold">
            <span className="flex items-center justify-between gap-3">
              <span>{activeMeta.fileName}</span>
              <span className="font-normal">{activeMeta.helper}</span>
            </span>
            <textarea
              value={sourceFiles[activeFile]}
              onChange={(event) => updateSourceFile(activeFile, event.target.value)}
              spellCheck={false}
              className="student-coding-field mt-2 min-h-[440px] flex-1 resize-y rounded-lg border px-3 py-3 font-mono text-sm leading-5 outline-none focus:border-sky-300/70"
              placeholder={activeMeta.placeholder}
            />
          </label>
          </section>

          <div
            role="separator"
            aria-label="코드와 미리보기 너비 조절"
            aria-orientation="vertical"
            className="student-coding-divider flex items-center justify-center"
            onPointerDown={handleDividerPointerDown}
            onPointerMove={handleDividerPointerMove}
          >
            <span className="h-16 w-1 rounded-full bg-sky-300/70" />
          </div>

          <section className="student-coding-surface flex min-h-[620px] flex-col rounded-lg border p-4 lg:rounded-l-none">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold">미리보기</h4>
            <span className="student-coding-muted text-xs">격리된 화면에서 실행해요.</span>
          </div>
          <div className="mt-3 min-h-[520px] flex-1 overflow-hidden rounded-lg border border-slate-300/30 bg-white">
            {previewDocument && hasPreviewFiles ? (
              <iframe
                key={previewRevision}
                title="학생 앱 미리보기"
                className="h-full w-full"
                sandbox="allow-scripts"
                srcDoc={previewDocument.html}
              />
            ) : (
              <div className="flex h-full min-h-[520px] items-center justify-center px-5 text-center text-sm text-slate-500">
                수업 템플릿을 불러오거나 코드를 입력하면 여기에 결과가 보여요.
              </div>
            )}
          </div>
          </section>
        </div>

        {showLesson11PlayMode && workModeOpen ? (
          <aside className="student-coding-surface lesson-11-work-panel flex min-h-[620px] flex-col rounded-lg border p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h4 className="text-sm font-semibold">3D 작업 화면</h4>
                <p className="student-coding-muted mt-1 text-xs leading-relaxed">
                  기본 예제 화면입니다. 내 수정 내용은 왼쪽 미리보기/제출물에서 확인해요.
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setWorkModeRevision((value) => value + 1)}
                  className="min-h-9 rounded-lg border px-3 text-xs font-semibold"
                  style={{ borderColor: "var(--workspace-border)", color: "var(--workspace-button-text)" }}
                >
                  새로고침
                </button>
                <button
                  type="button"
                  onClick={() => setWorkModeOpen(false)}
                  className="min-h-9 rounded-lg border px-3 text-xs font-semibold"
                  style={{ borderColor: "var(--workspace-border)", color: "var(--workspace-button-text)" }}
                >
                  3D 작업 모드 닫기
                </button>
              </div>
            </div>
            <p className="student-coding-muted mt-3 rounded-lg border px-3 py-2 text-[11px] leading-relaxed" style={{ borderColor: "var(--workspace-border)" }}>
              3D 작업 모드는 기본 예제 화면이에요. 내 수정 내용은 이 3D 작업 화면에 바로 반영되지 않아요.
              내가 바꾼 코드는 코딩 화면 미리보기와 제출물에서 확인해요.
            </p>
            <div className="mt-3 flex-1 overflow-hidden rounded-lg border border-slate-300/30 bg-slate-950">
              <iframe
                key={workModeRevision}
                title="3D 작업 화면"
                className="lesson-11-work-iframe h-full w-full border-0"
                src={LESSON_11_3D_DOCK_MODE_SRC}
              />
            </div>
          </aside>
        ) : null}
      </div>

      <section className="student-coding-surface mt-4 rounded-lg border p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h4 className="text-sm font-semibold">코드 점검 도우미</h4>
            <p className="student-coding-muted mt-1 text-xs leading-relaxed">
              지금 작성한 코드를 빠르게 살펴봐요. 제출을 막는 검사는 아니에요. 완성 전에 확인하는 도움말입니다.
            </p>
          </div>
          <button
            type="button"
            onClick={runCodeCoach}
            className={coachButtonClassName}
          >
            살펴보기
          </button>
        </div>

        {coachItems ? (
          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
            {coachItemsByLevel.map((group) => (
              <div key={group.level} className="rounded-lg border p-3" style={{ borderColor: "var(--workspace-border)" }}>
                <p className="text-sm font-semibold">{group.label}</p>
                {group.items.length > 0 ? (
                  <ul className="mt-2 space-y-2">
                    {group.items.map((coachItem, index) => (
                      <li key={`${group.level}-${index}`} className="student-coding-muted text-xs leading-relaxed">
                        <span className="block font-semibold" style={{ color: "var(--workspace-text)" }}>
                          {coachItem.title}
                        </span>
                        <span className="block">{coachItem.message}</span>
                        {coachItem.hint ? <span className="block opacity-90">{coachItem.hint}</span> : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="student-coding-muted mt-2 text-xs">이번 점검에서는 항목이 없어요.</p>
                )}
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="student-coding-surface mt-4 rounded-lg border p-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.9fr)]">
          <div>
            <h4 className="text-sm font-semibold">제출하기</h4>
            <p className="student-coding-muted mt-1 text-xs">
              완성 후 제출하면 선생님이 확인할 수 있어요. 제출은 자동으로 되지 않아요.
            </p>
            <p className="student-coding-muted mt-1 text-xs">제출 → 선생님 확인 → 친구 작품 보기</p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="student-coding-muted block text-sm">
                별명
                <input
                  value={submittedByName}
                  onChange={(event) => setSubmittedByName(event.target.value)}
                  maxLength={40}
                  placeholder="별명"
                  className="student-coding-field mt-1.5 min-h-12 w-full rounded-lg border px-3.5 text-base placeholder:text-slate-400"
                />
              </label>
              <label className="student-coding-muted block text-sm">
                선생님께 남기는 말
                <textarea
                  value={studentNote}
                  onChange={(event) => setStudentNote(event.target.value)}
                  maxLength={500}
                  placeholder="선택 입력"
                  className="student-coding-field mt-1.5 min-h-24 w-full rounded-lg border px-3.5 py-3 text-base placeholder:text-slate-400"
                />
              </label>
            </div>
            <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-end">
              {displayMode === "button" ? (
                <button
                  type="button"
                  className="min-h-12 rounded-lg border px-5 text-sm font-semibold"
                  style={{ borderColor: "var(--workspace-border)", color: "var(--workspace-button-text)" }}
                  onClick={(event) => closeSubmitModal("close-button", event)}
                >
                  닫기
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void downloadCurrentCode()}
                className="min-h-12 rounded-lg border px-6 text-sm font-semibold"
                style={{ borderColor: "var(--workspace-border)", color: "var(--workspace-button-text)" }}
              >
                다운로드하기
              </button>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={!canSubmit}
                className="min-h-12 rounded-lg border border-rose-300/50 bg-rose-500 px-6 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
              >
                {busy ? "제출하는 중..." : "제출하기"}
              </button>
            </div>
            <p className="student-coding-muted mt-2 text-right text-xs">
              현재 HTML/CSS/JS를 내 컴퓨터에 저장할 수 있어요.
            </p>
            {!canSubmit && submitDisabledReason ? (
              <p className="student-coding-muted mt-2 text-right text-xs">{submitDisabledReason}</p>
            ) : null}
            <div className={shareHelpPanelClassName}>
              <p className={shareHelpTextClassName}>
                제출한 뒤에는 친구 작품도 함께 살펴볼 수 있어요.
              </p>
              <StudentAppGalleryPanel
                boardId={boardId}
                shareCode={shareCode}
                accessCode={accessCode}
                studentSessionToken={studentSessionToken}
                guestToken={guestToken}
              />
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold">파일 요약</h4>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="rounded-lg border p-3" style={{ borderColor: "var(--workspace-border)" }}>
                <p className="student-coding-muted text-xs">현재 파일 수 / 최대 파일 수</p>
                <p className="mt-1 text-lg font-bold">{currentSummary.fileCount} / {MAX_FILES}</p>
              </div>
              <div className="rounded-lg border p-3" style={{ borderColor: "var(--workspace-border)" }}>
                <p className="student-coding-muted text-xs">현재 용량 / 최대 용량</p>
                <p className="mt-1 text-lg font-bold">{formatBytes(currentSummary.totalBytes)} / {formatBytes(MAX_TOTAL_SIZE)}</p>
              </div>
              <div className="rounded-lg border p-3" style={{ borderColor: "var(--workspace-border)" }}>
                <p className="student-coding-muted text-xs">index.html</p>
                <p className="mt-1 text-lg font-bold">{currentSummary.hasIndexHtml ? "준비됨" : "없음"}</p>
              </div>
            </div>
          </div>
        </div>

        {status ? (
          <div className="mt-3 rounded-lg border border-white/20 bg-white/10 px-3.5 py-3 text-sm">
            <p className="whitespace-pre-line">{status}</p>
            {publishedUrl ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <a href={publishedUrl} target="_blank" rel="noreferrer noopener" className="inline-flex min-h-10 items-center rounded-lg border px-3 font-semibold">내 작품 열기</a>
                <button
                  type="button"
                  className="min-h-10 rounded-lg border px-3 font-semibold"
                  onClick={() => void navigator.clipboard.writeText(publishedUrl).then(
                    () => setStatus("제출과 공개가 완료되었습니다.\n공개 주소를 복사했습니다."),
                    () => setStatus("제출과 공개가 완료되었습니다.\n공개 주소를 복사하지 못했습니다."),
                  )}
                >
                  공개 주소 복사
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
        {(submissionIssues.length > 0 || clientFileIssues.length > 0) ? (
          <div className="mt-3 rounded-lg border border-amber-300/50 bg-amber-50/10 px-3.5 py-3 text-sm">
            <p className="font-semibold">확인할 파일과 학생이 할 수 있는 해결 방법</p>
            <ul className="mt-2 space-y-2">
              {(submissionIssues.length > 0 ? submissionIssues : clientFileIssues).slice(0, 5).map((issue) => <li key={`${issue.path}-${issue.reason}`}><span className="font-semibold">{issue.path}</span> — {issue.reason}<span className="block text-xs">{issue.solution}</span></li>)}
            </ul>
            {(submissionIssues.length > 0 ? submissionIssues : clientFileIssues).length > 5 ? <p className="mt-2 text-xs">외 {((submissionIssues.length > 0 ? submissionIssues : clientFileIssues).length - 5)}개 파일이 더 있어요.</p> : null}
          </div>
        ) : null}
      </section>

      <section
        className={`student-coding-surface mt-4 rounded-lg border p-4 transition ${
          isDragActive ? "student-static-import-drop-active" : ""
        }`}
        data-student-static-import-dropzone="true"
        onDragEnter={handleStaticImportDragEnter}
        onDragOver={handleStaticImportDragOver}
        onDragLeave={handleStaticImportDragLeave}
        onDrop={(event) => void handleStaticImportDrop(event)}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h4 className="text-sm font-semibold">정적 파일 가져오기</h4>
            <p className="student-coding-muted mt-1 text-xs leading-relaxed">
              {STATIC_IMPORT_GUIDANCE}
            </p>
          </div>
          <p
            className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
              isDragActive ? "student-static-import-drop-ready" : "student-coding-muted"
            }`}
            style={{ borderColor: "var(--workspace-border)" }}
          >
            {isDragActive ? STATIC_DROP_READY_MESSAGE : "파일/폴더/ZIP 드롭 가능"}
          </p>
        </div>
        <p className="student-coding-muted mt-1 text-xs">
          React/Vite/Next.js 빌드는 실행하지 않아요. 정적 HTML/CSS/JS/assets 중심으로 가져와요.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border p-4" style={{ borderColor: "var(--workspace-border)" }}>
            <p className="text-sm font-semibold">ZIP 정적 사이트 가져오기 — ZIP 파일 하나 선택 — 권장</p>
            <p className="student-coding-muted mt-1 text-xs">ZIP은 제출 전에 풀어서 정적 파일만 검증해요.</p>
            <button
              type="button"
              className={`mt-3 ${templateButtonClassName}`}
              onClick={() => zipInputRef.current?.click()}
            >
              ZIP 선택
            </button>
            <input
              ref={zipInputRef}
              type="file"
              accept=".zip,application/zip"
              onChange={(event) => void handleZipSelection(event)}
              className="sr-only"
            />
          </div>
          <div className="rounded-lg border p-4" style={{ borderColor: "var(--workspace-border)" }}>
            <p className="text-sm font-semibold">폴더 또는 파일 직접 선택 — 보조 방법</p>
            <button
              type="button"
              className="mt-3 min-h-11 rounded-lg border px-4 text-sm font-semibold"
              style={{ borderColor: "var(--workspace-border)", color: "var(--workspace-button-text)" }}
              onClick={() => fileInputRef.current?.click()}
            >
              파일 선택
            </button>
            <input ref={fileInputRef} type="file" multiple onChange={(event) => void handleSelection(event)} className="sr-only" />
          </div>
        </div>
      </section>

      {hasFiles || ignoredFiles.length > 0 ? (
        <section className="student-coding-surface mt-4 rounded-lg border p-4 text-sm">
          <p className="font-semibold">파일 검사 결과</p>
          <p className="mt-2">제출할 파일 {currentSummary.fileCount}개</p>
          <p>제외한 파일 {ignoredFiles.length}개</p>
          <p>제출을 막는 파일 {clientFileIssues.length}개</p>
          {ignoredFiles.length > 0 ? (
            <ul className="student-coding-muted mt-2 space-y-1 text-xs">
              {ignoredFiles.slice(0, 5).map((file) => <li key={`${file.path}-${file.reason}`}><span className="font-semibold">{file.path}</span> — {file.reason}</li>)}
              {ignoredFiles.length > 5 ? <li>외 {ignoredFiles.length - 5}개 파일</li> : null}
            </ul>
          ) : null}
        </section>
      ) : null}

      {currentSummary.hasZip ? (
        <div className="mt-4 rounded-lg border border-amber-300/45 bg-amber-200/15 px-4 py-3 text-sm text-amber-100">
          ZIP 파일 자체가 아니라 압축 안의 정적 파일을 제출해요.
        </div>
      ) : null}
      {looksLikeSourceOnly ? (
        <div className={sourceOnlyNoticeClassName}>
          프로젝트 소스 폴더처럼 보여요. 브라우저에서 바로 열 수 있는 HTML/CSS/JS 파일만 지원해요.
        </div>
      ) : null}

      <section className="student-coding-surface mt-4 rounded-lg border p-4">
        <h4 className="text-sm font-semibold">최근 제출 상태</h4>
        {statusBusy ? <p className="student-coding-muted mt-2 text-xs">불러오는 중...</p> : null}
        {!statusBusy && submissionStatuses.length === 0 ? (
          <p className="student-coding-muted mt-2 text-sm">아직 이 브라우저의 제출 기록이 없어요.</p>
        ) : null}
        {!statusBusy && submissionStatuses.length > 0 ? (
          <ul className="mt-3 space-y-2.5">
            {submissionStatuses.map((item) => (
              <li key={item.id} className="rounded-lg border p-3" style={{ borderColor: "var(--workspace-border)" }}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold">{item.title || "제목 없음"}</p>
                  <span className={submittedBadgeClassName}>
                    {statusLabel(item.status)}
                  </span>
                </div>
                <p className="student-coding-muted mt-1.5 text-xs">{statusHelpText(item.status)}</p>
                {item.teacherNote ? <p className="student-coding-muted mt-1.5 whitespace-pre-line text-xs">{item.teacherNote}</p> : null}
                {item.reviewedAt ? (
                  <p className="student-coding-muted mt-1 text-[11px]">
                    확인: {new Date(item.reviewedAt).toLocaleString("ko-KR")}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
        </>
      )}
    </div>
  );

  const lesson11PlayModeModal =
    playModeOpen && mounted
      ? createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="lesson-11-play-mode-title"
            className="fixed inset-0 z-[10020] flex items-center justify-center bg-slate-950/82 p-2.5 backdrop-blur-sm sm:p-5"
          >
            <div className="flex h-[min(92vh,920px)] w-[min(1440px,96vw)] flex-col overflow-hidden rounded-lg border border-white/20 bg-slate-950 shadow-[0_28px_90px_rgba(0,0,0,0.68)]">
              <div className="flex items-start justify-between gap-3 border-b border-white/15 px-4 py-3 sm:items-center sm:px-5">
                <div>
                  <h2 id="lesson-11-play-mode-title" className="text-base font-semibold text-white">
                    3D 크게 보기
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed text-slate-300">
                    3D 크게 보기는 기본 예제 화면이에요. 내 수정 내용은 코딩 화면 미리보기와 제출물에서 확인해요.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPlayModeOpen(false)}
                  className="min-h-10 shrink-0 rounded-lg border border-white/20 px-3 text-xs font-semibold text-white hover:bg-white/10"
                >
                  닫기
                </button>
              </div>
              <iframe
                title="3D 크게 보기"
                className="min-h-[70vh] flex-1 border-0 bg-slate-950"
                src={LESSON_11_3D_PLAY_MODE_SRC}
              />
            </div>
          </div>,
          document.body,
        )
      : null;

  // This component is mounted by StudentBoardMinimal outside the collapsible top bar.
  // Keep the portal here so a sync may remove the button trigger without removing open content.
  const modal =
    displayMode === "modal-host" && open && mounted
      ? createPortal(
          <div
            id="student-app-submit-modal"
            data-modal-scroll-root="true"
            data-allow-wheel-overlay="student-app-submit-modal"
            role="dialog"
            aria-modal="true"
            className={`fixed inset-0 ${STUDENT_APP_SUBMIT_MODAL_Z_CLASS} isolate pointer-events-auto touch-none px-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] pt-[max(0.625rem,env(safe-area-inset-top))] sm:p-5`}
          >
            <div
              className="pointer-events-none absolute inset-0 bg-slate-950/72 backdrop-blur-md"
              data-student-submit-modal-backdrop="true"
            />
            <div
              className="relative z-10 flex min-h-full items-center justify-center touch-pan-y"
              data-student-app-submit-panel="content"
              data-student-coding-modal-content="true"
              onClick={handleSubmitModalBackdropClick}
            >
              {panelBody}
            </div>
          </div>,
          document.body,
        )
      : null;

  if (displayMode === "inline") {
    return (
      <>
        {panelBody}
        {lesson11PlayModeModal}
      </>
    );
  }

  if (displayMode === "modal-host") {
    return (
      <>
        {modal}
        {lesson11PlayModeModal}
      </>
    );
  }

  return (
    <div className="inline-flex items-center">
      <button
        type="button"
        className="min-h-11 rounded-full border border-rose-200/50 bg-rose-400/35 px-3.5 text-xs font-semibold text-rose-50"
        aria-expanded={open}
        aria-controls="student-app-submit-modal"
        data-student-app-submit-panel="trigger"
        onClick={handleSubmitPanelTriggerClick}
      >
        제출하기
      </button>
      {lesson11PlayModeModal}
    </div>
  );
}
