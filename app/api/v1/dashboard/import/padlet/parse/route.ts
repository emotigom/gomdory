import { NextResponse } from "next/server";

import { requireUserApi } from "@/lib/auth/requireUserApi";
import { extractPadletCsvFromZip } from "@/lib/padlet/zip";
import { buildPadletPreview, parsePadletCsv } from "@/lib/padlet/importer";
import { getPositiveEnvNumber, padletImportDefaults } from "@/lib/padlet/limits";

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
  try {
    await requireUserApi();
  } catch {
    return buildErrorResponse(401, "unauthorized", "로그인이 필요합니다.");
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return buildErrorResponse(400, "file_missing", "CSV 또는 ZIP 파일이 필요합니다.");
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
  let source = "csv";
  let csvFilename = file.name;

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
      csvFilename = extract.csvFilename;
      source = "zip";
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

  const preview = buildPadletPreview(payload);

  return NextResponse.json({
    preview,
    source,
    csvFilename,
  });
}
