import { apiV1Path } from "@/lib/standards/pathTypes";

import { optimizeImage } from "@/lib/media/optimizeImage";
import { hashFile } from "@/lib/media/hashFile";
import { shouldOptimize } from "@/lib/media/optimizationPolicy";
import { createUploadError } from "@/lib/uploads/uploadErrors";
import { getFileExtension, normalizeUploadContentType } from "@/lib/uploads/contentType";

export type UploadStep = "optimizing" | "preparing" | "uploading" | "finalizing";

type UploadFileOptions = {
  initiateUrl?: string;
  finalizeUrl?: (fileId: string) => string;
  deleteUrl?: (fileId: string) => string;
  initiateBodyExtras?: Record<string, unknown>;
  finalizeBody?: Record<string, unknown>;
  deleteBody?: Record<string, unknown>;
  onStepChange?: (step: UploadStep) => void;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
};

async function cleanupUploadFileRecord(fileId: string, options: UploadFileOptions) {
  if (!options.deleteUrl) return;
  const cleanupInit: RequestInit = { method: "POST" };
  if (options.deleteBody) {
    cleanupInit.headers = { "Content-Type": "application/json" };
    cleanupInit.body = JSON.stringify(options.deleteBody);
  }
  try {
    await fetch(options.deleteUrl(fileId), cleanupInit);
  } catch (error) {
    console.warn("[upload.client] cleanup_failed", {
      fileId,
      message: error instanceof Error ? error.message : "cleanup_failed",
    });
  }
}

export async function uploadFileToCard(
  cardId: string,
  file: File,
  options: UploadFileOptions = {},
): Promise<
  | {
      ok: true;
      fileId: string;
      savedBytes: number;
      deduped: boolean;
      optimized: boolean;
      optimizationWarning?: string;
      originalBytes: number;
      storedBytes: number;
    }
  | { ok: false; error: string; errorDiagnostics?: import("@/lib/uploads/uploadErrors").UploadErrorDiagnostics }
> {
  const originalBytes = file.size;
  const contentType = normalizeUploadContentType({ contentType: file.type, filename: file.name });
  const initiateUrl = options.initiateUrl ?? apiV1Path(`cards/${cardId}/files/initiate`);
  const finalizeUrl = options.finalizeUrl ?? ((fileId: string) => apiV1Path(`files/${fileId}/finalize`));

  let workingFile = file;
  let storedBytes = file.size;
  let width: number | null = null;
  let height: number | null = null;
  let optimized = false;
  let optimizationWarning: string | undefined;
  let optimizationFormat: string | null = null;

  if (shouldOptimize(file.type)) {
    options.onStepChange?.("optimizing");
    const optimizedResult = await optimizeImage(file);
    workingFile = optimizedResult.optimizedFile;
    storedBytes = optimizedResult.storedBytes;
    width = optimizedResult.width || null;
    height = optimizedResult.height || null;
    optimized = optimizedResult.optimized;
    optimizationFormat = optimizedResult.format ?? null;
    const warning = optimizedResult.warnings.find((entry) => entry.includes("원본 파일"));
    if (warning) {
      optimizationWarning = warning;
    }
  }

  options.onStepChange?.("preparing");
  const hashResult = await hashFile(workingFile);

  console.info("[upload.client] stage", { stage: "initiate", filename: file.name, extension: getFileExtension(file.name), normalizedContentType: contentType, sizeBytes: storedBytes });
  const initiateResponse = await fetch(initiateUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: options.signal,
    body: JSON.stringify({
      filename: file.name,
      contentType,
      sizeBytes: storedBytes,
      originalBytes,
      storedBytes,
      optimized,
      width,
      height,
      sha256Hex: hashResult.sha256Hex,
      contentSha256: hashResult.sha256Hex,
      originalSizeBytes: originalBytes,
      optimizedSizeBytes: storedBytes,
      optimizationFormat,
      ...(options.initiateBodyExtras ?? {}),
    }),
  });

  if (!initiateResponse.ok) {
    const payload = await initiateResponse.json().catch(() => null);
    const rawMessage =
      (payload as { error?: { message?: string } } | null)?.error?.message ??
      (payload as { error?: string } | null)?.error ??
      "upload_initiate_failed";
    const errorCode = (payload as { error?: { code?: string } } | null)?.error?.code;
    const requestId = (payload as { requestId?: string } | null)?.requestId;
    const uploadError = createUploadError(rawMessage, {
      status: initiateResponse.status,
      code: errorCode,
      message: rawMessage,
      requestId,
    });
    return { ok: false, error: uploadError.message, errorDiagnostics: uploadError.uploadDiagnostics };
  }

  const payload = (await initiateResponse.json()) as
    | { fileId?: string; uploadUrl?: string; deduped?: boolean }
    | { error?: string };

  const uploadUrl = "uploadUrl" in payload ? payload.uploadUrl : undefined;
  const fileId = "fileId" in payload ? payload.fileId : undefined;
  const deduped = "deduped" in payload ? Boolean(payload.deduped) : false;

  if (!fileId) {
    return { ok: false, error: "잘못된 업로드 정보입니다." };
  }

  const optimizedSavedBytes = Math.max(0, originalBytes - storedBytes);
  const dedupedSavedBytes = deduped ? storedBytes : 0;
  const savedBytes = optimizedSavedBytes + dedupedSavedBytes;

  if (deduped) {
    console.info("[upload.client] stage", { stage: "deduped", fileId, filename: file.name, extension: getFileExtension(file.name), normalizedContentType: contentType, sizeBytes: storedBytes });
    return {
      ok: true,
      fileId,
      savedBytes,
      deduped: true,
      optimized,
      optimizationWarning,
      originalBytes,
      storedBytes,
    };
  }

  if (!uploadUrl) {
    const uploadError = createUploadError("upload_url_missing", {
      message: "upload_url_missing",
    });
    await cleanupUploadFileRecord(fileId, options);
    return { ok: false, error: uploadError.message, errorDiagnostics: uploadError.uploadDiagnostics };
  }

  options.onStepChange?.("uploading");
  console.info("[upload.client] stage", { stage: "put_upload", fileId, filename: file.name, extension: getFileExtension(file.name), normalizedContentType: contentType, sizeBytes: storedBytes, hasUploadUrl: Boolean(uploadUrl) });
  try {
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", contentType);

      const handleAbort = () => {
        xhr.abort();
        const abortError = new Error("업로드가 취소되었습니다.");
        abortError.name = "AbortError";
        reject(abortError);
      };

      if (options.signal) {
        if (options.signal.aborted) {
          handleAbort();
          return;
        }
        options.signal.addEventListener("abort", handleAbort, { once: true });
      }

      xhr.upload.addEventListener("progress", (event) => {
        if (!event.lengthComputable) {
          return;
        }
        const percent = Math.round((event.loaded / event.total) * 100);
        options.onProgress?.(percent);
      });
      xhr.addEventListener("load", () => {
        options.signal?.removeEventListener("abort", handleAbort);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
          return;
        }
        reject(new Error("파일 업로드에 실패했습니다."));
      });
      xhr.addEventListener("error", () => {
        options.signal?.removeEventListener("abort", handleAbort);
        reject(new Error("파일 업로드 중 네트워크 오류가 발생했습니다."));
      });
      xhr.send(workingFile);
    });
  } catch (error) {
    const uploadError = createUploadError(error);
    await cleanupUploadFileRecord(fileId, options);
    return { ok: false, error: uploadError.message, errorDiagnostics: uploadError.uploadDiagnostics };
  }

  options.onStepChange?.("finalizing");
  const finalizeInit: RequestInit = { method: "POST" };
  if (options.finalizeBody) {
    finalizeInit.headers = { "Content-Type": "application/json" };
    finalizeInit.body = JSON.stringify(options.finalizeBody);
  }

  console.info("[upload.client] stage", { stage: "finalize", fileId, filename: file.name, extension: getFileExtension(file.name), normalizedContentType: contentType, sizeBytes: storedBytes });
  const finalizeResponse = await fetch(finalizeUrl(fileId), { ...finalizeInit, signal: options.signal });

  if (!finalizeResponse.ok) {
    const finalizePayload = await finalizeResponse.json().catch(() => null);
    const rawMessage =
      (finalizePayload as { error?: { message?: string } } | null)?.error?.message ??
      (finalizePayload as { error?: string } | null)?.error ??
      "upload_finalize_failed";
    const errorCode = (finalizePayload as { error?: { code?: string } } | null)?.error?.code;
    const requestId = (finalizePayload as { requestId?: string } | null)?.requestId;
    const uploadError = createUploadError(rawMessage, {
      status: finalizeResponse.status,
      code: errorCode,
      message: rawMessage,
      requestId,
    });
    await cleanupUploadFileRecord(fileId, options);
    return { ok: false, error: uploadError.message, errorDiagnostics: uploadError.uploadDiagnostics };
  }

  return {
    ok: true,
    fileId,
    savedBytes,
    deduped: false,
    optimized,
    optimizationWarning,
    originalBytes,
    storedBytes,
  };
}
