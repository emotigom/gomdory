"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type InputHTMLAttributes } from "react";
import { createPortal } from "react-dom";

import { filesToStudentAppManualFiles } from "@/lib/student-apps/clientFilePayload";
import { apiV1Path } from "@/lib/standards/pathTypes";

import { inspectorSamples } from "./studentAppInspectorSamples";
import { buildLocalPreviewDocument, type ManualFile } from "./studentAppLocalPreview";
import { buildSelectedFileSummary, buildSelectedManualFileSummary, mapErrorToProblemFix } from "./studentAppSourceInspectorHelpers";

type ValidationResponse = {
  ok: boolean;
  result?: {
    normalized?: { ok: boolean; warnings: string[]; errors?: string[]; files: Array<{ path: string; contentType?: string; sizeBytes: number }> };
    validation?: { ok: boolean; errors: string[]; manifest: { title: string; entryFile: "index.html"; totalSizeBytes: number; files: Array<{ path: string; sizeBytes: number; contentType: string; sha256: string }>; safety: { warnings: string[] } } };
  };
  error?: { code?: string; message?: string };
};
type StoreSuccessResponse = { ok: true; deployment: { id: string; status: string; fileCount: number; totalSizeBytes: number; createdAt?: string | null; storedAt?: string | null } };
type StoreErrorResponse = { ok: false; error?: { code?: string; message?: string } };
type ListDeployment = { id: string; title: string; status: string; version: number; fileCount: number; totalSizeBytes: number; storedAt?: string | null; publicUrl?: string | null; publishedAt?: string | null; isLatest?: boolean | null };
type ListResponse = { ok: true; deployments: ListDeployment[] };
type SubmissionStatus = "submitted" | "needs_fix" | "accepted" | "archived";
type SubmissionListItem = { id: string; title: string; status: SubmissionStatus; submittedByName?: string | null; studentNote?: string | null; teacherNote?: string | null; reviewedAt?: string | null; archivedAt?: string | null; fileCount: number; totalSizeBytes: number; warningsCount: number; requiresTeacherReview?: boolean; createdAt: string; version?: number | null; isLatest?: boolean | null };
type SubmissionListResponse = { ok: true; submissions: SubmissionListItem[] };
type SubmissionDetailResponse = { ok: true; files: ManualFile[] };
type SubmissionReviewTab = "pending" | "needs_fix" | "accepted" | "all";
type RecentParticipant = { id: string; displayName: string; submittedAt: string };
type RecentParticipantsResponse = { ok: true; participants: RecentParticipant[]; lookbackMinutes: number; classSessionId?: string | null; generatedAt: string };
type ClassSession = { id: string; status: "active" | "ended" | string; startsAt: string; endsAt: string; expiresAt?: string | null; isOpen?: boolean; remainingSeconds: number; publishMode?: "teacher_review" | "auto_publish" };
type DirectoryInputProps = InputHTMLAttributes<HTMLInputElement> & { webkitdirectory?: string };

const MAX_FILES = 100;
const MAX_TOTAL_SIZE = 10 * 1024 * 1024;

const formatBytes = (size?: number | null) => (!size || size <= 0 ? "0 B" : size < 1024 ? `${size} B` : size < 1024 * 1024 ? `${(size / 1024).toFixed(1)} KB` : `${(size / (1024 * 1024)).toFixed(2)} MB`);
const getTotalNormalizedSize = (files?: Array<{ sizeBytes: number }> | null): number => files?.reduce((sum, file) => sum + file.sizeBytes, 0) ?? 0;
const getDeploymentStatusLabel = (status: string): string => status === "stored" ? "저장됨" : status === "published" ? "공개 중" : status;
const getSubmissionStatusLabel = (status: SubmissionStatus): string =>
  status === "submitted" ? "검토 대기" : status === "needs_fix" ? "수정 요청" : status === "accepted" ? "승인됨" : "보관됨";
const submissionReviewTabs: Array<{ key: SubmissionReviewTab; label: string }> = [
  { key: "pending", label: "검토 대기" },
  { key: "needs_fix", label: "수정 요청" },
  { key: "accepted", label: "승인됨" },
  { key: "all", label: "전체" },
];
const formatSubmissionTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
};
const sortSubmissionsByRecent = (items: SubmissionListItem[]) => [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
const formatAutoCloseLabel = (remainingSeconds?: number | null) => {
  if (!remainingSeconds || remainingSeconds <= 0) return "곧 닫힘";
  const hours = Math.ceil(remainingSeconds / 3600);
  return `약 ${hours}시간 후`;
};

export default function StudentAppSourceInspector({
  boardId,
  wallId = null,
  cardId = null,
  classId = null,
  boardAccessCode = null,
}: {
  boardId: string;
  wallId?: string | null;
  cardId?: string | null;
  classId?: string | null;
  boardAccessCode?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const zipInputRef = useRef<HTMLInputElement | null>(null);
  const previewSectionRef = useRef<HTMLElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ValidationResponse | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<ManualFile[]>([]);
  const [summary, setSummary] = useState<ReturnType<typeof buildSelectedFileSummary> | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewWarnings, setPreviewWarnings] = useState<string[]>([]);
  const [previewMessage, setPreviewMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [storeBusy, setStoreBusy] = useState(false);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [previewConfirmed, setPreviewConfirmed] = useState(false);
  const [savedFingerprint, setSavedFingerprint] = useState<string | null>(null);
  const [listBusy, setListBusy] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [savedDeployments, setSavedDeployments] = useState<ListDeployment[]>([]);
  const [publishBusyId, setPublishBusyId] = useState<string | null>(null);
  const [publishConfirmId, setPublishConfirmId] = useState<string | null>(null);
  const [publishNotice, setPublishNotice] = useState<string | null>(null);
  const [submissionBusy, setSubmissionBusy] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionListItem[]>([]);
  const [submissionReviewTab, setSubmissionReviewTab] = useState<SubmissionReviewTab>("pending");
  const [expandedPreviousSubmissionIds, setExpandedPreviousSubmissionIds] = useState<Set<string>>(() => new Set());
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewNote, setReviewNote] = useState("");
  const [classSession, setClassSession] = useState<ClassSession | null>(null);
  const [classSessionBusy, setClassSessionBusy] = useState(false);
  const [classSessionError, setClassSessionError] = useState<string | null>(null);
  const [recentParticipants, setRecentParticipants] = useState<RecentParticipant[]>([]);
  const [participantBusy, setParticipantBusy] = useState(false);
  const [participantError, setParticipantError] = useState<string | null>(null);
  const [pickedParticipant, setPickedParticipant] = useState<RecentParticipant | null>(null);
  const [pickNonce, setPickNonce] = useState(0);

  useEffect(() => setMounted(true), []);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(null), 3000); return () => clearTimeout(timer); }, [notice]);

  const validationOk = result?.result?.validation?.ok === true;
  const errors = result?.result?.validation?.errors ?? result?.result?.normalized?.errors ?? [];
  const selectionFingerprint = useMemo(() => (result?.result?.validation?.manifest?.files ?? []).map((file) => `${file.path}:${file.sizeBytes}`).sort().join("|"), [result]);
  const alreadySavedForSelection = Boolean(savedFingerprint && selectionFingerprint && savedFingerprint === selectionFingerprint);
  const canStore = validationOk && selectedFiles.length > 0 && previewConfirmed && !storeBusy && !alreadySavedForSelection;
  const totalFiles = result?.result?.validation?.manifest?.files?.length ?? result?.result?.normalized?.files?.length ?? 0;
  const totalSize = result?.result?.validation?.manifest?.totalSizeBytes ?? getTotalNormalizedSize(result?.result?.normalized?.files);
  const resultFileList = useMemo(() => (result?.result?.normalized?.files ?? result?.result?.validation?.manifest?.files ?? []).slice(0, 20), [result]);
  const selectedSubmission = useMemo(() => submissions.find((item) => item.id === selectedSubmissionId) ?? null, [submissions, selectedSubmissionId]);
  const selectedSubmissionCanPublish = selectedSubmission?.isLatest === true;
  const submissionsOpen = classSession?.isOpen === true && classSession.remainingSeconds > 0;
  const submissionSummary = useMemo(() => ({
    total: submissions.length,
    pending: submissions.filter((item) => item.status === "submitted" && item.isLatest === true).length,
    needsFix: submissions.filter((item) => item.status === "needs_fix" && item.isLatest === true).length,
    accepted: submissions.filter((item) => item.status === "accepted").length,
  }), [submissions]);
  const previousSubmissions = useMemo(() => sortSubmissionsByRecent(submissions.filter((item) => item.isLatest !== true)), [submissions]);
  const visibleSubmissions = useMemo(() => {
    const latestSubmissions = submissions.filter((item) => item.isLatest === true);
    const filtered =
      submissionReviewTab === "pending" ? latestSubmissions.filter((item) => item.status === "submitted") :
      submissionReviewTab === "needs_fix" ? latestSubmissions.filter((item) => item.status === "needs_fix") :
      submissionReviewTab === "accepted" ? submissions.filter((item) => item.status === "accepted") :
      submissions;
    return sortSubmissionsByRecent(filtered);
  }, [submissionReviewTab, submissions]);
  const hiddenPreviousCount = submissionReviewTab === "all" ? 0 : previousSubmissions.length;
  const galleryHref = boardAccessCode?.trim() ? `/s/${encodeURIComponent(boardAccessCode.trim())}?view=student-app` : null;
  const participantNames = useMemo(() => recentParticipants.map((participant) => participant.displayName), [recentParticipants]);

  const fetchSavedDeployments = useCallback(async () => {
    if (!boardId) return;
    setListBusy(true);
    setListError(null);
    try {
      const response = await fetch(`${apiV1Path("dashboard/student-apps/list")}?boardId=${encodeURIComponent(boardId)}`, { cache: "no-store" });
      const payload = (await response.json()) as ListResponse | StoreErrorResponse;
      if (response.ok && payload.ok) setSavedDeployments(payload.deployments);
      else setListError("저장 목록을 불러오지 못했습니다.");
    } catch {
      setListError("저장 목록을 불러오지 못했습니다.");
    } finally {
      setListBusy(false);
    }
  }, [boardId]);

  const fetchSubmissions = useCallback(async () => {
    if (!boardId) return;
    setSubmissionBusy(true);
    setSubmissionError(null);
    try {
      const response = await fetch(`${apiV1Path("dashboard/student-apps/submissions/list")}?boardId=${encodeURIComponent(boardId)}&limit=50`, { cache: "no-store" });
      const payload = (await response.json()) as SubmissionListResponse | StoreErrorResponse;
      if (response.ok && payload.ok) setSubmissions(payload.submissions);
      else setSubmissionError("학생 제출 목록을 불러오지 못했습니다.");
    } catch {
      setSubmissionError("학생 제출 목록을 불러오지 못했습니다.");
    } finally {
      setSubmissionBusy(false);
    }
  }, [boardId]);

  const fetchRecentParticipants = useCallback(async () => {
    if (!boardId) return;
    setParticipantBusy(true);
    setParticipantError(null);
    try {
      const response = await fetch(`${apiV1Path("dashboard/student-apps/submissions/recent-participants")}?boardId=${encodeURIComponent(boardId)}`, { cache: "no-store" });
      const payload = (await response.json()) as RecentParticipantsResponse | StoreErrorResponse;
      if (response.ok && payload.ok) {
        setRecentParticipants(payload.participants);
        setPickedParticipant(null);
        return;
      }
      setParticipantError("최근 제출자를 불러오지 못했어요.");
    } catch {
      setParticipantError("최근 제출자를 불러오지 못했어요.");
    } finally {
      setParticipantBusy(false);
    }
  }, [boardId]);

  const fetchClassSession = useCallback(async () => {
    if (!boardId) return;
    setClassSessionError(null);
    try {
      const response = await fetch(`${apiV1Path("dashboard/student-apps/session")}?boardId=${encodeURIComponent(boardId)}`, { cache: "no-store" });
      const payload = (await response.json()) as { ok?: boolean; session?: ClassSession | null };
      if (response.ok && payload?.ok) setClassSession(payload.session ?? null);
      else setClassSessionError("제출 가능 상태를 불러오지 못했습니다.");
    } catch {
      setClassSessionError("제출 가능 상태를 불러오지 못했습니다.");
    }
  }, [boardId]);

  useEffect(() => {
    if (!open || !boardId) return;
    void fetchSavedDeployments();
    void fetchSubmissions();
    void fetchClassSession();
  }, [boardId, fetchClassSession, fetchSavedDeployments, fetchSubmissions, open]);

  useEffect(() => {
    if (!boardId) return;
    void fetchClassSession();
  }, [boardId, fetchClassSession]);

  useEffect(() => {
    setReviewNote(selectedSubmission?.teacherNote ?? "");
  }, [selectedSubmission?.id, selectedSubmission?.teacherNote]);

  const runInspectionFromManualFiles = async (files: ManualFile[], options?: { sampleLabel?: string }): Promise<ValidationResponse | null> => {
    setResult(null);
    setSelectedFiles([]);
    setPreviewHtml(null);
    setPreviewWarnings([]);
    setPreviewMessage(null);
    setStoreError(null);
    setPreviewConfirmed(false);
    setSavedFingerprint(null);

    const nextSummary = buildSelectedManualFileSummary(files);
    setSummary(nextSummary);
    if (nextSummary.hasZip || files.length > MAX_FILES || nextSummary.totalBytes > MAX_TOTAL_SIZE) {
      setNotice("ZIP 파일 자체, 파일 100개 초과, 10MB 초과 앱은 저장할 수 없습니다. ZIP은 보조 가져오기에서 브라우저로 풀어 HTML/CSS/JS 정적 파일로 검증해요.");
      return null;
    }

    setBusy(true);
    try {
      setSelectedFiles(files);
      const response = await fetch(apiV1Path("dashboard/student-apps/validate"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source: "manual_files", files }),
      });
      const json = (await response.json()) as ValidationResponse;
      setResult(json);
      if (options?.sampleLabel) setNotice(`${options.sampleLabel}을 불러와 검증했습니다.`);
      return json;
    } catch {
      setNotice("검증 요청에 실패했습니다.");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const handleSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    setSummary(buildSelectedFileSummary(files));
    const payloadFiles = await filesToStudentAppManualFiles(files);
    await runInspectionFromManualFiles(payloadFiles);
    event.target.value = "";
  };

  const handleZipSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const zipFile = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!zipFile) return;
    setNotice("ZIP 정적 사이트를 확인하는 중...");
    const { importStudentStaticSiteZip } = await import("@/lib/student-apps/clientZipImport");
    const result = await importStudentStaticSiteZip(zipFile);
    if (!result.ok) {
      setResult(null);
      setSelectedFiles([]);
      setSummary(null);
      setPreviewHtml(null);
      setPreviewWarnings([]);
      setPreviewMessage(null);
      setNotice(result.message);
      return;
    }
    setSummary(buildSelectedManualFileSummary(result.files));
    setNotice(result.message);
    await runInspectionFromManualFiles(result.files);
  };

  const openLocalPreview = () => {
    const built = buildLocalPreviewDocument(selectedFiles);
    if (!built) {
      setPreviewWarnings(["preview_build_failed"]);
      setPreviewMessage("미리보기를 만들 수 없습니다. index.html과 연결된 CSS/JS 경로를 확인하세요.");
      return;
    }
    setPreviewHtml(built.html);
    setPreviewWarnings(built.warnings);
    setPreviewConfirmed(true);
    setPreviewMessage("로컬 미리보기를 열었습니다. 미리보기는 안전한 격리 화면에서 실행돼요.");
    previewSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const storeValidatedApp = async () => {
    if (!canStore) return;
    setStoreBusy(true);
    setStoreError(null);
    try {
      const response = await fetch(apiV1Path("dashboard/student-apps/store"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ boardId, wallId, cardId, classId, title: result?.result?.validation?.manifest?.title ?? "학생 앱", source: "manual_files", files: selectedFiles }),
      });
      const payload = (await response.json()) as StoreSuccessResponse | StoreErrorResponse;
      if (response.status === 201 && payload.ok) {
        setSavedFingerprint(selectionFingerprint || null);
        setPublishNotice("저장했습니다. 공개하려면 아래 저장 목록에서 별도로 공개를 눌러야 합니다.");
        await fetchSavedDeployments();
        return;
      }
      const code = payload.ok ? undefined : payload.error?.code;
      if (response.status === 200 && code === "validation_failed") setStoreError("검증에 실패했습니다. HTML/CSS/JS 정적 파일인지 다시 확인하세요.");
      else if (response.status === 413) setStoreError("파일이 너무 큽니다. 10MB 이하로 줄이세요.");
      else if (response.status === 503) setStoreError("저장소나 Supabase 스키마를 사용할 수 없습니다.");
      else setStoreError("저장 중 오류가 발생했습니다.");
    } catch {
      setStoreError("저장 중 오류가 발생했습니다.");
    } finally {
      setStoreBusy(false);
    }
  };

  const publishAction = async (deploymentId: string, action: "publish" | "unpublish") => {
    setPublishBusyId(deploymentId);
    setPublishNotice(null);
    try {
      const response = await fetch(apiV1Path("dashboard/student-apps/publish"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ boardId, deploymentId, action }),
      });
      if (!response.ok) {
        setPublishNotice("공개 상태를 바꾸지 못했습니다.");
        return;
      }
      setPublishConfirmId(null);
      setPublishNotice(action === "publish" ? "갤러리에 공개했습니다. 공유 링크는 저장 목록에서 확인하세요." : "공개를 중지했습니다. 기존 공유 링크는 404로 응답합니다.");
      await fetchSavedDeployments();
    } catch {
      setPublishNotice("공개 상태를 바꾸지 못했습니다.");
    } finally {
      setPublishBusyId(null);
    }
  };

  const mutateClassSession = async (action: "start" | "end" | "startAutoPublish") => {
    setClassSessionBusy(true);
    setClassSessionError(null);
    try {
      const response = await fetch(apiV1Path("dashboard/student-apps/session"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ boardId, action }),
      });
      const payload = (await response.json()) as { ok?: boolean; session?: ClassSession | null };
      if (response.ok && payload?.ok) setClassSession(action === "end" ? null : payload.session ?? null);
      else setClassSessionError("제출 가능 상태를 바꾸지 못했습니다.");
    } catch {
      setClassSessionError("제출 가능 상태를 바꾸지 못했습니다.");
    } finally {
      setClassSessionBusy(false);
    }
  };

  const renderSubmissionWindowBanner = () => (
    <div className={`rounded border p-3 ${submissionsOpen ? "border-emerald-300/50 bg-emerald-300/10" : "border-amber-300/45 bg-amber-300/10"}`}>
      <p className="font-semibold">학생 앱 제출: {submissionsOpen ? "열림" : "닫힘"}</p>
      {submissionsOpen && classSession?.publishMode === "auto_publish" ? (
        <div className="mt-2 rounded border border-emerald-300/50 bg-emerald-300/10 p-2">
          <p className="font-semibold">제출 즉시 공개 중</p>
          <p className="mt-1 text-sm">종료: 7월 19일 일요일 23:59</p>
        </div>
      ) : null}
      <p className="mt-1 text-sm text-[var(--theme-text-muted)]">
        {submissionsOpen && classSession?.publishMode === "auto_publish"
          ? "검사를 통과한 작품은 제출 직후 공개됩니다."
          : submissionsOpen ? "학생들이 HTML/CSS/JS 앱을 제출할 수 있어요." : "학생들이 앱을 제출하려면 제출을 열어 주세요."}
      </p>
      {submissionsOpen && classSession?.publishMode !== "auto_publish" ? (
        <p className="mt-1 text-sm text-[var(--theme-text-muted)]">자동 닫힘: {formatAutoCloseLabel(classSession?.remainingSeconds)}</p>
      ) : null}
      <div className="mt-2 rounded border border-[var(--theme-border)] p-2 text-sm text-[var(--theme-text-muted)]">
        <p>검사를 통과한 작품은 제출 직후 공개됩니다.</p>
        <p>제출은 7월 19일 일요일 밤까지 열립니다.</p>
        <p>공개된 작품은 언제든 숨길 수 있습니다.</p>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className="min-h-11 rounded border px-3" disabled={classSessionBusy} onClick={() => void mutateClassSession("start")}>6시간 열기</button>
        <button type="button" className="min-h-11 rounded border px-3" disabled={classSessionBusy} onClick={() => void mutateClassSession("startAutoPublish")}>이번 주 앱 제출 열기 · 즉시 공개</button>
        <button type="button" className="min-h-11 rounded border px-3" disabled={classSessionBusy || !submissionsOpen} onClick={() => void mutateClassSession("end")}>제출 종료</button>
      </div>
      {classSessionError ? <p className="mt-2 text-sm text-rose-300">{classSessionError}</p> : null}
    </div>
  );

  const previewSubmission = async (submissionId: string) => {
    try {
      const response = await fetch(`${apiV1Path("dashboard/student-apps/submissions/detail")}?boardId=${encodeURIComponent(boardId)}&submissionId=${encodeURIComponent(submissionId)}`, { cache: "no-store" });
      const payload = (await response.json()) as SubmissionDetailResponse | StoreErrorResponse;
      if (!response.ok || !payload.ok) {
        setSubmissionError("제출물을 불러오지 못했습니다.");
        return;
      }
      setSelectedSubmissionId(submissionId);
      const inspectionResult = await runInspectionFromManualFiles(payload.files);
      const built = buildLocalPreviewDocument(payload.files);
      if (!built) {
        setPreviewMessage("검증은 완료했지만 미리보기를 만들 수 없습니다.");
        return;
      }
      setPreviewHtml(built.html);
      setPreviewWarnings(built.warnings);
      setPreviewConfirmed(inspectionResult?.result?.validation?.ok === true);
      setPreviewMessage("학생 제출물을 검증하고 미리보기로 열었습니다.");
      previewSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch {
      setSubmissionError("제출물을 불러오지 못했습니다.");
    }
  };

  const reviewSubmission = async (action: "needs_fix" | "accepted" | "archived" | "reopen") => {
    if (!selectedSubmission) return;
    if (action === "accepted" && !selectedSubmissionCanPublish) {
      setSubmissionError("최신 제출물만 승인할 수 있어요. 최신 제출물을 선택해 주세요.");
      return;
    }
    setReviewBusy(true);
    setSubmissionError(null);
    try {
      const response = await fetch(apiV1Path("dashboard/student-apps/submissions/review"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ boardId, submissionId: selectedSubmission.id, action, teacherNote: reviewNote || null }),
      });
      const payload = (await response.json()) as StoreErrorResponse | { ok: true };
      if (!response.ok || !payload.ok) {
        setSubmissionError("상태를 변경하지 못했습니다.");
        return;
      }
      await fetchSubmissions();
    } catch {
      setSubmissionError("상태를 변경하지 못했습니다.");
    } finally {
      setReviewBusy(false);
    }
  };

  const togglePreviousSubmissions = (groupId: string) => {
    setExpandedPreviousSubmissionIds((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const pickRandomParticipant = () => {
    if (recentParticipants.length === 0) return;
    const next = recentParticipants[Math.floor(Math.random() * recentParticipants.length)];
    setPickedParticipant(next);
    setPickNonce((value) => value + 1);
  };

  const shuffleRecentParticipants = () => {
    setRecentParticipants((items) => {
      const next = [...items];
      for (let index = next.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
      }
      return next;
    });
    setPickedParticipant(null);
  };

  const submissionReviewSection = (
    <section className="rounded border p-3 lg:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold">학생 제출물 검토</p>
          <p className="mt-1 text-sm text-[var(--theme-text-muted)]">
            학생이 제출한 HTML/CSS/JS 작품을 확인하고 검토 상태를 정해요.
          </p>
        </div>
        <button type="button" className="min-h-11 rounded border px-3" onClick={() => void fetchSubmissions()}>
          제출물 새로고침
        </button>
      </div>
      <div className="mt-2 rounded border border-[var(--theme-border)] bg-[var(--theme-surface-muted)] p-2 text-sm">
        <p>승인됨은 교사가 검토를 마친 상태입니다.</p>
        <p className="mt-1">친구 작품 공개 여부는 저장된 앱의 별도 공개 상태로 표시됩니다.</p>
      </div>
      <p className="mt-2 text-sm text-[var(--theme-text-muted)]">
        {classSession?.publishMode === "auto_publish"
          ? "즉시 공개 세션에서는 안전 검사를 통과한 작품만 자동 공개되고, 높은 위험 경고가 있는 작품은 교사 확인이 필요합니다."
          : "제출물을 승인해도 친구 작품 보기에 자동으로 공개되지 않습니다. 공개된 deployment만 친구 작품 보기에서 sandbox 미리보기로 보입니다."}
      </p>
      <div className="mt-2">{renderSubmissionWindowBanner()}</div>
      {submissionBusy ? <p className="mt-2">불러오는 중...</p> : null}
      {submissionError ? <p className="mt-2">{submissionError}</p> : null}
      {!submissionBusy && !submissionError && submissions.length === 0 ? <p className="mt-2">아직 제출된 작품이 없어요.</p> : null}
      <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="제출물 검토 필터">
        {submissionReviewTabs.map((tab) => {
          const count = tab.key === "pending" ? submissionSummary.pending : tab.key === "needs_fix" ? submissionSummary.needsFix : tab.key === "accepted" ? submissionSummary.accepted : submissionSummary.total;
          const active = submissionReviewTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              className={`min-h-10 rounded border px-3 text-sm ${active ? "bg-[var(--theme-surface-muted)] font-semibold" : ""}`}
              onClick={() => setSubmissionReviewTab(tab.key)}
            >
              {tab.label} {count}
            </button>
          );
        })}
      </div>
      {!submissionBusy && !submissionError && submissions.length > 0 && visibleSubmissions.length === 0 ? <p className="mt-2">이 필터에 표시할 제출물이 없어요.</p> : null}
      {visibleSubmissions.map((item) => <div key={item.id} className="mt-2 rounded border p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-semibold">{item.title} {item.version ? `v${item.version}` : ""}</p>
            <p className="mt-1 text-xs text-[var(--theme-text-muted)]">{formatSubmissionTime(item.createdAt)} · 파일 {item.fileCount}개 · {formatBytes(item.totalSizeBytes)}</p>
          </div>
          <span className="rounded border border-[var(--theme-border)] px-2 py-1 text-xs">{item.status === "submitted" && item.requiresTeacherReview ? "교사 확인 필요" : getSubmissionStatusLabel(item.status)}</span>
        </div>
        {item.studentNote ? <p className="mt-2 line-clamp-2 text-sm text-[var(--theme-text-muted)]">{item.studentNote}</p> : null}
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" className="min-h-10 rounded border px-3" onClick={() => void previewSubmission(item.id)}>보기</button>
          <button type="button" className="min-h-10 rounded border px-3" onClick={() => setSelectedSubmissionId(item.id)}>선택</button>
        </div>
      </div>)}
      {hiddenPreviousCount > 0 ? <div className="mt-2 rounded border border-dashed p-2">
        <button type="button" className="min-h-10 rounded border px-3 text-sm" onClick={() => togglePreviousSubmissions("all-previous")}>
          {expandedPreviousSubmissionIds.has("all-previous") ? "이전 제출 접기" : `이전 제출 ${hiddenPreviousCount}개 보기`}
        </button>
        {expandedPreviousSubmissionIds.has("all-previous") ? (
          <div className="mt-2 space-y-2">
            {previousSubmissions.map((item) => (
              <div key={item.id} className="rounded border p-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p>{item.title} {item.version ? `v${item.version}` : ""}</p>
                  <span className="rounded border border-[var(--theme-border)] px-2 py-1 text-xs">{item.status === "submitted" && item.requiresTeacherReview ? "교사 확인 필요" : getSubmissionStatusLabel(item.status)}</span>
                </div>
                <p className="mt-1 text-xs text-[var(--theme-text-muted)]">{formatSubmissionTime(item.createdAt)} · 파일 {item.fileCount}개</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className="min-h-10 rounded border px-3" onClick={() => void previewSubmission(item.id)}>보기</button>
                  <button type="button" className="min-h-10 rounded border px-3" onClick={() => setSelectedSubmissionId(item.id)}>선택</button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div> : null}
      {selectedSubmission ? <div className="mt-3 rounded border p-2">
        <p className="font-semibold">선택한 제출물: {selectedSubmission.title}</p>
        <textarea className="mt-2 min-h-24 w-full rounded border p-2" maxLength={500} placeholder="학생에게 남길 짧은 피드백" value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} />
        <p className="mt-2 text-xs text-[var(--theme-text-muted)]">승인됨은 검토가 완료된 상태입니다. 친구 작품 공개는 저장된 앱에서 별도로 설정합니다.</p>
        {!selectedSubmissionCanPublish ? (
          <p className="mt-1 text-xs text-[var(--theme-text-muted)]">최신 제출물만 승인할 수 있어요. 최신 제출물을 선택해 주세요.</p>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" className="min-h-11 rounded border px-3" disabled={reviewBusy} onClick={() => void reviewSubmission("needs_fix")}>수정 필요</button>
          <button type="button" className="min-h-11 rounded border px-3 disabled:opacity-60" disabled={reviewBusy || !selectedSubmissionCanPublish} onClick={() => void reviewSubmission("accepted")}>승인</button>
          <button type="button" className="min-h-11 rounded border px-3" disabled={reviewBusy} onClick={() => void reviewSubmission("archived")}>보관</button>
          {selectedSubmission.status === "archived" || selectedSubmission.status === "needs_fix" ? <button type="button" className="min-h-11 rounded border px-3" disabled={reviewBusy} onClick={() => void reviewSubmission("reopen")}>다시 열기</button> : null}
        </div>
      </div> : null}
    </section>
  );

  const modal = open && mounted ? createPortal(
    <div className="fixed inset-0 z-[120] bg-black/60 p-3 sm:p-4">
      <div className="mx-auto flex h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-xl bg-[var(--theme-bg)] p-4">
        <div className="flex items-start justify-between gap-3 border-b pb-3">
          <div>
            <h2 className="text-lg font-semibold">학생 제출 앱 검토</h2>
            <div className="mt-2 rounded border border-[var(--theme-border)] bg-[var(--theme-surface-muted)] p-3 text-sm text-[var(--theme-text-muted)]">
              <p className="font-semibold text-[var(--theme-text)]">현재는 HTML/CSS/JS 정적 웹앱만 검토합니다.</p>
              <p className="mt-1">index.html, style.css, script.js처럼 브라우저에서 바로 실행되는 파일을 미리보고 공유할 수 있어요.</p>
              <p className="mt-1">React/Vite/Next.js 자동 빌드는 아직 지원하지 않습니다. 서버 실행/API/Next.js SSR도 지원하지 않아요.</p>
            </div>
          </div>
          <button type="button" className="min-h-11 rounded border px-3" onClick={() => setOpen(false)}>닫기</button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 rounded border p-2 text-sm sm:grid-cols-5">
          {["1. 파일 선택", "2. 검증", "3. 미리보기", "4. 저장", "5. 공개"].map((step) => <p key={step}>{step}</p>)}
        </div>

        <div className="mt-3 flex-1 overflow-y-auto pr-1">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {submissionReviewSection}

            <section className="rounded border p-3">
              <p className="font-semibold">1. 파일 선택</p>
              <p className="mt-1 text-sm text-[var(--theme-text-muted)]">index.html, style.css, script.js, 이미지 같은 HTML/CSS/JS 정적 웹앱 파일만 선택하세요. package.json 자동 설치나 빌드는 하지 않습니다.</p>
              <label className="mt-2 block">폴더 선택<input ref={folderInputRef} type="file" multiple {...({ webkitdirectory: "" } satisfies DirectoryInputProps)} onChange={handleSelection} className="mt-1 block w-full" /></label>
              <label className="mt-2 block">파일 여러 개 선택<input type="file" multiple onChange={handleSelection} className="mt-1 block w-full" /></label>
              <div className="mt-3 rounded border border-[var(--theme-border)] bg-[var(--theme-surface-muted)] p-2">
                <p className="text-sm font-semibold">ZIP 정적 사이트 가져오기</p>
                <p className="mt-1 text-xs text-[var(--theme-text-muted)]">ZIP 안에는 index.html / style.css / script.js 같은 브라우저용 파일을 넣어주세요. my-app/index.html처럼 단일 폴더 안에 들어 있어도 괜찮습니다.</p>
                <p className="mt-1 text-xs text-[var(--theme-text-muted)]">샘플 구조: index.html, style.css, script.js, images/logo.png, assets/data.json. React/Vite/Next.js 프로젝트는 자동 빌드하지 않습니다.</p>
                <button type="button" className="mt-2 min-h-11 rounded border px-3" onClick={() => zipInputRef.current?.click()}>ZIP 선택</button>
                <input ref={zipInputRef} type="file" accept=".zip,application/zip" onChange={(event) => void handleZipSelection(event)} className="sr-only" />
              </div>
              <button type="button" className="mt-3 min-h-11 rounded border px-3" onClick={() => void runInspectionFromManualFiles(inspectorSamples[0].files, { sampleLabel: inspectorSamples[0].label })}>정상 샘플 검증</button>
              {summary ? <div className="mt-3 space-y-1 text-sm"><p>선택 파일: {summary.fileCount}</p><p>전체 크기: {formatBytes(summary.totalBytes)}</p>{summary.hasZip ? <p>ZIP 파일 자체는 저장하지 않습니다. ZIP 정적 사이트 가져오기를 사용해 브라우저에서 먼저 풀어 주세요.</p> : null}{summary.hasProjectSourceSignals ? <p>프로젝트 소스로 보입니다. 지금은 React/Vite/Next.js 전체 프로젝트가 아니라 HTML/CSS/JS 정적 파일만 지원합니다.</p> : null}</div> : null}
            </section>

            <section className="rounded border p-3">
              <p className="font-semibold">2. 검증</p>
              <p className="mt-1">{busy ? "검증 중..." : result ? (validationOk ? "검증 통과" : "검증 실패") : "아직 검증하지 않았습니다."}</p>
              {result ? <><p>파일 수: {totalFiles}</p><p>전체 크기: {formatBytes(totalSize)}</p>{errors.map((errorCode) => { const mapped = mapErrorToProblemFix(errorCode); return <div key={errorCode} className="mt-2 rounded border p-2"><p><strong>문제</strong>: {mapped.problem}</p><p><strong>해결</strong>: {mapped.fix}</p></div>; })}</> : null}
              {notice ? <p className="mt-2">{notice}</p> : null}
            </section>

            <section ref={previewSectionRef} className="rounded border p-3 lg:col-span-2">
              <p className="font-semibold">3. 미리보기</p>
              <p className="mt-1 text-sm text-[var(--theme-text-muted)]">미리보기는 안전한 격리 화면에서 실행돼요. 내부적으로 iframe sandbox=&quot;allow-scripts&quot;를 사용하고 부모 페이지 접근을 막습니다.</p>
              <button type="button" className="mt-2 min-h-11 rounded border px-3 disabled:opacity-60" disabled={!validationOk} onClick={openLocalPreview}>로컬 미리보기 열기</button>
              {previewMessage ? <p className="mt-2 font-medium">{previewMessage}</p> : null}
              {previewHtml ? <iframe title="학생 정적 앱 로컬 미리보기" className="mt-2 h-[320px] w-full rounded border md:h-[420px]" sandbox="allow-scripts" srcDoc={previewHtml} /> : null}
              {previewWarnings.length ? <p className="mt-2">일부 연결 파일을 미리보기에 넣지 못했습니다.</p> : null}
            </section>

            {validationOk ? <section className="rounded border p-3 lg:col-span-2">
              <p className="font-semibold">4. 저장</p>
              <p className="mt-1">저장은 R2와 Supabase에 정적 파일 manifest를 기록하는 단계입니다. 저장만으로 학생에게 공개되지 않습니다.</p>
              <label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={previewConfirmed} onChange={(event) => setPreviewConfirmed(event.target.checked)} />미리보기를 확인했습니다.</label>
              <button type="button" className="mt-2 min-h-11 rounded border px-3 disabled:opacity-60" disabled={!canStore} onClick={() => void storeValidatedApp()}>R2/Supabase에 저장</button>
              {alreadySavedForSelection ? <p className="mt-2">이 파일 묶음은 이미 저장했습니다.</p> : null}
              {storeError ? <p className="mt-2">{storeError}</p> : null}
            </section> : null}

            <section className="rounded border p-3 lg:col-span-2">
              <div className="flex items-center justify-between gap-2"><p className="font-semibold">5. 저장된 앱 / 공개 관리</p><button type="button" className="min-h-11 rounded border px-3" onClick={() => void fetchSavedDeployments()}>새로고침</button></div>
              <p className="mt-1 text-sm text-[var(--theme-text-muted)]">갤러리에 공개는 저장된 HTML/CSS/JS 정적 웹앱만 가능합니다. 학생 제출물은 교사 승인 후 따로 저장/공개하기 전까지 공유 링크를 만들지 않습니다.</p>
              {listBusy ? <p className="mt-2">불러오는 중...</p> : null}
              {listError ? <p className="mt-2">{listError}</p> : null}
              {!listBusy && !listError && savedDeployments.length === 0 ? <p className="mt-2">아직 저장된 앱이 없습니다.</p> : null}
              {savedDeployments.map((item) => <div key={item.id} className="mt-2 rounded border p-2">
                <p>{item.title} {item.version ? `v${item.version}` : ""}</p>
                <p>상태: {getDeploymentStatusLabel(item.status)}</p>
                <p>파일: {item.fileCount}개, {formatBytes(item.totalSizeBytes)}</p>
                {item.status === "published" && item.publicUrl ? <><p className="break-all">{item.publicUrl}</p><a href={item.publicUrl} target="_blank" rel="noreferrer noopener" className="mt-2 inline-flex min-h-11 items-center rounded border px-3">공유 링크 열기</a><button type="button" className="mt-2 ml-2 min-h-11 rounded border px-3" disabled={publishBusyId === item.id} onClick={() => void publishAction(item.id, "unpublish")}>공개 해제</button></> : <><label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={publishConfirmId === item.id} onChange={(event) => setPublishConfirmId(event.target.checked ? item.id : null)} />교사가 확인한 HTML/CSS/JS 정적 웹앱을 갤러리에 공개합니다.</label><button type="button" className="mt-2 min-h-11 rounded border px-3 disabled:opacity-60" disabled={publishBusyId === item.id || publishConfirmId !== item.id} onClick={() => void publishAction(item.id, "publish")}>갤러리에 공개</button></>}
              </div>)}
              {publishNotice ? <p className="mt-2">{publishNotice}</p> : null}
            </section>

            {result ? <section className="rounded border p-3 lg:col-span-2">
              <p className="font-semibold">정규화된 파일 목록</p>
              <ul className="max-h-32 overflow-auto rounded border p-2">{resultFileList.map((file) => <li key={file.path}>{file.path} - {formatBytes(file.sizeBytes)}</li>)}</ul>
            </section> : null}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  ) : null;

  const statusText = validationOk ? "최근 검증: 통과" : result ? "최근 검증: 실패" : "아직 검증 전";

  return <div className="hud-card-shell hud-right-rail-inner rounded-xl p-3 text-xs">
    <p className="text-sm font-semibold">학생 제출물 검토</p>
    <p className="mt-1 text-[var(--theme-text-muted)]">학생이 제출한 HTML/CSS/JS 작품을 확인하고 검토 상태를 정해요.</p>
    <div className="mt-2 rounded border border-[var(--theme-border)] bg-[var(--theme-surface-muted)] p-2 text-[11px] leading-relaxed text-[var(--theme-text-muted)]">
      <p>승인됨은 교사가 검토를 마친 상태입니다.</p>
      <p>친구 작품 공개는 저장된 앱에서 별도로 설정합니다.</p>
    </div>
    <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[11px]">
      <p className="rounded border border-[var(--theme-border)] px-1.5 py-1">전체 {submissionSummary.total}</p>
      <p className="rounded border border-[var(--theme-border)] px-1.5 py-1">검토 {submissionSummary.pending}</p>
      <p className="rounded border border-[var(--theme-border)] px-1.5 py-1">승인 {submissionSummary.accepted}</p>
    </div>
    <div className="mt-3">{renderSubmissionWindowBanner()}</div>
    <div className="mt-3 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-muted)] p-3">
      <p className="text-sm font-semibold">최근 제출자 게임</p>
      <p className="mt-1 text-[11px] leading-relaxed text-[var(--theme-text-muted)]">
        최근 30분 안에 제출한 학생을 모아 발표자나 피드백 순서를 뽑아요.
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-[var(--theme-text-muted)]">
        실명 대신 닉네임 또는 수업용 이름만 보여줘요.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-2">
        <button type="button" className="min-h-11 w-full rounded border px-3" disabled={participantBusy} onClick={() => void fetchRecentParticipants()}>
          {participantBusy ? "불러오는 중..." : "최근 제출자 불러오기"}
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="min-h-11 rounded border px-3 disabled:opacity-60" disabled={recentParticipants.length === 0} onClick={pickRandomParticipant}>
            랜덤 뽑기
          </button>
          <button type="button" className="min-h-11 rounded border px-3 disabled:opacity-60" disabled={recentParticipants.length === 0} onClick={shuffleRecentParticipants}>
            다시 섞기
          </button>
        </div>
      </div>
      {participantError ? <p className="mt-2 text-[11px] text-rose-300">{participantError}</p> : null}
      <p className="mt-3 text-[11px] text-[var(--theme-text-muted)]">참가자 수 {recentParticipants.length}</p>
      {recentParticipants.length === 0 && !participantBusy ? (
        <p className="mt-2 rounded border border-dashed border-[var(--theme-border)] px-2 py-2 text-[11px] text-[var(--theme-text-muted)]">
          아직 최근 30분 안에 제출한 학생이 없어요.
        </p>
      ) : null}
      {recentParticipants.length > 0 ? (
        <div className="mt-2 flex max-h-24 flex-wrap gap-1 overflow-y-auto" aria-label="최근 제출자 닉네임 목록">
          {participantNames.map((name, index) => (
            <span key={`${name}-${index}`} className="rounded-full border border-[var(--theme-border)] bg-[var(--theme-surface)] px-2 py-1 text-[11px]">
              {name}
            </span>
          ))}
        </div>
      ) : null}
      <div aria-live="polite" className="mt-3">
        <p className="text-[11px] font-semibold text-[var(--theme-text-muted)]">오늘의 발표자</p>
        <div
          key={pickNonce}
          className={`relative mt-1 overflow-hidden rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 py-3 text-center transition ${pickedParticipant ? "scale-[1.02] animate-pulse" : ""}`}
        >
          {pickedParticipant ? (
            <>
              <span className="pointer-events-none absolute left-4 top-2 h-1.5 w-1.5 rounded-full bg-cyan-300" />
              <span className="pointer-events-none absolute right-6 top-5 h-1.5 w-1.5 rounded-full bg-amber-300" />
              <span className="pointer-events-none absolute bottom-3 left-1/2 h-1.5 w-1.5 rounded-full bg-rose-300" />
            </>
          ) : null}
          <p className="text-base font-semibold text-[var(--theme-text)]">{pickedParticipant?.displayName ?? "다음 피드백 친구"}</p>
        </div>
      </div>
    </div>
    <div className="mt-2 space-y-2">
      <button type="button" className="min-h-11 w-full rounded border px-3" onClick={() => void fetchSubmissions()}>제출물 새로고침</button>
      <button type="button" className="min-h-11 w-full rounded border px-3" onClick={() => setOpen(true)}>제출물 검토하기</button>
      {galleryHref ? <a href={galleryHref} target="_blank" rel="noreferrer noopener" className="flex min-h-11 w-full items-center justify-center rounded border px-3 text-center">갤러리 공개 작품 보기</a> : null}
    </div>
    <p className="mt-2 text-[11px] text-[var(--theme-text-muted)]">정적 웹앱 검증/배포도 이 도구 안에서 계속 사용할 수 있어요. {statusText}</p>
    {modal}
  </div>;
}
