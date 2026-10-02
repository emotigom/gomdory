"use client";

import { ChangeEvent, ClipboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

import { uploadFileToCard, type UploadStep } from "../walls/[wallId]/uploadClient";
import { createCardAction, type CreateCardState } from "./actions";

const initialState: CreateCardState = { success: false };

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

function SubmitButton({ disabled, isUploading }: { disabled: boolean; isUploading: boolean }) {
  const { pending } = useFormStatus();
  const isBusy = pending || isUploading;

  return (
    <button
      type="submit"
      disabled={isBusy || disabled}
      className="h-9 rounded-md bg-black px-4 text-sm font-semibold text-white transition hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/20 disabled:cursor-not-allowed disabled:bg-gray-400"
    >
      {pending ? "작성 중..." : isUploading ? "업로드 중..." : "카드 추가"}
    </button>
  );
}

function FormStatusWatcher({ onPendingChange }: { onPendingChange: (pending: boolean) => void }) {
  const { pending } = useFormStatus();

  useEffect(() => {
    onPendingChange(pending);
  }, [onPendingChange, pending]);

  return null;
}

export function CardForm({
  boardId,
  wallId,
  disabled,
  disabledReason,
}: {
  boardId: string;
  wallId: string;
  disabled: boolean;
  disabledReason?: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const processedCardIdRef = useRef<string | null>(null);
  const successTimerRef = useRef<number | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadStep, setUploadStep] = useState<UploadStep | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadQueue, setUploadQueue] = useState<File[]>([]);
  const [currentUploadIndex, setCurrentUploadIndex] = useState(0);
  const [currentUploadName, setCurrentUploadName] = useState<string | null>(null);
  const [state, formAction] = useFormState(createCardAction, initialState);

  const errorMessage = useMemo(
    () => (state.error ? `카드 작성에 실패했어요. ${state.error}` : ""),
    [state.error],
  );

  const showUploadMessage = useCallback((message: string) => {
    setUploadMessage(message);
    if (successTimerRef.current) {
      window.clearTimeout(successTimerRef.current);
    }
    successTimerRef.current = window.setTimeout(() => {
      setUploadMessage(null);
    }, 2000);
  }, []);

  useEffect(() => {
    return () => {
      if (successTimerRef.current) {
        window.clearTimeout(successTimerRef.current);
      }
    };
  }, []);

  const handlePendingChange = useCallback((pending: boolean) => {
    setIsSubmitting(pending);
  }, []);

  const startUploadQueue = useCallback(
    async (filesToUpload: File[], cardId: string) => {
      if (filesToUpload.length === 0) {
        formRef.current?.reset();
        showUploadMessage("카드를 추가했습니다.");
        router.refresh();
        return;
      }

      setUploading(true);
      setUploadMessage("카드와 첨부를 업로드하는 중...");
      setUploadError(null);
      setUploadProgress(null);
      setUploadStep("preparing");
      setUploadQueue(filesToUpload);

      let totalSavedBytes = 0;
      for (let index = 0; index < filesToUpload.length; index += 1) {
        const file = filesToUpload[index];
        setCurrentUploadIndex(index + 1);
        setCurrentUploadName(file.name);
        setUploadProgress(null);
        setUploadStep("preparing");

        const result = await uploadFileToCard(cardId, file, {
          onStepChange: (step) => {
            setUploadStep(step);
            if (step !== "uploading") {
              setUploadProgress(null);
            }
          },
          onProgress: (percent) => setUploadProgress(percent),
        });

        if (!result.ok) {
          setUploadError(result.error);
          setUploadMessage(null);
          setUploadQueue(filesToUpload.slice(index));
          setUploading(false);
          setUploadStep(null);
          return;
        }
        totalSavedBytes += result.savedBytes;
      }

      setAttachments([]);
      setUploadQueue([]);
      setCurrentUploadIndex(0);
      setCurrentUploadName(null);
      setUploadProgress(null);
      setUploadStep(null);
      formRef.current?.reset();
      if (totalSavedBytes > 0) {
        showUploadMessage(`이번 업로드 절감 ${formatFileSize(totalSavedBytes)}`);
      } else {
        showUploadMessage("카드와 첨부 업로드가 완료되었습니다.");
      }
      setUploading(false);
      router.refresh();
    },
    [router, showUploadMessage],
  );

  useEffect(() => {
    if (!state.success || !state.cardId) {
      return;
    }

    if (processedCardIdRef.current === state.cardId) {
      return;
    }

    processedCardIdRef.current = state.cardId;
    const filesToUpload = [...attachments];
    void startUploadQueue(filesToUpload, state.cardId);
  }, [attachments, startUploadQueue, state.cardId, state.success]);

  const handleAttachmentChange = (files: FileList | File[]) => {
    if (disabled) return;
    const nextFiles = Array.from(files);

    if (!nextFiles.length) {
      return;
    }

    setUploadError(null);
    setUploadMessage(null);
    setAttachments((prev) => [...prev, ...nextFiles]);
  };

  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      handleAttachmentChange(event.target.files);
      event.target.value = "";
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLFormElement>) => {
    if (disabled) return;
    const files = event.clipboardData?.files;

    if (files && files.length > 0) {
      event.preventDefault();
      handleAttachmentChange(files);
      showUploadMessage("붙여넣은 파일을 첨부 목록에 추가했어요.");
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const hasInputDisabled = disabled || uploading || isSubmitting;
  const uploadStepLabel = useMemo(() => {
    if (!uploading || !uploadStep) {
      return null;
    }
    if (uploadStep === "optimizing") {
      return "이미지 최적화 중";
    }
    if (uploadStep === "preparing") {
      return "업로드 준비 중";
    }
    if (uploadStep === "finalizing") {
      return "업로드 마무리 중";
    }
    if (uploadStep === "uploading") {
      return uploadProgress !== null ? `업로드 중 ${uploadProgress}%` : "업로드 중";
    }
    return null;
  }, [uploadProgress, uploadStep, uploading]);

  return (
    <form
      ref={formRef}
      action={formAction}
      id="card-form"
      className="space-y-3 rounded-lg border border-gray-200 p-4 shadow-sm"
      onPaste={handlePaste}
    >
      <FormStatusWatcher onPendingChange={handlePendingChange} />
      <input type="hidden" name="boardId" value={boardId} />
      <input type="hidden" name="wallId" value={wallId} />
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-900" htmlFor="text">
          카드 내용
        </label>
        <textarea
          id="text"
          name="text"
          required
          rows={3}
          disabled={hasInputDisabled}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
              event.preventDefault();
              formRef.current?.requestSubmit();
            }
          }}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus-visible:border-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10 disabled:cursor-not-allowed disabled:bg-gray-100"
          placeholder="오늘의 생각을 남겨주세요"
        />
      </div>

      <div className="space-y-2 rounded-md border border-dashed border-gray-200 bg-gray-50 p-3">
        <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-gray-800">
          <label
            className={`inline-flex cursor-pointer items-center gap-2 ${
              hasInputDisabled ? "cursor-not-allowed text-gray-400" : "text-gray-800"
            }`}
          >
            <input
              type="file"
              multiple
              className="hidden"
              onChange={handleFileInputChange}
              disabled={hasInputDisabled}
            />
            <span
              className={`rounded-md border px-3 py-1.5 transition ${
                hasInputDisabled
                  ? "border-gray-200 bg-white"
                  : "border-gray-300 hover:border-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900/10"
              }`}
            >
              파일 선택
            </span>
            <span className="text-xs font-normal text-gray-500">
              파일 선택 또는 붙여넣기(Paste)로 첨부를 추가하세요
            </span>
          </label>
        </div>
        {attachments.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
              <span>대기 중인 첨부 {attachments.length}개</span>
              <button
                type="button"
                onClick={() => setAttachments([])}
                className="text-[11px] font-medium text-gray-500 underline-offset-2 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
                aria-label="첨부 모두 제거"
              >
                모두 제거
              </button>
            </div>
            <ul className="space-y-1 text-xs text-gray-700">
              {attachments.map((file, index) => (
                <li
                  key={`${file.name}-${file.size}-${index}`}
                  className="flex items-center justify-between rounded border border-gray-200 bg-white px-3 py-2"
                >
                  <div className="space-y-0.5">
                    <p className="font-medium text-gray-900">{file.name}</p>
                    <p className="text-[11px] text-gray-500">{formatFileSize(file.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAttachment(index)}
                    className="text-[11px] font-semibold text-gray-500 hover:text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
                    aria-label={`${file.name} 제거`}
                  >
                    제거
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : !disabled ? (
          <p className="text-xs text-gray-500">첨부가 없다면 바로 작성만 진행해도 됩니다.</p>
        ) : null}
      </div>

      {disabled && disabledReason ? (
        <p className="text-sm text-gray-600">{disabledReason}</p>
      ) : null}
      {uploading ? (
        <div className="space-y-2 rounded-md border border-gray-200 bg-white p-3 text-xs text-gray-600">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-gray-800">
              첨부 업로드 중 {currentUploadIndex}/{uploadQueue.length || attachments.length}
            </span>
            {currentUploadName ? <span className="text-gray-500">{currentUploadName}</span> : null}
          </div>
          {uploadStepLabel ? <p>{uploadStepLabel}</p> : null}
          {uploadStep === "uploading" && uploadProgress !== null ? (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          ) : null}
        </div>
      ) : null}
      {uploadMessage ? <p className="text-sm text-gray-700">{uploadMessage}</p> : null}
      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
      {uploadError ? (
        <div className="space-y-1 text-sm text-red-600">
          <p>첨부 업로드에 실패했어요. {uploadError}</p>
          {uploadQueue.length > 0 && state.cardId ? (
            <button
              type="button"
              onClick={() => startUploadQueue(uploadQueue, state.cardId!)}
              className="text-xs font-semibold text-red-600 underline-offset-2 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200"
            >
              마지막 파일부터 재시도
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="flex justify-end">
        <SubmitButton disabled={hasInputDisabled} isUploading={uploading} />
      </div>
    </form>
  );
}
