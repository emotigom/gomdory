"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";

import { useEffect, useMemo, useRef, useState } from "react";

import { publishDashboardInvalidate } from "@/lib/dashboard/invalidation";

import type { NormalizedBoardPayload } from "@/lib/board/importer";

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
  externalAttachmentsConverted: number;
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
  externalAttachmentsConverted?: number;
  code?: string;
  userMessage?: string;
  error?: string;
};

type ParseZipResponse = {
  board?: NormalizedBoardPayload;
  boardJson?: string;
  filesSummary?: ZipFileSummary[];
  warnings?: string[];
  code?: string;
  userMessage?: string;
  error?: string;
};

type ImportStage = "idle" | "uploading" | "parsing" | "creating" | "uploadingFiles" | "done";

type BoardImportPreviewProps = {
  boards: Array<{ id: string; title: string }>;
};

const RECENT_RESULT_KEY = "gom.boardImport.latestResult";
const STAGE_ORDER: ImportStage[] = [
  "uploading",
  "parsing",
  "creating",
  "uploadingFiles",
  "done",
];

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

export default function BoardImportPreview({ boards }: BoardImportPreviewProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [boardData, setBoardData] = useState<NormalizedBoardPayload | null>(null);
  const [boardJson, setBoardJson] = useState("");
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [zipFiles, setZipFiles] = useState<ZipFileSummary[]>([]);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [importMode, setImportMode] = useState<"new" | "existing">("new");
  const [boardTitle, setBoardTitle] = useState("");
  const [selectedBoardId, setSelectedBoardId] = useState(boards[0]?.id ?? "");
  const [downloadExternal, setDownloadExternal] = useState(false);
  const [isParsingZip, setIsParsingZip] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [stage, setStage] = useState<ImportStage>("idle");
  const [commitSummary, setCommitSummary] = useState<CommitSummary | null>(null);
  const [recentSummary, setRecentSummary] = useState<CommitSummary | null>(null);
  const [abortMessage, setAbortMessage] = useState<string | null>(null);
  const [slowNotice, setSlowNotice] = useState<string | null>(null);
  const [lastCommittedZipKey, setLastCommittedZipKey] = useState<string | null>(null);
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
    setBoardData(null);
    setBoardJson("");
    setZipFiles([]);
    setParseWarnings([]);
    setCommitSummary(null);
    setAbortMessage(null);
    setStage("idle");
    setUploadProgress(0);
  };

  const boardSummary = useMemo(() => {
    if (!boardData) {
      return null;
    }
    const cardCount = boardData.cards.length;
    const internalCount = boardData.cards.reduce(
      (sum, card) => sum + card.internalFiles.length,
      0,
    );
    const externalCount = boardData.cards.reduce(
      (sum, card) => sum + card.externalAttachments.length,
      0,
    );

    return {
      title: boardData.board.title,
      description: boardData.board.description,
      viewType: boardData.board.viewType,
      walls: boardData.walls.length,
      cards: cardCount,
      internalCount,
      externalCount,
    };
  }, [boardData]);

  const handleZipChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    resetPreviewState();
    setZipFile(file);
    setIsParsingZip(true);

    const formData = new FormData();
    formData.append("zip", file);

    try {
      const response = await fetch(apiV1Path("dashboard/import/board/parse-zip"), {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as ParseZipResponse;
      if (!response.ok) {
        setErrorMessage(payload.userMessage ?? payload.error ?? "ZIP을 처리할 수 없습니다.");
        return;
      }
      if (!payload.board) {
        setErrorMessage("board.json 정보를 불러오지 못했습니다.");
        return;
      }
      setBoardData(payload.board);
      setBoardJson(payload.boardJson ?? "");
      setZipFiles(payload.filesSummary ?? []);
      setParseWarnings(payload.warnings ?? []);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "ZIP을 처리할 수 없습니다.",
      );
    } finally {
      setIsParsingZip(false);
    }
  };

  const handleCommit = async () => {
    if (!zipFile || !boardData) {
      setErrorMessage("가져오기 파일을 확인해주세요.");
      return;
    }

    setErrorMessage(null);
    setAbortMessage(null);
    setCommitSummary(null);
    setIsSubmitting(true);
    setStage("uploading");
    setUploadProgress(0);

    stageTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    stageTimersRef.current = [
      window.setTimeout(() => setStage("parsing"), 700),
      window.setTimeout(() => setStage("creating"), 1600),
      window.setTimeout(() => setStage("uploadingFiles"), 2600),
    ];

    const formData = new FormData();
    formData.append("zip", zipFile);
    formData.append("mode", importMode);
    formData.append("downloadExternal", downloadExternal ? "true" : "false");
    if (importMode === "existing") {
      formData.append("targetBoardId", selectedBoardId);
    } else if (boardTitle.trim().length > 0) {
      formData.append("title", boardTitle.trim());
    }

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        return;
      }
      const percent = Math.round((event.loaded / event.total) * 100);
      setUploadProgress(percent);
    };

    xhr.onreadystatechange = () => {
      if (xhr.readyState !== XMLHttpRequest.DONE) {
        return;
      }

      setIsSubmitting(false);
      if (xhr.status === 0) {
        setAbortMessage("업로드가 취소되었습니다.");
        setStage("idle");
        return;
      }

      try {
        const payload = JSON.parse(xhr.responseText) as CommitResponse;
        if (xhr.status >= 400) {
          setErrorMessage(payload.userMessage ?? payload.error ?? "가져오기에 실패했습니다.");
          setStage("idle");
          return;
        }

        const summary: CommitSummary = {
          boardId: payload.boardId ?? "",
          importedWalls: payload.importedWalls ?? 0,
          importedCards: payload.importedCards ?? 0,
          importedFiles: payload.importedFiles ?? 0,
          missingFiles: payload.missingFiles ?? [],
          externalAttachmentsKept: payload.externalAttachmentsKept ?? 0,
          externalAttachmentsConverted: payload.externalAttachmentsConverted ?? 0,
          completedAt: new Date().toISOString(),
          mode: importMode,
        };

        setCommitSummary(summary);
        setRecentSummary(summary);
        setLastCommittedZipKey(getZipKey(zipFile));
        window.localStorage.setItem(RECENT_RESULT_KEY, JSON.stringify(summary));
        setStage("done");
        publishDashboardInvalidate({
          type: "boards_changed",
          reason: "bulk",
          ts: Date.now(),
        });
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "가져오기에 실패했습니다.",
        );
        setStage("idle");
      }
    };

    xhr.open("POST", apiV1Path("dashboard/import/board/commit-zip"));
    xhr.send(formData);
  };

  const handleCancel = () => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
  };

  const canSubmit =
    !isParsingZip &&
    !isSubmitting &&
    zipFile &&
    boardData &&
    (importMode === "new" || selectedBoardId.length > 0);

  const recentStatus = recentSummary
    ? `최근 가져오기: ${new Date(recentSummary.completedAt).toLocaleString("ko-KR")}`
    : null;

  return (
    <div className="dashboard-import-card space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="dashboard-import-dropzone space-y-2 rounded-lg border border-dashed border-gray-200 bg-gray-50/60 p-4">
        <label className="text-sm font-medium text-gray-700" htmlFor="board-import-zip">
          ZIP 파일
        </label>
        <input
          id="board-import-zip"
          type="file"
          accept=".zip,application/zip"
          onChange={handleZipChange}
          className="dashboard-import-input block w-full min-w-0 text-sm text-gray-700 file:mr-4 file:rounded-md file:border-0 file:bg-gray-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
        />
        <p className="text-xs text-gray-500">
          board.json 및 files/ 폴더가 포함된 ZIP을 업로드해주세요.
        </p>
      </div>

      {isParsingZip && <p className="text-sm text-gray-600">ZIP을 확인하는 중...</p>}
      {errorMessage && (
        <div className="dashboard-import-card rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}
      {abortMessage && (
        <div className="dashboard-import-card rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-700">
          {abortMessage}
        </div>
      )}
      {slowNotice && <p className="text-xs text-gray-500">{slowNotice}</p>}

      {boardSummary && (
        <div className="dashboard-import-card space-y-3 rounded-lg border border-gray-100 bg-gray-50 p-4">
          <div className="space-y-1">
            <p className="min-w-0 break-words text-lg font-semibold text-gray-900">{boardSummary.title}</p>
            {boardSummary.description && (
              <p className="min-w-0 break-words text-sm text-gray-600">{boardSummary.description}</p>
            )}
            <p className="text-xs text-gray-500">
              보기 타입: {boardSummary.viewType}
            </p>
          </div>
          <div className="grid gap-3 text-sm text-gray-700 sm:grid-cols-2">
            <div>담벼락: {boardSummary.walls}개</div>
            <div>카드: {boardSummary.cards}개</div>
            <div>내부 첨부: {boardSummary.internalCount}개</div>
            <div>외부 첨부: {boardSummary.externalCount}개</div>
          </div>
        </div>
      )}

      {parseWarnings.length > 0 && (
        <div className="dashboard-import-card space-y-2 rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-700">
          <div className="font-medium">주의사항</div>
          <ul className="list-disc space-y-1 pl-5">
            {parseWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {zipFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">내부 첨부 파일</p>
          <div className="dashboard-import-card overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full text-sm text-gray-700">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">파일</th>
                  <th className="px-3 py-2 text-left">상태</th>
                  <th className="px-3 py-2 text-right">용량</th>
                </tr>
              </thead>
              <tbody>
                {zipFiles.map((file) => (
                  <tr key={file.fileId} className="dashboard-import-row border-t border-gray-100">
                    <td className="max-w-[15rem] px-3 py-2">
                      <span className="block min-w-0 break-words">{file.originalFilename}</span>
                    </td>
                    <td className="px-3 py-2">
                      {file.foundInZip ? "확인됨" : "누락"}
                    </td>
                    <td className="px-3 py-2 text-right">{formatBytes(file.sizeBytes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="dashboard-import-card space-y-4 rounded-lg border border-gray-100 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="text-sm font-medium text-gray-700">가져오기 방식</label>
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-700">
            <label className="flex items-center gap-2">
              <input
                className="dashboard-import-input"
                type="radio"
                value="new"
                checked={importMode === "new"}
                onChange={() => setImportMode("new")}
              />
              새 보드 만들기
            </label>
            <label className="flex items-center gap-2">
              <input
                className="dashboard-import-input"
                type="radio"
                value="existing"
                checked={importMode === "existing"}
                onChange={() => setImportMode("existing")}
              />
              기존 보드에 추가
            </label>
          </div>
        </div>

        {importMode === "new" ? (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700" htmlFor="board-title">
              새 보드 제목 (선택)
            </label>
            <input
              id="board-title"
              type="text"
              value={boardTitle}
              onChange={(event) => setBoardTitle(event.target.value)}
              placeholder={boardData?.board.title ?? "보드 제목"}
              className="dashboard-import-input w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
        ) : (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700" htmlFor="board-select">
              기존 보드 선택
            </label>
            <select
              id="board-select"
              value={selectedBoardId}
              onChange={(event) => setSelectedBoardId(event.target.value)}
              className="dashboard-import-input w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
            >
              {boards.map((board) => (
                <option key={board.id} value={board.id}>
                  {board.title}
                </option>
              ))}
            </select>
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            className="dashboard-import-input"
            type="checkbox"
            checked={downloadExternal}
            onChange={(event) => setDownloadExternal(event.target.checked)}
          />
          외부 첨부를 다운로드해서 내부 첨부로 복원하기
        </label>
      </div>

      <div className="dashboard-import-card space-y-3 rounded-lg border border-gray-100 bg-gray-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-medium text-gray-700">진행 상태</div>
          {recentStatus && <div className="min-w-0 break-words text-xs text-gray-500">{recentStatus}</div>}
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-medium text-gray-600">
          {STAGE_ORDER.map((item) => (
            <span
              key={item}
              className={`rounded-full px-3 py-1 ${
                stage === item ? "bg-black text-white" : "bg-gray-200"
              }`}
            >
              {item === "uploading" && "업로드"}
              {item === "parsing" && "분석"}
              {item === "creating" && "보드 생성"}
              {item === "uploadingFiles" && "첨부 업로드"}
              {item === "done" && "완료"}
            </span>
          ))}
        </div>
        {isSubmitting && (
          <div className="space-y-2">
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full bg-black transition-all"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <div className="text-xs text-gray-500">업로드 진행률: {uploadProgress}%</div>
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleCommit}
            disabled={!canSubmit}
            className="dashboard-import-control rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            가져오기 실행
          </button>
          {isSubmitting && (
            <button
              type="button"
              onClick={handleCancel}
              className="dashboard-import-control dashboard-import-danger-control rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700"
            >
              취소
            </button>
          )}
        </div>
      </div>

      {commitSummary && (
        <div className="dashboard-import-card space-y-3 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <div className="font-medium">가져오기 완료</div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>담벼락: {commitSummary.importedWalls}개</div>
            <div>카드: {commitSummary.importedCards}개</div>
            <div>내부 첨부: {commitSummary.importedFiles}개</div>
            <div>외부 첨부 유지: {commitSummary.externalAttachmentsKept}개</div>
            <div>외부 첨부 전환: {commitSummary.externalAttachmentsConverted}개</div>
          </div>
          {commitSummary.missingFiles.length > 0 && (
            <div className="space-y-1">
              <div className="font-medium">누락된 내부 첨부</div>
              <ul className="list-disc space-y-1 pl-5">
                {commitSummary.missingFiles.map((file) => (
                  <li key={file.fileId} className="min-w-0 break-words">{file.filename}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {boardJson && lastCommittedZipKey === (zipFile ? getZipKey(zipFile) : null) && (
        <div className="dashboard-import-card rounded-md border border-gray-200 bg-white p-3 text-xs text-gray-500">
          동일 ZIP을 다시 가져오면 중복 카드가 생성될 수 있어요.
        </div>
      )}
    </div>
  );
}
