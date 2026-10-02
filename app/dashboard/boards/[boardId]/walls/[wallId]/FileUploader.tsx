"use client";

import { ChangeEvent, ClipboardEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { uploadFileToCard, type UploadStep } from "./uploadClient";

type Props = {
  cardId: string;
  disabled?: boolean;
  inputId?: string;
  buttonLabel?: string;
  helperText?: string;
};

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"] as const;
  let size = bytes;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(size >= 10 ? 1 : 2)} ${units[index]}`;
}

export function FileUploader({
  cardId,
  disabled = false,
  inputId,
  buttonLabel = "파일 첨부",
  helperText = "붙여넣기(Paste)로도 업로드할 수 있어요",
}: Props) {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [uploadStep, setUploadStep] = useState<UploadStep | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [lastResult, setLastResult] = useState<{
    savedBytes: number;
    deduped: boolean;
    optimized: boolean;
    optimizationWarning?: string;
    originalBytes: number;
    storedBytes: number;
  } | null>(null);
  const resolvedInputId = inputId ?? `file-uploader-${cardId}`;

  useEffect(() => {
    if (!statusMessage || isUploading) {
      return;
    }
    const timer = window.setTimeout(() => {
      setStatusMessage(null);
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [isUploading, statusMessage]);

  const uploadFile = async (file: File) => {
    if (disabled) return;

    setError(null);
    setIsUploading(true);
    setStatusMessage(null);
    setUploadStep("preparing");
    setProgress(null);
    setLastFile(file);
    setLastResult(null);

    const result = await uploadFileToCard(cardId, file, {
      onStepChange: (step) => {
        setUploadStep(step);
        if (step !== "uploading") {
          setProgress(null);
        }
      },
      onProgress: (percent) => setProgress(percent),
    });

    if (!result.ok) {
      setError(result.error);
      setStatusMessage(null);
      setIsUploading(false);
      setUploadStep(null);
      return;
    }

    const savedLabel = formatFileSize(result.savedBytes);
    setStatusMessage(
      result.deduped
        ? `중복 파일이라 업로드를 생략했어요 (${savedLabel} 절약)`
        : result.savedBytes > 0
          ? `이미지 최적화로 ${savedLabel} 절약`
          : "업로드가 완료되었습니다.",
    );
    setLastResult({
      savedBytes: result.savedBytes,
      deduped: result.deduped,
      optimized: result.optimized,
      optimizationWarning: result.optimizationWarning,
      originalBytes: result.originalBytes,
      storedBytes: result.storedBytes,
    });
    setIsUploading(false);
    setUploadStep(null);
    setProgress(null);
    router.refresh();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    await uploadFile(file);
    event.target.value = "";
  };

  const handlePaste = async (event: ClipboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const clipboardFiles = Array.from(event.clipboardData?.files ?? []);
    const file = clipboardFiles[0];

    if (!file) {
      return;
    }

    event.preventDefault();
    await uploadFile(file);
  };

  const statusLabel = useMemo(() => {
    if (!isUploading) {
      return statusMessage;
    }
    if (uploadStep === "optimizing") {
      return "이미지 최적화 중...";
    }
    if (uploadStep === "preparing") {
      return "업로드 준비 중...";
    }
    if (uploadStep === "finalizing") {
      return "업로드 마무리 중...";
    }
    if (uploadStep === "uploading") {
      return progress !== null ? `업로드 중 ${progress}%` : "업로드 중...";
    }
    return null;
  }, [isUploading, progress, statusMessage, uploadStep]);

  return (
    <div className="space-y-2" onPaste={handlePaste}>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={resolvedInputId}
          type="file"
          className="sr-only"
          onChange={handleFileChange}
          disabled={isUploading || disabled}
        />
        <label
          htmlFor={resolvedInputId}
          className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10 ${
            disabled || isUploading
              ? "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400"
              : "border-gray-300 text-gray-700 hover:border-gray-400"
          }`}
          aria-disabled={disabled || isUploading}
        >
          {isUploading ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
              업로드 중...
            </span>
          ) : (
            buttonLabel
          )}
        </label>
        {!disabled ? <span className="text-xs font-normal text-gray-500">{helperText}</span> : null}
      </div>
      {uploadStep === "uploading" && progress !== null ? (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-indigo-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      ) : null}
      {lastResult ? (
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-gray-700">
          {lastResult.deduped ? (
            <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">중복 파일: 업로드 없이 연결됨</span>
          ) : null}
          {lastResult.savedBytes > 0 && !lastResult.deduped ? (
            <span className="rounded-full bg-indigo-50 px-2 py-1 text-indigo-700">
              -{Math.min(99, Math.round((lastResult.savedBytes / Math.max(1, lastResult.originalBytes)) * 100))}% 절감
            </span>
          ) : null}
          {lastResult.optimizationWarning ? (
            <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">원본 업로드(최적화 실패)</span>
          ) : null}
        </div>
      ) : null}
      {statusLabel ? <p className="text-xs text-gray-600">{statusLabel}</p> : null}
      {error ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-red-600">
          <span>업로드에 실패했어요. {error}</span>
          {lastFile ? (
            <button
              type="button"
              onClick={() => uploadFile(lastFile)}
              className="text-xs font-semibold text-red-600 underline-offset-2 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200"
            >
              재시도
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
