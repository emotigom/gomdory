"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";

import { useEffect, useMemo, useRef, useState } from "react";

import { boardBoardHref } from "@/lib/dashboard/boardHrefs";

type PadletPreview = {
  counts: {
    walls: number;
    cards: number;
    attachments: number;
  };
  sections: Array<{
    title: string;
    cards: number;
    attachments: number;
  }>;
  samples: Array<{
    wallTitle: string;
    text: string;
    attachments: number;
    createdAt: string;
  }>;
  warnings: string[];
};

type ParseResponse = {
  preview?: PadletPreview;
  source?: "csv" | "zip";
  csvFilename?: string;
  code?: string;
  userMessage?: string;
  error?: string;
};

type CommitResponse = {
  boardId?: string;
  importedWalls?: number;
  importedCards?: number;
  importedAttachments?: number;
  warnings?: string[];
  mode?: "new" | "existing";
  code?: string;
  userMessage?: string;
  error?: string;
};

type CommitSummary = {
  boardId: string;
  importedWalls: number;
  importedCards: number;
  importedAttachments: number;
  warnings: string[];
  mode: "new" | "existing";
};

type ImportStage = "idle" | "uploading" | "parsing" | "creating" | "done";

type PadletImportPreviewProps = {
  boards: Array<{ id: string; title: string }>;
};

const STAGE_ORDER: ImportStage[] = ["uploading", "parsing", "creating", "done"];

export default function PadletImportPreview({ boards }: PadletImportPreviewProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PadletPreview | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [stage, setStage] = useState<ImportStage>("idle");
  const [importMode, setImportMode] = useState<"new" | "existing">("new");
  const [boardTitle, setBoardTitle] = useState("Padlet 가져오기");
  const [selectedBoardId, setSelectedBoardId] = useState(boards[0]?.id ?? "");
  const [commitSummary, setCommitSummary] = useState<CommitSummary | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const stageIndex = useMemo(() => STAGE_ORDER.indexOf(stage), [stage]);

  useEffect(() => {
    return () => {
      if (xhrRef.current) {
        xhrRef.current.abort();
      }
    };
  }, []);

  const resetState = () => {
    setPreview(null);
    setErrorMessage(null);
    setCommitSummary(null);
    setUploadProgress(0);
    setStage("idle");
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

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    setFile(nextFile);
    resetState();

    if (!nextFile) {
      return;
    }

    setIsParsing(true);
    setStage("uploading");

    const formData = new FormData();
    formData.append("file", nextFile);

    try {
      const response = await sendFormData<ParseResponse>(
        apiV1Path("dashboard/import/padlet/parse"),
        formData,
        { onUploadComplete: () => setStage("parsing") },
      );

      if (!response.preview) {
        throw new Error("미리보기 정보를 찾을 수 없습니다.");
      }

      setPreview(response.preview);
      setStage("idle");
    } catch (error) {
      if (error instanceof Error && error.message === "abort") {
        return;
      }
      setErrorMessage(
        error instanceof Error ? error.message : "미리보기 생성에 실패했습니다.",
      );
      setStage("idle");
    } finally {
      setIsParsing(false);
    }
  };

  const handleCommit = async () => {
    if (!file || !preview) {
      return;
    }

    if (importMode === "existing" && !selectedBoardId) {
      setErrorMessage("추가할 보드를 선택해주세요.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setStage("uploading");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("mode", importMode);
    if (importMode === "existing") {
      formData.append("targetBoardId", selectedBoardId);
    }
    if (importMode === "new" && boardTitle.trim().length > 0) {
      formData.append("title", boardTitle.trim());
    }

    try {
      const response = await sendFormData<CommitResponse>(
        apiV1Path("dashboard/import/padlet/commit"),
        formData,
        { onUploadComplete: () => setStage("creating") },
      );

      if (!response.boardId) {
        throw new Error("가져오기 결과를 확인할 수 없습니다.");
      }

      setCommitSummary({
        boardId: response.boardId,
        importedWalls: response.importedWalls ?? 0,
        importedCards: response.importedCards ?? 0,
        importedAttachments: response.importedAttachments ?? 0,
        warnings: response.warnings ?? [],
        mode: response.mode ?? importMode,
      });
      setStage("done");
    } catch (error) {
      if (error instanceof Error && error.message === "abort") {
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : "가져오기에 실패했습니다.");
      setStage("idle");
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = Boolean(preview && file) &&
    !isParsing &&
    !isSubmitting &&
    (importMode === "new" || selectedBoardId.length > 0);

  return (
    <div className="space-y-6">
      <div className="dashboard-import-card rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="dashboard-import-dropzone space-y-4 rounded-lg border border-dashed border-gray-200 bg-gray-50/60 p-4">
          <div>
            <p className="text-sm font-semibold text-gray-900">파일 업로드</p>
            <p className="text-xs text-gray-600">
              Padlet에서 내보낸 CSV 또는 ZIP 파일을 선택해주세요.
            </p>
          </div>
          <input
            type="file"
            accept=".csv,.zip"
            onChange={handleFileChange}
            className="dashboard-import-input block w-full min-w-0 text-sm text-gray-700 file:mr-4 file:rounded-md file:border-0 file:bg-gray-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-gray-800"
          />
          {errorMessage ? (
            <p className="dashboard-import-card rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </p>
          ) : null}
        </div>
      </div>

      {(isParsing || isSubmitting || stage === "done") && (
        <div className="dashboard-import-card rounded-lg border border-gray-200 bg-gray-50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">진행 상황</p>
              <p className="text-xs text-gray-600">
                {stage === "parsing" && "CSV 분석 중…"}
                {stage === "creating" && "보드에 카드 작성 중…"}
                {stage === "uploading" && "업로드 중…"}
                {stage === "done" && "완료되었습니다."}
              </p>
            </div>
            <span className="text-xs font-semibold text-gray-600">{uploadProgress}%</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            {STAGE_ORDER.map((item, index) => {
              const isCompleted = stage === "done" || index < stageIndex;
              const isActive = stage === item;
              return (
                <div
                  key={item}
                  className={`rounded-md border px-2 py-1 text-center ${
                    isCompleted
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                      : isActive
                        ? "border-gray-300 bg-white text-gray-700"
                        : "border-gray-200 bg-gray-100 text-gray-400"
                  }`}
                >
                  {item === "uploading" && "업로드"}
                  {item === "parsing" && "파싱"}
                  {item === "creating" && "DB 작성"}
                  {item === "done" && "완료"}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {preview ? (
        <div className="space-y-6">
          <div className="dashboard-import-card rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-gray-900">미리보기 요약</h2>
                <p className="text-xs text-gray-600">
                  섹션 {preview.counts.walls}개 · 카드 {preview.counts.cards}개 · 첨부
                  {" "}
                  {preview.counts.attachments}개
                </p>
              </div>
              <div className="text-xs text-gray-500">
                첨부는 외부 링크로 저장됩니다.
              </div>
            </div>
            {preview.warnings.length > 0 ? (
              <ul className="mt-4 space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                {preview.warnings.map((warning, index) => (
                  <li key={`warning-${index}`}>{warning}</li>
                ))}
              </ul>
            ) : null}
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="dashboard-import-card rounded-md border border-gray-200 p-3">
                <p className="text-sm font-semibold text-gray-900">섹션 목록</p>
                <ul className="mt-2 space-y-1 text-xs text-gray-700">
                  {preview.sections.map((section) => (
                    <li key={section.title} className="dashboard-import-row flex min-w-0 flex-wrap items-center justify-between gap-2 rounded px-2 py-1">
                      <span className="min-w-0 break-words">{section.title}</span>
                      <span className="shrink-0">
                        {section.cards} 카드 · {section.attachments} 첨부
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="dashboard-import-card rounded-md border border-gray-200 p-3">
                <p className="text-sm font-semibold text-gray-900">샘플 카드</p>
                <ul className="mt-2 space-y-2 text-xs text-gray-700">
                  {preview.samples.map((sample, index) => (
                    <li key={`sample-${index}`} className="dashboard-import-row rounded border border-gray-100 bg-gray-50 p-2">
                      <p className="min-w-0 break-words font-semibold text-gray-900">{sample.wallTitle}</p>
                      <p className="mt-1 min-w-0 whitespace-pre-line break-words text-gray-700">
                        {sample.text}
                      </p>
                      <p className="mt-1 min-w-0 break-words text-[11px] text-gray-500">
                        첨부 {sample.attachments}개 · 생성 {new Date(sample.createdAt).toLocaleString("ko-KR")}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="dashboard-import-card rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">저장 옵션</h2>
              <div className="flex flex-wrap gap-6 text-sm text-gray-700">
                <label className="flex items-center gap-2">
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
                <label className="flex items-center gap-2">
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
                  <label className="text-sm font-semibold text-gray-900" htmlFor="padlet-board-title">
                    새 보드 제목
                  </label>
                  <input
                    id="padlet-board-title"
                    type="text"
                    value={boardTitle}
                    onChange={(event) => setBoardTitle(event.target.value)}
                    className="dashboard-import-input w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                    placeholder="새 보드 제목을 입력하세요"
                  />
                  <p className="text-xs text-gray-500">보드 보기 타입은 grid로 생성됩니다.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-900" htmlFor="padlet-board-select">
                    대상 보드
                  </label>
                  <select
                    id="padlet-board-select"
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
              <button
                type="button"
                onClick={handleCommit}
                disabled={!canSubmit}
                className="dashboard-import-control inline-flex items-center justify-center rounded-md bg-gray-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                가져오기 실행
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {commitSummary ? (
        <div className="dashboard-import-card rounded-lg border border-green-200 bg-green-50 p-5 text-sm text-green-900">
          <p className="text-base font-semibold">가져오기가 완료되었습니다.</p>
          <div className="mt-2 space-y-1">
            <p>복원된 섹션: {commitSummary.importedWalls}개</p>
            <p>복원된 카드: {commitSummary.importedCards}개</p>
            <p>외부 링크: {commitSummary.importedAttachments}개</p>
          </div>
          {commitSummary.warnings.length > 0 ? (
            <ul className="mt-3 space-y-1 text-xs text-green-700">
              {commitSummary.warnings.map((warning, index) => (
                <li key={`commit-warning-${index}`} className="min-w-0 break-words">{warning}</li>
              ))}
            </ul>
          ) : null}
          <a
            className="dashboard-import-control mt-4 inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-semibold text-green-700 shadow-sm"
            href={`${boardBoardHref(commitSummary.boardId)}?import=padlet`}
          >
            보드로 이동
          </a>
        </div>
      ) : null}
    </div>
  );
}
