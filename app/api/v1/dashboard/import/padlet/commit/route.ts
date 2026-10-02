import { NextResponse } from "next/server";

import { requireUserApi } from "@/lib/auth/requireUserApi";
import { extractPadletCsvFromZip } from "@/lib/padlet/zip";
import { importPadletData, parsePadletCsv } from "@/lib/padlet/importer";
import { getPositiveEnvNumber, padletImportDefaults } from "@/lib/padlet/limits";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function buildErrorResponse(status: number, code: string, userMessage: string) {
  return NextResponse.json({ code, userMessage, error: userMessage }, { status });
}

function isZipFile(file: File) {
  const name = file.name.toLowerCase();
  return (
    name.endsWith(".zip") ||
    file.type === "application/zip" ||
    file.type === "application/x-zip-compressed"
  );
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
  const file = formData.get("file");
  const mode = formData.get("mode");
  const targetBoardId = formData.get("targetBoardId");
  const title = formData.get("title");

  if (!(file instanceof File)) {
    return buildErrorResponse(400, "file_missing", "CSV 또는 ZIP 파일이 필요합니다.");
  }

  if (mode !== "new" && mode !== "existing") {
    return buildErrorResponse(400, "mode_invalid", "가져오기 모드가 올바르지 않습니다.");
  }

  if (mode === "existing" && (typeof targetBoardId !== "string" || !targetBoardId)) {
    return buildErrorResponse(400, "board_missing", "보드를 선택해주세요.");
  }

  const maxCsvBytes = getPositiveEnvNumber(
    "PADLET_IMPORT_CSV_MAX_BYTES",
    padletImportDefaults.csvMaxBytes,
  );
  const maxZipBytes = getPositiveEnvNumber(
    "PADLET_IMPORT_ZIP_MAX_BYTES",
    padletImportDefaults.zipMaxBytes,
  );
  const maxTotalBytes = getPositiveEnvNumber(
    "PADLET_IMPORT_TOTAL_MAX_BYTES",
    padletImportDefaults.totalMaxBytes,
  );
  const maxEntries = getPositiveEnvNumber(
    "PADLET_IMPORT_MAX_ENTRIES",
    padletImportDefaults.maxEntries,
  );

  let csvText = "";

  if (isZipFile(file)) {
    if (file.size > maxZipBytes) {
      return buildErrorResponse(413, "zip_too_large", "ZIP 파일 용량이 제한을 초과했습니다.");
    }

    try {
      const buffer = await file.arrayBuffer();
      const extract = await extractPadletCsvFromZip(buffer, {
        maxEntries,
        maxTotalBytes,
      });
      csvText = extract.csv;
    } catch (error) {
      const message = error instanceof Error ? error.message : "ZIP을 처리할 수 없습니다.";
      return buildErrorResponse(400, "zip_parse_failed", message);
    }
  } else {
    if (file.size > maxCsvBytes) {
      return buildErrorResponse(413, "csv_too_large", "CSV 파일 용량이 제한을 초과했습니다.");
    }
    csvText = await file.text();
  }

  if (csvText.length > maxTotalBytes) {
    return buildErrorResponse(413, "csv_too_large", "CSV 파일 용량이 제한을 초과했습니다.");
  }

  let payload;
  try {
    payload = parsePadletCsv(csvText);
  } catch (error) {
    const message = error instanceof Error ? error.message : "CSV를 분석할 수 없습니다.";
    return buildErrorResponse(400, "csv_invalid", message);
  }

  const supabase = createSupabaseAdminClient();
  let importResult;

  try {
    importResult = await importPadletData({
      supabase,
      ownerId: userId,
      mode,
      boardId: typeof targetBoardId === "string" ? targetBoardId : undefined,
      boardTitle: typeof title === "string" ? title : undefined,
      payload,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "가져오기에 실패했습니다.";
    return buildErrorResponse(400, "import_failed", message);
  }

  return NextResponse.json({
    boardId: importResult.boardId,
    importedWalls: importResult.importedWalls,
    importedCards: importResult.importedCards,
    importedAttachments: importResult.importedAttachments,
    warnings: payload.warnings,
    mode,
  });
}
