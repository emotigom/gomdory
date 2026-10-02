import { NextResponse } from "next/server";

import { requireUserApi } from "@/lib/auth/requireUserApi";
import { parseRecapPayload } from "@/lib/recap/importer";
import { getPositiveEnvNumber, recapImportDefaults } from "@/lib/recap/limits";
import { extractRecapZip } from "@/lib/recap/zip";

type ExtractResult = Awaited<ReturnType<typeof extractRecapZip>>;
type FileSummary = {
  fileId: string;
  filename: string;
  byteSizeFound: number | null;
  matched: boolean;
};
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
  recap: ExtractResult["recap"],
  filesById: ExtractResult["filesById"],
): { legacy: FileSummary[]; summary: FilesSummary[] } {
  const legacy: FileSummary[] = [];
  const summary: FilesSummary[] = [];

  for (const wall of recap.walls ?? []) {
    for (const card of wall.cards ?? []) {
      for (const file of card.files ?? []) {
        if (typeof file?.id !== "string" || typeof file.filename !== "string") {
          continue;
        }
        const match = filesById.get(file.id);
        legacy.push({
          fileId: file.id,
          filename: file.filename,
          byteSizeFound: match ? match.data.length : null,
          matched: Boolean(match),
        });
        summary.push({
          fileId: file.id,
          originalFilename: file.filename,
          foundInZip: Boolean(match),
          sizeBytes: match ? match.data.length : undefined,
        });
      }
    }
  }

  return { legacy, summary };
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

  try {
    parseRecapPayload(extract.recapJson);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "recap.json 검증에 실패했습니다.";
    return buildErrorResponse(400, "recap_invalid", message);
  }

  const summaries = buildFileSummaries(extract.recap, extract.filesById);
  const warnings: string[] = [];
  if (summaries.summary.some((file) => !file.foundInZip)) {
    warnings.push("ZIP에 포함되지 않은 첨부 파일은 외부 링크로 유지될 수 있어요.");
  }
  if (summaries.summary.some((file) => !isAllowedFilename(file.originalFilename))) {
    warnings.push("허용되지 않는 확장자 파일은 복원되지 않습니다.");
  }

  return NextResponse.json({
    recap: extract.recap,
    recapJson: extract.recapJson,
    files: summaries.legacy,
    filesSummary: summaries.summary,
    warnings,
  });
}
