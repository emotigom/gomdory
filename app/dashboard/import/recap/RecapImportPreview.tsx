"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";

import { useEffect, useMemo, useRef, useState } from "react";

import RecapSections from "@/lib/recap/RecapSections";
import {
  listTemplates,
  parseTemplateId,
  renderSections,
  type RecapData,
  type TemplateId,
} from "@/lib/recap/templates";
import { boardBoardHref } from "@/lib/dashboard/boardHrefs";

type RecapImportPayload = {
  schema: string;
  version: number;
  generatedAt?: string;
  board: {
    id?: string;
    title: string;
    shareCode?: string;
  };
  session: {
    id?: string;
    startedAt: string;
    endedAt: string;
    notice?: string | null;
    rulesText?: string | null;
    stats?: RecapData["session"]["stats"];
  };
  walls: Array<{
    id: string;
    title: string;
    cards: Array<{
      id: string;
      text: string;
      authorType?: "teacher" | "student";
      authorName?: string | null;
      createdAt: string;
      isFeatured?: boolean;
      isPinned?: boolean;
      files?: Array<{
        id: string;
        filename: string;
        byteSize?: number;
        contentType?: string;
        downloadPath?: string;
      }>;
    }>;
  }>;
};

type ZipFileSummary = {
  fileId: string;
  originalFilename: string;
  foundInZip: boolean;
  sizeBytes?: number;
};

type MissingFile = {
  fileId: string;
  filename: string;
};

type CommitSummary = {
  boardId: string;
  importedWalls: number;
  importedCards: number;
  importedFiles: number;
  missingFiles: MissingFile[];
  externalAttachmentsKept: number;
  completedAt: string;
  mode: "new" | "existing";
};

type CommitResponse = {
  boardId?: string;
  importedWalls?: number;
  importedCards?: number;
  importedFiles?: number;
  missingFiles?: MissingFile[];
  externalAttachmentsKept?: number;
  code?: string;
  userMessage?: string;
  error?: string;
};

type ParseZipResponse = {
  recap?: RecapImportPayload;
  recapJson?: string;
  filesSummary?: ZipFileSummary[];
  warnings?: string[];
  code?: string;
  userMessage?: string;
  error?: string;
};

type ImportStage = "idle" | "uploading" | "parsing" | "creating" | "uploadingFiles" | "done";

type RecapImportPreviewProps = {
  boards: Array<{ id: string; title: string }>;
};

const RECENT_RESULT_KEY = "gom.recapImport.latestResult";
const STAGE_ORDER: ImportStage[] = [
  "uploading",
  "parsing",
  "creating",
  "uploadingFiles",
  "done",
];

function toRecapData(payload: RecapImportPayload): RecapData {
  const cards = payload.walls.flatMap((wall) =>
    wall.cards.map((card) => ({
      id: card.id,
      wallId: wall.id,
      text: card.text,
      authorType: card.authorType,
      authorName: card.authorName,
      createdAt: card.createdAt,
      isFeatured: card.isFeatured,
      isPinned: card.isPinned,
      files: [],
      externalFiles: (card.files ?? []).map((file) => ({
        id: file.id,
        filename: file.filename,
        downloadPath: file.downloadPath,
      })),
    })),
  );

  return {
    board: payload.board,
    session: payload.session,
    walls: payload.walls.map((wall) => ({
      id: wall.id,
      title: wall.title,
      description: null,
    })),
    cards,
  };
}

function formatBytes(value?: number) {
  if (!value) {
    return "-";
  }
  if (value < 1024) {
    return `${value}B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)}KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(1)}MB`;
}

function getZipKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

export default function RecapImportPreview({ boards }: RecapImportPreviewProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [recapData, setRecapData] = useState<RecapData | null>(null);
  const [templateId, setTemplateId] = useState<TemplateId>("teacher_a4");
  const [recapJson, setRecapJson] = useState("");
  const [uploadType, setUploadType] = useState<"json" | "zip">("json");
  const [importMode, setImportMode] = useState<"new" | "existing">("new");
  const [boardTitle, setBoardTitle] = useState("");
  const [selectedBoardId, setSelectedBoardId] = useState(boards[0]?.id ?? "");
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [zipFiles, setZipFiles] = useState<ZipFileSummary[]>([]);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [isParsingZip, setIsParsingZip] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [stage, setStage] = useState<ImportStage>("idle");
  const [commitSummary, setCommitSummary] = useState<CommitSummary | null>(null);
  const [recentSummary, setRecentSummary] = useState<CommitSummary | null>(null);
  const [abortMessage, setAbortMessage] = useState<string | null>(null);
  const [slowNotice, setSlowNotice] = useState<string | null>(null);
  const [lastCommittedZipKey, setLastCommittedZipKey] = useState<string | null>(null);
  const templates = useMemo(() => listTemplates(), []);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const stageTimersRef = useRef<number[]>([]);

  useEffect(() => {
    const stored = window.localStorage.getItem(RECENT_RESULT_KEY);
    if (stored) {
      try {
        setRecentSummary(JSON.parse(stored) as CommitSummary);
      } catch {
        window.localStorage.removeItem(RECENT_RESULT_KEY);
      }
    }
  }, []);

  useEffect(() => {
    if (!isParsingZip && !isSubmitting) {
      setSlowNotice(null);
      return;
    }

    const timer = window.setTimeout(() => {
      setSlowNotice(
        "대용량 ZIP은 처리 시간이 길 수 있어요. 현재 단계가 오래 걸린다면 잠시 기다려 주세요.",
      );
    }, 12000);

    return () => window.clearTimeout(timer);
  }, [isParsingZip, isSubmitting]);

  useEffect(() => {
    return () => {
      stageTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  const resetPreviewState = () => {
    setErrorMessage(null);
    setRecapData(null);
    setRecapJson("");
    setZipFile(null);
    setZipFiles([]);
    setParseWarnings([]);
    setIsParsingZip(false);
    setUploadProgress(0);
    setStage("idle");
    setAbortMessage(null);
    setSlowNotice(null);
    setCommitSummary(null);
    resetStageTimers();
  };

  const resetStageTimers = () => {
    stageTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    stageTimersRef.current = [];
  };

  const scheduleCommitStages = () => {
    resetStageTimers();
    stageTimersRef.current.push(
      window.setTimeout(() => setStage("creating"), 900),
      window.setTimeout(() => setStage("uploadingFiles"), 1800),
    );
  };

  const abortActiveRequest = () => {
    if (xhrRef.current) {
      xhrRef.current.abort();
    }
  };

  const handleJsonFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    resetPreviewState();

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = typeof reader.result === "string" ? reader.result : "";
        const parsed = JSON.parse(raw) as RecapImportPayload;

        if (parsed.schema !== "gom-recap" || parsed.version !== 1) {
          setErrorMessage("gom-recap JSON v1 파일만 지원합니다.");
          setRecapData(null);
          setRecapJson("");
          return;
        }

        if (!parsed.board?.title || !parsed.session?.startedAt || !parsed.session?.endedAt) {
          setErrorMessage("필수 필드가 누락된 파일입니다.");
          setRecapData(null);
          setRecapJson("");
          return;
        }

        setRecapData(toRecapData(parsed));
        setRecapJson(raw);
      } catch {
        setErrorMessage("파일을 읽는 중 오류가 발생했습니다.");
        setRecapData(null);
        setRecapJson("");
      }
    };
    reader.readAsText(file);
  };

  const sendFormData = <T,>(
    url: string,
    formData: FormData,
    options?: { onUploadComplete?: () => void },
  ): Promise<T> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;
      xhr.open("POST", url);
      xhr.responseType = "text";

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setUploadProgress(Math.round((event.loaded / event.total) * 100));
        }
      };

      xhr.upload.onloadend = () => {
        setUploadProgress(100);
        options?.onUploadComplete?.();
      };

      xhr.onload = () => {
        let parsed: unknown = {};
        if (xhr.responseText) {
          try {
            parsed = JSON.parse(xhr.responseText) as unknown;
          } catch {
            parsed = {};
          }
        }

        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(parsed as T);
          return;
        }

        const payload = parsed as { userMessage?: string; error?: string };
        reject(new Error(payload.userMessage ?? payload.error ?? "요청에 실패했습니다."));
      };

      xhr.onerror = () => {
        reject(new Error("네트워크 오류가 발생했습니다."));
      };

      xhr.onabort = () => {
        reject(new Error("abort"));
      };

      xhr.send(formData);
    });
  };

  const handleZipFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    resetPreviewState();

    if (!file) {
      return;
    }

    setIsParsingZip(true);
    setZipFile(file);
    setStage("uploading");
    setUploadProgress(0);
    setAbortMessage(null);

    try {
      const formData = new FormData();
      formData.append("zip", file);
      const payload = await sendFormData<ParseZipResponse>(
        apiV1Path("dashboard/import/recap/parse-zip"),
        formData,
        {
          onUploadComplete: () => setStage("parsing"),
        },
      );

      if (!payload.recap) {
        setErrorMessage(payload.userMessage ?? payload.error ?? "ZIP 파일을 처리할 수 없습니다.");
        return;
      }

      setRecapData(toRecapData(payload.recap));
      setRecapJson(payload.recapJson ?? JSON.stringify(payload.recap));
      setZipFiles(payload.filesSummary ?? []);
      setParseWarnings(payload.warnings ?? []);
    } catch (error) {
      if (error instanceof Error && error.message === "abort") {
        setAbortMessage("ZIP 업로드가 취소되었습니다.");
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("ZIP 파일을 처리하는 중 오류가 발생했습니다.");
      }
    } finally {
      setIsParsingZip(false);
      setStage("idle");
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setAbortMessage(null);
    setCommitSummary(null);

    if (uploadType === "zip") {
      if (!zipFile || !recapData) {
        return;
      }

      const zipKey = getZipKey(zipFile);
      if (lastCommittedZipKey && lastCommittedZipKey === zipKey) {
        setErrorMessage("이미 복원한 ZIP입니다. 새 ZIP을 선택해주세요.");
        return;
      }

      setIsSubmitting(true);
      setUploadProgress(0);
      setStage("uploading");

      try {
        const formData = new FormData();
        formData.append("zip", zipFile);
        formData.append("mode", importMode);
        if (importMode === "existing") {
          formData.append("targetBoardId", selectedBoardId);
        }
        if (importMode === "new" && boardTitle.trim().length > 0) {
          formData.append("title", boardTitle.trim());
        }

        const payload = await sendFormData<CommitResponse>(
          apiV1Path("dashboard/import/recap/commit-zip"),
          formData,
          {
            onUploadComplete: () => {
              setStage("parsing");
              scheduleCommitStages();
            },
          },
        );

        if (!payload.boardId) {
          setErrorMessage(payload.userMessage ?? payload.error ?? "가져오기에 실패했습니다.");
          return;
        }

        const summary: CommitSummary = {
          boardId: payload.boardId,
          importedWalls: payload.importedWalls ?? 0,
          importedCards: payload.importedCards ?? 0,
          importedFiles: payload.importedFiles ?? 0,
          missingFiles: payload.missingFiles ?? [],
          externalAttachmentsKept: payload.externalAttachmentsKept ?? 0,
          completedAt: new Date().toISOString(),
          mode: importMode,
        };

        setCommitSummary(summary);
        setRecentSummary(summary);
        window.localStorage.setItem(RECENT_RESULT_KEY, JSON.stringify(summary));
        setLastCommittedZipKey(zipKey);
        setStage("done");
      } catch (error) {
        if (error instanceof Error && error.message === "abort") {
          setAbortMessage("가져오기 요청이 취소되었습니다.");
        } else if (error instanceof Error) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage("가져오기에 실패했습니다.");
        }
      } finally {
        setIsSubmitting(false);
        resetStageTimers();
      }
      return;
    }

    if (!recapData || recapJson.length === 0) {
      return;
    }

    if (importMode === "existing" && selectedBoardId.length === 0) {
      return;
    }

    setIsSubmitting(true);
    setStage("creating");

    try {
      const response = await fetch(apiV1Path("dashboard/import/recap/commit-json"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recapJson,
          mode: importMode,
          targetBoardId: importMode === "existing" ? selectedBoardId : undefined,
          title: importMode === "new" ? boardTitle.trim() || undefined : undefined,
        }),
      });

      const payload = (await response.json()) as CommitResponse;
      if (!response.ok || !payload.boardId) {
        setErrorMessage(payload.userMessage ?? payload.error ?? "가져오기에 실패했습니다.");
        return;
      }

      const summary: CommitSummary = {
        boardId: payload.boardId,
        importedWalls: payload.importedWalls ?? 0,
        importedCards: payload.importedCards ?? 0,
        importedFiles: payload.importedFiles ?? 0,
        missingFiles: payload.missingFiles ?? [],
        externalAttachmentsKept: payload.externalAttachmentsKept ?? 0,
        completedAt: new Date().toISOString(),
        mode: importMode,
      };

      setCommitSummary(summary);
      setRecentSummary(summary);
      window.localStorage.setItem(RECENT_RESULT_KEY, JSON.stringify(summary));
      setStage("done");
    } catch {
      setErrorMessage("가져오기에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const sections = recapData ? renderSections(templateId, recapData) : null;
  const isZipLocked =
    uploadType === "zip" &&
    zipFile &&
    lastCommittedZipKey &&
    lastCommittedZipKey === getZipKey(zipFile);
  const canSubmit = Boolean(
    recapData &&
      (uploadType === "zip" ? zipFile : recapJson.length > 0) &&
      (importMode === "new" || selectedBoardId.length > 0) &&
      !isZipLocked,
  );
  const totalZipFiles = zipFiles.length;
  const totalMatchedFiles = zipFiles.filter((file) => file.foundInZip).length;
  const stageIndex = STAGE_ORDER.indexOf(stage);

  return (
    <form
      className="dashboard-import-card space-y-6 rounded-lg border border-gray-200 p-6 shadow-sm"
      onSubmit={handleSubmit}
    >
      {recentSummary ? (
        <div className="dashboard-import-card rounded-md border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase text-indigo-500">최근 성공 결과</p>
              <p className="text-base font-semibold">보드 복원이 완료되었습니다.</p>
              <p className="text-xs text-indigo-600">
                {new Date(recentSummary.completedAt).toLocaleString("ko-KR")}
              </p>
            </div>
            <a
              className="dashboard-import-control rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white"
              href={`${boardBoardHref(recentSummary.boardId)}?import=recap`}
            >
              보드로 이동
            </a>
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700">업로드 형식</p>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                className="dashboard-import-input"
                type="radio"
              name="uploadType"
              value="json"
              checked={uploadType === "json"}
              onChange={() => {
                setUploadType("json");
                resetPreviewState();
              }}
            />
            JSON(v1) 업로드
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                className="dashboard-import-input"
                type="radio"
              name="uploadType"
              value="zip"
              checked={uploadType === "zip"}
              onChange={() => {
                setUploadType("zip");
                resetPreviewState();
              }}
            />
            ZIP 업로드
          </label>
        </div>
      </div>

      {uploadType === "json" ? (
        <div className="dashboard-import-dropzone space-y-2 rounded-lg border border-dashed border-gray-200 bg-gray-50/60 p-4">
          <label className="text-sm font-medium text-gray-700" htmlFor="recap-file-json">
            JSON 파일 업로드
          </label>
          <input
            id="recap-file-json"
            type="file"
            accept="application/json"
            onChange={handleJsonFileChange}
            className="dashboard-import-input block w-full min-w-0 rounded-md border border-gray-200 px-3 py-2 text-sm"
          />
          <p className="text-xs text-gray-500">
            업로드한 파일은 브라우저에서만 처리되며 서버에 저장되지 않습니다.
          </p>
        </div>
      ) : (
        <div className="dashboard-import-dropzone space-y-2 rounded-lg border border-dashed border-gray-200 bg-gray-50/60 p-4">
          <label className="text-sm font-medium text-gray-700" htmlFor="recap-file-zip">
            ZIP 파일 업로드
          </label>
          <input
            id="recap-file-zip"
            type="file"
            accept=".zip,application/zip"
            onChange={handleZipFileChange}
            className="dashboard-import-input block w-full min-w-0 rounded-md border border-gray-200 px-3 py-2 text-sm"
          />
          <p className="text-xs text-gray-500">
            ZIP 파일은 서버에서 recap.json을 추출해 미리보기를 생성합니다.
          </p>
          {isParsingZip ? (
            <div className="space-y-2 text-xs text-indigo-600">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 break-words">ZIP 업로드 중… {uploadProgress}%</span>
                <button
                  type="button"
                  onClick={abortActiveRequest}
                  className="dashboard-import-control dashboard-import-danger-control rounded px-2 py-1 text-xs font-semibold text-red-500"
                >
                  취소
                </button>
              </div>
              <div className="h-2 w-full rounded-full bg-indigo-100">
                <div
                  className="h-2 rounded-full bg-indigo-500"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p>{stage === "parsing" ? "ZIP 파싱 중…" : "업로드 진행 중…"}</p>
            </div>
          ) : null}
          {abortMessage ? <p className="text-xs text-amber-600">{abortMessage}</p> : null}
        </div>
      )}

      {errorMessage ? (
        <div className="dashboard-import-card rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {parseWarnings.length > 0 ? (
        <div className="dashboard-import-card rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <p className="font-semibold">확인 안내</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {parseWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {recapData ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-600">선택 템플릿</p>
              <p className="min-w-0 break-words text-lg font-semibold text-gray-900">{recapData.board.title}</p>
            </div>
            <div className="min-w-0">
              <label className="text-sm font-medium text-gray-700" htmlFor="template-select">
                템플릿 선택
              </label>
              <select
                id="template-select"
                className="dashboard-import-input mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                value={templateId}
                onChange={(event) => setTemplateId(parseTemplateId(event.target.value))}
              >
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {sections ? <RecapSections sections={sections} /> : null}
          {uploadType === "zip" && zipFiles.length > 0 ? (
            <div className="dashboard-import-card rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
              <p className="font-medium text-gray-900">첨부 파일 매칭 결과</p>
              <p className="mt-1 text-xs text-gray-500">
                ZIP에서 {totalMatchedFiles}/{totalZipFiles}개 파일을 찾았습니다.
              </p>
              <ul className="mt-2 space-y-1">
                {zipFiles.map((file) => (
                  <li key={file.fileId} className="dashboard-import-row flex min-w-0 flex-wrap items-center justify-between gap-3 rounded px-2 py-1">
                    <span className="min-w-0 flex-1 break-words">{file.originalFilename}</span>
                    <span className="shrink-0 text-xs text-gray-400">{formatBytes(file.sizeBytes)}</span>
                    <span
                      className={`shrink-0 text-xs font-semibold ${
                        file.foundInZip ? "text-emerald-600" : "text-amber-600"
                      }`}
                    >
                      {file.foundInZip ? "복원 가능" : "파일 없음"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="dashboard-import-empty-state rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
          {uploadType === "zip"
            ? "ZIP 파일을 업로드하면 리캡 미리보기가 표시됩니다."
            : "JSON 파일을 업로드하면 리캡 미리보기가 표시됩니다."}
        </div>
      )}

      {uploadType === "zip" && (isSubmitting || stage !== "idle") ? (
        <div className="dashboard-import-card rounded-md border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">복원 진행 단계</p>
            {isSubmitting ? (
              <button
                type="button"
                onClick={abortActiveRequest}
                className="dashboard-import-control dashboard-import-danger-control rounded px-2 py-1 text-xs font-semibold text-red-500"
              >
                취소
              </button>
            ) : null}
          </div>
          <ul className="mt-3 space-y-2">
            {STAGE_ORDER.map((item, index) => {
              const isCompleted = stage === "done" || index < stageIndex;
              const isActive = stage === item;
              const labelMap: Record<ImportStage, string> = {
                uploading: `ZIP 업로드 중 (${uploadProgress}%)`,
                parsing: "ZIP 파싱 중",
                creating: "DB 생성 중",
                uploadingFiles: `R2 업로드 ${
                  isCompleted ? totalMatchedFiles : 0
                } / ${totalMatchedFiles}`,
                done: "완료",
                idle: "대기",
              };

              if (item === "done" && stage !== "done") {
                return null;
              }

              return (
                <li key={item} className="dashboard-import-row flex min-w-0 items-center gap-2 rounded px-2 py-1">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isCompleted
                        ? "bg-emerald-500"
                        : isActive
                          ? "bg-indigo-500"
                          : "bg-gray-300"
                    }`}
                  />
                  <span
                    className={`text-sm ${
                      isCompleted
                        ? "text-emerald-700"
                        : isActive
                          ? "text-indigo-700"
                          : "text-gray-500"
                    }`}
                  >
                    {labelMap[item]}
                  </span>
                </li>
              );
            })}
          </ul>
          {slowNotice ? <p className="mt-2 text-xs text-indigo-600">{slowNotice}</p> : null}
        </div>
      ) : null}

      {commitSummary ? (
        <div className="dashboard-import-card rounded-md border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase text-emerald-600">복원 완료</p>
              <p className="text-base font-semibold">리캡 복원이 완료되었습니다.</p>
            </div>
            <a
              className="dashboard-import-control rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"
              href={`${boardBoardHref(commitSummary.boardId)}?import=recap`}
            >
              보드로 이동
            </a>
          </div>
          <div className="mt-3 grid gap-2 text-xs text-emerald-800 sm:grid-cols-2">
            <div>복원된 벽: {commitSummary.importedWalls}개</div>
            <div>복원된 카드: {commitSummary.importedCards}개</div>
            <div>복원된 파일: {commitSummary.importedFiles}개</div>
            <div>외부 링크 유지: {commitSummary.externalAttachmentsKept}개</div>
          </div>
          {commitSummary.missingFiles.length > 0 ? (
            <div className="mt-3">
              <p className="text-xs font-semibold text-emerald-700">누락된 파일</p>
              <ul className="mt-1 space-y-1 text-xs text-emerald-800">
                {commitSummary.missingFiles.map((file) => (
                  <li key={file.fileId} className="dashboard-import-row flex min-w-0 flex-wrap items-center justify-between gap-2 rounded px-2 py-1">
                    <span className="min-w-0 flex-1 break-words">{file.filename}</span>
                    <span className="min-w-0 break-words text-emerald-600">{file.fileId}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {commitSummary.externalAttachmentsKept > 0 ? (
            <p className="mt-2 text-xs text-emerald-700">
              일부 첨부는 ZIP에 없어서 외부 링크로 유지되었습니다.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-4 border-t border-gray-200 pt-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-gray-900">저장하기</h2>
          <p className="text-sm text-gray-600">미리보기 내용을 선택한 보드로 저장합니다.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              className="dashboard-import-input"
              type="radio"
              name="importMode"
              value="new"
              checked={importMode === "new"}
              onChange={() => setImportMode("new")}
            />
            새 보드로 복원
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              className="dashboard-import-input"
              type="radio"
              name="importMode"
              value="existing"
              checked={importMode === "existing"}
              onChange={() => setImportMode("existing")}
            />
            기존 보드에 추가
          </label>
        </div>
        {importMode === "new" ? (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700" htmlFor="board-title">
              새 보드 이름 (선택)
            </label>
            <input
              id="board-title"
              name="boardTitle"
              type="text"
              value={boardTitle}
              onChange={(event) => setBoardTitle(event.target.value)}
              className="dashboard-import-input w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
              placeholder="예: 2학년 1반 리캡"
            />
          </div>
        ) : (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700" htmlFor="board-select">
              기존 보드 선택
            </label>
            <select
              id="board-select"
              name="boardId"
              value={selectedBoardId}
              onChange={(event) => setSelectedBoardId(event.target.value)}
              className="dashboard-import-input w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
            >
              {boards.length === 0 ? (
                <option value="">보드가 없습니다.</option>
              ) : (
                boards.map((board) => (
                  <option key={board.id} value={board.id}>
                    {board.title}
                  </option>
                ))
              )}
            </select>
          </div>
        )}
        <button
          type="submit"
          disabled={!canSubmit || isSubmitting || isParsingZip}
          className={`dashboard-import-control w-full rounded-md px-4 py-2 text-sm font-semibold text-white transition ${
            canSubmit && !isSubmitting && !isParsingZip
              ? "bg-indigo-600 hover:bg-indigo-500"
              : "cursor-not-allowed bg-gray-300"
          }`}
        >
          {isSubmitting
            ? "처리 중..."
            : isZipLocked
              ? "이미 처리된 ZIP입니다"
              : "DB로 가져오기"}
        </button>
        {isZipLocked ? (
          <p className="text-xs text-gray-500">다른 ZIP 파일을 선택하면 다시 복원할 수 있어요.</p>
        ) : null}
      </div>
    </form>
  );
}
