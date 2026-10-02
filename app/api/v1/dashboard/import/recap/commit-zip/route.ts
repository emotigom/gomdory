import { NextResponse } from "next/server";

import { requireUserApi } from "@/lib/auth/requireUserApi";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { headObject, presignPutUrl } from "@/lib/r2/client";
import { importRecapData, parseRecapPayload } from "@/lib/recap/importer";
import { getPositiveEnvNumber, recapImportDefaults } from "@/lib/recap/limits";
import { extractRecapZip } from "@/lib/recap/zip";
import { readEnvString } from "@/lib/server/runtimeEnv";

type MatchedFile = {
  cardId: string;
  fileId: string;
  filename: string;
  sizeBytes: number;
  contentType: string;
  data: Uint8Array;
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
    "RECAP_IMPORT_ZIP_MAX_BYTES",
    recapImportDefaults.zipMaxBytes,
  );
  const maxFiles = getPositiveEnvNumber(
    "RECAP_IMPORT_MAX_FILES",
    recapImportDefaults.maxFiles,
  );
  const maxTotalBytes = getPositiveEnvNumber(
    "RECAP_IMPORT_TOTAL_MAX_BYTES",
    recapImportDefaults.totalMaxBytes,
  );
  const maxFileBytes = getPositiveEnvNumber(
    "RECAP_IMPORT_FILE_MAX_BYTES",
    recapImportDefaults.fileMaxBytes,
  );

  if (file.size > maxZipBytes) {
    return buildErrorResponse(413, "zip_too_large", "ZIP 파일 용량이 제한을 초과했습니다.");
  }

  let extract;
  try {
    const buffer = await file.arrayBuffer();
    extract = await extractRecapZip(buffer, {
      maxEntries: maxFiles,
      maxTotalBytes,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ZIP을 처리할 수 없습니다.";
    return buildErrorResponse(400, "zip_parse_failed", message);
  }

  let recapPayload;
  try {
    recapPayload = parseRecapPayload(extract.recapJson);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "recap.json 검증에 실패했습니다.";
    return buildErrorResponse(400, "recap_invalid", message);
  }

  const supabase = createSupabaseAdminClient();
  let importResult;
  try {
    importResult = await importRecapData({
      supabase,
      ownerId: userId,
      mode,
      boardId: typeof targetBoardId === "string" ? targetBoardId : undefined,
      boardTitle: typeof title === "string" ? title : undefined,
      recap: recapPayload,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "가져오기에 실패했습니다.";
    return buildErrorResponse(400, "import_failed", message);
  }

  const matchedFiles: MatchedFile[] = [];
  const missingFiles: Array<{ fileId: string; filename: string }> = [];
  const matchedIdsByCardId = new Map<string, Set<string>>();

  for (const card of importResult.cardFileRefs) {
    for (const fileRef of card.fileRefs) {
      const entry = extract.filesById.get(fileRef.id);
      if (!entry) {
        missingFiles.push({ fileId: fileRef.id, filename: fileRef.filename });
        continue;
      }

      const filename = fileRef.filename || entry.filename;
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
        fileId: fileRef.id,
        filename,
        sizeBytes,
        contentType,
        data: entry.data,
      });

      const matchedIds = matchedIdsByCardId.get(card.cardId) ?? new Set<string>();
      matchedIds.add(fileRef.id);
      matchedIdsByCardId.set(card.cardId, matchedIds);
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

  try {
    const currentTotal = await getCurrentStorageBytes(supabase, userId);
    if (currentTotal + totalUploadBytes > tenantMaxBytes) {
      return buildErrorResponse(413, "storage_limit_exceeded", "총 저장 용량 한도를 초과했습니다.");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "용량 확인에 실패했습니다.";
    return buildErrorResponse(500, "storage_check_failed", message);
  }

  let importedFiles = 0;
  for (const matched of matchedFiles) {
    const safeFilename = sanitizeFilename(matched.filename);
    const r2Key = `u/${userId}/c/${matched.cardId}/${crypto.randomUUID()}-${safeFilename}`;

    const { data: fileRow, error: insertError } = await supabase
      .from("files")
      .insert({
        card_id: matched.cardId,
        owner_id: userId,
        r2_key: r2Key,
        filename: safeFilename,
        content_type: matched.contentType,
        size_bytes: matched.sizeBytes,
        status: "pending",
      })
      .select("id")
      .single();

    if (insertError) {
      return buildErrorResponse(400, "db_insert_failed", insertError.message);
    }

    const uploadUrl = await presignPutUrl({
      key: r2Key,
      contentType: matched.contentType,
      expiresSeconds: 900,
    });

    const uploadBody = new Uint8Array(matched.data).buffer;
    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": matched.contentType,
      },
      body: uploadBody,
    });

    if (!uploadResponse.ok) {
      return buildErrorResponse(
        502,
        "r2_upload_failed",
        `파일 업로드에 실패했습니다: ${matched.filename}`,
      );
    }

    const objectHead = await headObject(r2Key);
    if (!objectHead.exists) {
      return buildErrorResponse(
        502,
        "r2_verify_failed",
        `업로드된 파일을 확인하지 못했습니다: ${matched.filename}`,
      );
    }

    if (
      objectHead.contentLength !== undefined &&
      objectHead.contentLength !== matched.sizeBytes
    ) {
      return buildErrorResponse(
        502,
        "r2_size_mismatch",
        `업로드된 파일 크기가 일치하지 않습니다: ${matched.filename}`,
      );
    }

    const { error: updateError } = await supabase
      .from("files")
      .update({ status: "ready" })
      .eq("id", fileRow?.id)
      .eq("status", "pending");

    if (updateError) {
      return buildErrorResponse(400, "db_update_failed", updateError.message);
    }

    importedFiles += 1;
  }

  for (const card of importResult.cardFileRefs) {
    const matchedIds = matchedIdsByCardId.get(card.cardId);
    if (!matchedIds || matchedIds.size === 0) {
      continue;
    }
    const filtered = card.externalAttachments.filter(
      (attachment) => !attachment.id || !matchedIds.has(attachment.id),
    );
    const { error } = await supabase
      .from("cards")
      .update({
        external_attachments: filtered.length > 0 ? filtered : null,
      })
      .eq("id", card.cardId);

    if (error) {
      return buildErrorResponse(400, "db_update_failed", error.message);
    }
  }

  const importedWalls = recapPayload.walls.length;
  const externalAttachmentsKept = importResult.cardFileRefs.reduce((sum, card) => {
    const matchedIds = matchedIdsByCardId.get(card.cardId);
    if (!matchedIds || matchedIds.size === 0) {
      return sum + card.externalAttachments.length;
    }
    const remaining = card.externalAttachments.filter(
      (attachment) => !attachment.id || !matchedIds.has(attachment.id),
    );
    return sum + remaining.length;
  }, 0);

  return NextResponse.json({
    boardId: importResult.boardId,
    importedWalls,
    importedCards: importResult.importedCards,
    importedFiles,
    missingFiles,
    externalAttachmentsKept,
  });
}
