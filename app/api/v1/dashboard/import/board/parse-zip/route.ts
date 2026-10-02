import { NextResponse } from "next/server";

import { requireUserApi } from "@/lib/auth/requireUserApi";
import { parseBoardPayload } from "@/lib/board/importer";
import { getPositiveEnvNumber, boardImportDefaults } from "@/lib/board/limits";
import { extractBoardZip } from "@/lib/board/zip";

type ExtractResult = Awaited<ReturnType<typeof extractBoardZip>>;
type FilesSummary = {
  fileId: string;
  originalFilename: string;
  foundInZip: boolean;
  sizeBytes?: number;
};

const ALLOWED_EXTENSIONS = new Set([
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "txt",
  "pptx",
  "docx",
]);

function getFileExtension(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? "";
  const parts = base.split(".");
  if (parts.length < 2) {
    return "";
  }
  return parts[parts.length - 1]?.toLowerCase() ?? "";
}

function isAllowedFilename(filename: string): boolean {
  const ext = getFileExtension(filename);
  return ext.length > 0 && ALLOWED_EXTENSIONS.has(ext);
}

function buildErrorResponse(status: number, code: string, userMessage: string) {
  return NextResponse.json({ code, userMessage, error: userMessage }, { status });
}

function buildFileSummaries(
  payload: ExtractResult["board"],
  filesById: ExtractResult["filesById"],
): FilesSummary[] {
  const summary: FilesSummary[] = [];

  for (const card of payload.cards ?? []) {
    for (const file of card.internal_files ?? []) {
      if (typeof file?.fileId !== "string" || typeof file.originalFilename !== "string") {
        continue;
      }
      const match = filesById.get(file.fileId);
      summary.push({
        fileId: file.fileId,
        originalFilename: file.originalFilename,
        foundInZip: Boolean(match),
        sizeBytes: match ? match.data.length : undefined,
      });
    }
  }

  return summary;
}

export async function POST(request: Request) {
  try {
    await requireUserApi();
  } catch {
    return buildErrorResponse(401, "unauthorized", "로그인이 필요합니다.");
  }

  const formData = await request.formData();
  const file = formData.get("zip");

  if (!(file instanceof File)) {
    return buildErrorResponse(400, "zip_missing", "ZIP 파일이 필요합니다.");
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
  let warnings: string[] = [];
  try {
    const parsed = parseBoardPayload(extract.boardJson);
    normalized = parsed.payload;
    warnings = parsed.warnings;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "board.json 검증에 실패했습니다.";
    return buildErrorResponse(400, "board_invalid", message);
  }

  const filesSummary = buildFileSummaries(extract.board, extract.filesById);
  if (filesSummary.some((file) => !file.foundInZip)) {
    warnings.push("ZIP에 포함되지 않은 첨부 파일은 복원되지 않습니다.");
  }
  if (filesSummary.some((file) => !isAllowedFilename(file.originalFilename))) {
    warnings.push("허용되지 않는 확장자 파일은 복원되지 않습니다.");
  }

  return NextResponse.json({
    board: normalized,
    boardJson: extract.boardJson,
    filesSummary,
    warnings,
  });
}
