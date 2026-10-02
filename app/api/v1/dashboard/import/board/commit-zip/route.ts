import { NextResponse } from "next/server";

import { requireUserApi } from "@/lib/auth/requireUserApi";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { headObject, presignPutUrl } from "@/lib/r2/client";
import { importBoardData, parseBoardPayload } from "@/lib/board/importer";
import { getPositiveEnvNumber, boardImportDefaults } from "@/lib/board/limits";
import { extractBoardZip } from "@/lib/board/zip";
import { readEnvString } from "@/lib/server/runtimeEnv";
import type { ExternalAttachment } from "@/lib/types/attachments";

type MatchedFile = {
  cardId: string;
  fileId: string;
  filename: string;
  sizeBytes: number;
  contentType: string;
  data: Uint8Array;
};

type MissingFile = {
  fileId: string;
  filename: string;
};

type ExternalDownloadTask = {
  cardId: string;
  attachmentIndex: number;
  attachment: ExternalAttachment;
  url: string;
  filename: string;
  contentType: string;
};

const ALLOWED_EXTENSIONS = new Map<string, string>([
  ["pdf", "application/pdf"],
  ["png", "image/png"],
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["webp", "image/webp"],
  ["txt", "text/plain"],
  ["pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  ["docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
]);

function buildErrorResponse(status: number, code: string, userMessage: string) {
  return NextResponse.json({ code, userMessage, error: userMessage }, { status });
}

function sanitizeFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop()?.trim() ?? "";
  const cleaned = base.replace(/[^A-Za-z0-9._-]+/g, "_");
  const fallback = cleaned || "file";

  return fallback.length > 200 ? fallback.slice(0, 200) : fallback;
}

function getFileExtension(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? "";
  const parts = base.split(".");
  if (parts.length < 2) {
    return "";
  }
  return parts[parts.length - 1]?.toLowerCase() ?? "";
}

function getAllowedContentType(filename: string): string | null {
  const ext = getFileExtension(filename);
  return ALLOWED_EXTENSIONS.get(ext) ?? null;
}

function requirePositiveEnvNumber(name: string): number {
  const value = readEnvString(name);

  if (!value) {
    throw new Error(`Missing env var: ${name}`);
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
}

async function getCurrentStorageBytes(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  ownerId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("files")
    .select("size_bytes")
    .eq("owner_id", ownerId)
    .eq("status", "ready");

  if (error) {
    throw new Error(error.message);
  }

  const rows = data as { size_bytes: number }[] | null;
  return (rows ?? []).reduce((sum, row) => sum + Number(row.size_bytes ?? 0), 0);
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;

  const runners = new Array(Math.min(limit, items.length)).fill(null).map(async () => {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await worker(items[current]!);
    }
  });

  await Promise.all(runners);
  return results;
}

async function uploadFileToR2(input: {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  ownerId: string;
  cardId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  data: ArrayBuffer;
}) {
  const safeFilename = sanitizeFilename(input.filename);
  const r2Key = `u/${input.ownerId}/c/${input.cardId}/${crypto.randomUUID()}-${safeFilename}`;

  const { data: fileRow, error: insertError } = await input.supabase
    .from("files")
    .insert({
      card_id: input.cardId,
      owner_id: input.ownerId,
      r2_key: r2Key,
      filename: safeFilename,
      content_type: input.contentType,
      size_bytes: input.sizeBytes,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertError) {
    throw new Error(insertError.message);
  }

  const uploadUrl = await presignPutUrl({
    key: r2Key,
    contentType: input.contentType,
    expiresSeconds: 900,
  });

  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": input.contentType,
    },
    body: input.data,
  });

  if (!uploadResponse.ok) {
    throw new Error(`파일 업로드에 실패했습니다: ${input.filename}`);
  }

  const objectHead = await headObject(r2Key);
  if (!objectHead.exists) {
    throw new Error(`업로드된 파일을 확인하지 못했습니다: ${input.filename}`);
  }

  if (
    objectHead.contentLength !== undefined &&
    objectHead.contentLength !== input.sizeBytes
  ) {
    throw new Error(`업로드된 파일 크기가 일치하지 않습니다: ${input.filename}`);
  }

  const { error: updateError } = await input.supabase
    .from("files")
    .update({ status: "ready" })
    .eq("id", fileRow?.id)
    .eq("status", "pending");

  if (updateError) {
    throw new Error(updateError.message);
  }
}

function resolveExternalUrl(attachment: ExternalAttachment): string | null {
  if (attachment.url && attachment.url.startsWith("http")) {
    return attachment.url;
  }
  if (attachment.downloadPath && attachment.downloadPath.startsWith("http")) {
    return attachment.downloadPath;
  }
  return null;
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request: Request) {
  let userId = "";
  try {
    const { user } = await requireUserApi();
    userId = user.id;
  } catch {
    return buildErrorResponse(401, "unauthorized", "로그인이 필요합니다.");
  }

  const formData = await request.formData();
  const file = formData.get("zip");
  const mode = formData.get("mode");
  const targetBoardId = formData.get("targetBoardId");
  const title = formData.get("title");
  const downloadExternal = formData.get("downloadExternal") === "true";

  if (!(file instanceof File)) {
    return buildErrorResponse(400, "zip_missing", "ZIP 파일이 필요합니다.");
  }

  if (mode !== "new" && mode !== "existing") {
    return buildErrorResponse(400, "mode_invalid", "가져오기 모드가 올바르지 않습니다.");
  }

  if (mode === "existing" && (typeof targetBoardId !== "string" || !targetBoardId)) {
    return buildErrorResponse(400, "board_missing", "보드를 선택해주세요.");
  }

  const maxZipBytes = getPositiveEnvNumber(
    "BOARD_IMPORT_ZIP_MAX_BYTES",
    boardImportDefaults.zipMaxBytes,
  );
  const maxFiles = getPositiveEnvNumber(
    "BOARD_IMPORT_MAX_FILES",
    boardImportDefaults.maxFiles,
  );
  const maxTotalBytes = getPositiveEnvNumber(
    "BOARD_IMPORT_TOTAL_MAX_BYTES",
    boardImportDefaults.totalMaxBytes,
  );
  const maxFileBytes = getPositiveEnvNumber(
    "BOARD_IMPORT_FILE_MAX_BYTES",
    boardImportDefaults.fileMaxBytes,
  );

  if (file.size > maxZipBytes) {
    return buildErrorResponse(413, "zip_too_large", "ZIP 파일 용량이 제한을 초과했습니다.");
  }

  let extract;
  try {
    const buffer = await file.arrayBuffer();
    extract = await extractBoardZip(buffer, {
      maxEntries: maxFiles,
      maxTotalBytes,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ZIP을 처리할 수 없습니다.";
    return buildErrorResponse(400, "zip_parse_failed", message);
  }

  let normalized;
  try {
    normalized = parseBoardPayload(extract.boardJson).payload;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "board.json 검증에 실패했습니다.";
    return buildErrorResponse(400, "board_invalid", message);
  }

  const supabase = createSupabaseAdminClient();
  let importResult;
  try {
    importResult = await importBoardData({
      supabase,
      ownerId: userId,
      mode,
      boardId: typeof targetBoardId === "string" ? targetBoardId : undefined,
      boardTitle: typeof title === "string" ? title : undefined,
      payload: normalized,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "가져오기에 실패했습니다.";
    return buildErrorResponse(400, "import_failed", message);
  }

  const matchedFiles: MatchedFile[] = [];
  const missingFiles: MissingFile[] = [];

  for (const card of importResult.cardFileRefs) {
    for (const fileRef of card.internalFiles) {
      const entry = extract.filesById.get(fileRef.fileId);
      if (!entry) {
        missingFiles.push({ fileId: fileRef.fileId, filename: fileRef.originalFilename });
        continue;
      }

      const filename = fileRef.originalFilename || entry.filename;
      const contentType = getAllowedContentType(filename);
      if (!contentType) {
        return buildErrorResponse(
          400,
          "file_type_not_allowed",
          `허용되지 않는 파일 형식입니다: ${filename}`,
        );
      }

      const sizeBytes = entry.data.length;
      if (sizeBytes > maxFileBytes) {
        return buildErrorResponse(
          413,
          "file_too_large",
          `파일 크기가 제한을 초과했습니다: ${filename}`,
        );
      }

      matchedFiles.push({
        cardId: card.cardId,
        fileId: fileRef.fileId,
        filename,
        sizeBytes,
        contentType,
        data: entry.data,
      });
    }
  }

  const totalUploadBytes = matchedFiles.reduce((sum, fileItem) => sum + fileItem.sizeBytes, 0);

  if (totalUploadBytes > maxTotalBytes) {
    return buildErrorResponse(413, "zip_total_too_large", "업로드 총 용량이 제한을 초과했습니다.");
  }

  let singleMaxBytes = 0;
  let tenantMaxBytes = 0;
  try {
    singleMaxBytes = requirePositiveEnvNumber("STORAGE_MAX_BYTES");
    tenantMaxBytes = requirePositiveEnvNumber("STORAGE_MAX_BYTES_PER_TENANT");
  } catch (error) {
    const message = error instanceof Error ? error.message : "스토리지 설정을 확인해주세요.";
    return buildErrorResponse(500, "storage_config_missing", message);
  }

  if (matchedFiles.some((fileItem) => fileItem.sizeBytes > singleMaxBytes)) {
    return buildErrorResponse(413, "file_too_large", "파일 크기가 허용 한도를 초과했습니다.");
  }

  let currentTotal = 0;
  try {
    currentTotal = await getCurrentStorageBytes(supabase, userId);
    if (currentTotal + totalUploadBytes > tenantMaxBytes) {
      return buildErrorResponse(413, "storage_limit_exceeded", "총 저장 용량 한도를 초과했습니다.");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "용량 확인에 실패했습니다.";
    return buildErrorResponse(500, "storage_check_failed", message);
  }

  let importedFiles = 0;
  for (const matched of matchedFiles) {
    try {
      await uploadFileToR2({
        supabase,
        ownerId: userId,
        cardId: matched.cardId,
        filename: matched.filename,
        contentType: matched.contentType,
        sizeBytes: matched.sizeBytes,
        data: new Uint8Array(matched.data).buffer,
      });
      importedFiles += 1;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "파일 업로드에 실패했습니다.";
      return buildErrorResponse(502, "r2_upload_failed", message);
    }
  }

  const externalConvertedByCard = new Map<string, Set<number>>();
  let externalConverted = 0;
  let externalKept = 0;

  if (downloadExternal) {
    const timeoutMs = getPositiveEnvNumber(
      "BOARD_IMPORT_EXTERNAL_TIMEOUT_MS",
      boardImportDefaults.externalDownloadTimeoutMs,
    );
    const concurrency = getPositiveEnvNumber(
      "BOARD_IMPORT_EXTERNAL_CONCURRENCY",
      boardImportDefaults.externalDownloadConcurrency,
    );
    const maxTotalMs = getPositiveEnvNumber(
      "BOARD_IMPORT_EXTERNAL_TOTAL_TIMEOUT_MS",
      boardImportDefaults.externalDownloadTimeoutMs * 4,
    );
    const startedAt = Date.now();

    const tasks: ExternalDownloadTask[] = [];
    for (const card of importResult.cardFileRefs) {
      card.externalAttachments.forEach((attachment, index) => {
        const url = resolveExternalUrl(attachment);
        const filename = attachment.filename || attachment.caption || attachment.alt || url || "";
        const contentType = getAllowedContentType(filename);
        if (!url || !contentType) {
          return;
        }
        tasks.push({
          cardId: card.cardId,
          attachmentIndex: index,
          attachment,
          url,
          filename,
          contentType,
        });
      });
    }

    await runWithConcurrency(tasks, concurrency, async (task) => {
      if (Date.now() - startedAt > maxTotalMs) {
        return;
      }

      let response: Response;
      try {
        response = await fetchWithTimeout(task.url, timeoutMs);
      } catch {
        return;
      }

      if (!response.ok) {
        return;
      }

      const contentLength = response.headers.get("content-length");
      const parsedLength = contentLength ? Number.parseInt(contentLength, 10) : NaN;
      if (Number.isFinite(parsedLength) && parsedLength > maxFileBytes) {
        return;
      }

      const headerType = response.headers.get("content-type")?.split(";")[0]?.trim();
      if (
        headerType &&
        headerType !== task.contentType &&
        headerType !== "application/octet-stream"
      ) {
        return;
      }

      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > maxFileBytes) {
        return;
      }

      if (buffer.byteLength > singleMaxBytes) {
        return;
      }

      const projectedTotal = currentTotal + totalUploadBytes + buffer.byteLength;
      if (projectedTotal > tenantMaxBytes) {
        return;
      }

      try {
        await uploadFileToR2({
          supabase,
          ownerId: userId,
          cardId: task.cardId,
          filename: task.filename,
          contentType: task.contentType,
          sizeBytes: buffer.byteLength,
          data: buffer,
        });
      } catch {
        return;
      }

      currentTotal += buffer.byteLength;
      externalConverted += 1;
      const set = externalConvertedByCard.get(task.cardId) ?? new Set<number>();
      set.add(task.attachmentIndex);
      externalConvertedByCard.set(task.cardId, set);
    });
  }

  for (const card of importResult.cardFileRefs) {
    const converted = externalConvertedByCard.get(card.cardId);
    if (!converted || converted.size === 0) {
      externalKept += card.externalAttachments.length;
      continue;
    }
    const remaining = card.externalAttachments.filter((_, index) => !converted.has(index));
    externalKept += remaining.length;
    const { error } = await supabase
      .from("cards")
      .update({
        external_attachments: remaining.length > 0 ? remaining : null,
      })
      .eq("id", card.cardId);

    if (error) {
      return buildErrorResponse(400, "db_update_failed", error.message);
    }
  }

  return NextResponse.json({
    boardId: importResult.boardId,
    importedWalls: importResult.importedWalls,
    importedCards: importResult.importedCards,
    importedFiles,
    missingFiles,
    externalAttachmentsKept: externalKept,
    externalAttachmentsConverted: externalConverted,
  });
}
