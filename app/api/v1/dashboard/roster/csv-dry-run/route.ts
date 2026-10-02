import { NextRequest } from "next/server";

import { requireUserApi } from "@/lib/auth/requireUserApi";
import { parseCsvRosterDryRun, type CsvRosterParserOptions } from "@/lib/roster/csvRosterParser";
import { getRuntimeEnv, readEnvStringFrom } from "@/lib/server/runtimeEnv";

type Dependencies = {
  requireUserApiFn?: typeof requireUserApi;
  env?: NodeJS.ProcessEnv;
};

type DryRunRequestBody = {
  csvText: string;
  options?: {
    maxRows?: number;
    maxCellLength?: number;
    emptyRowAsWarning?: boolean;
  };
};

const MAX_CSV_BYTES = 512 * 1024;
const MIN_MAX_ROWS = 1;
const MAX_MAX_ROWS = 1000;
const MIN_MAX_CELL_LENGTH = 1;
const MAX_MAX_CELL_LENGTH = 500;

function error(status: number, code: string, message: string) {
  return Response.json({ ok: false, error: { code, message } }, { status, headers: { "cache-control": "no-store" } });
}

function parseBody(raw: unknown): DryRunRequestBody | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const body = raw as Record<string, unknown>;
  if (typeof body.csvText !== "string") return null;

  const parsed: DryRunRequestBody = { csvText: body.csvText };
  if (body.options && typeof body.options === "object" && !Array.isArray(body.options)) {
    const options = body.options as Record<string, unknown>;
    parsed.options = {};
    if (typeof options.maxRows === "number") parsed.options.maxRows = Math.floor(options.maxRows);
    if (typeof options.maxCellLength === "number") parsed.options.maxCellLength = Math.floor(options.maxCellLength);
    if (typeof options.emptyRowAsWarning === "boolean") parsed.options.emptyRowAsWarning = options.emptyRowAsWarning;
  }
  return parsed;
}

function sanitizeOptions(options?: DryRunRequestBody["options"]): CsvRosterParserOptions {
  const maxRows = options?.maxRows;
  const maxCellLength = options?.maxCellLength;

  return {
    maxRows:
      typeof maxRows === "number" && Number.isFinite(maxRows)
        ? Math.min(MAX_MAX_ROWS, Math.max(MIN_MAX_ROWS, maxRows))
        : undefined,
    maxCellLength:
      typeof maxCellLength === "number" && Number.isFinite(maxCellLength)
        ? Math.min(MAX_MAX_CELL_LENGTH, Math.max(MIN_MAX_CELL_LENGTH, maxCellLength))
        : undefined,
    emptyRowAsWarning: options?.emptyRowAsWarning,
  };
}

export async function POST(request: NextRequest, _context?: unknown, deps?: Dependencies) {
  const env = deps?.env ?? getRuntimeEnv();
  if (readEnvStringFrom(env, "ENABLE_CSV_ROSTER_DRY_RUN_API") !== "true") {
    return error(403, "feature_disabled", "현재는 서버 CSV 검증 기능을 사용할 수 없습니다.");
  }

  try {
    await (deps?.requireUserApiFn ?? requireUserApi)();
  } catch {
    return error(401, "unauthorized", "로그인이 필요합니다.");
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return error(400, "invalid_body", "요청 형식이 올바르지 않습니다.");
  }

  const body = parseBody(rawBody);
  if (!body) {
    return error(400, "invalid_body", "요청 형식이 올바르지 않습니다.");
  }

  if (!body.csvText.trim()) {
    return error(400, "csv_text_required", "CSV 내용이 필요합니다.");
  }

  if (Buffer.byteLength(body.csvText, "utf8") > MAX_CSV_BYTES) {
    return error(413, "csv_too_large", "CSV 내용이 너무 큽니다. 512KB 이하로 줄여주세요.");
  }

  const result = parseCsvRosterDryRun(body.csvText, sanitizeOptions(body.options));

  return Response.json({ ok: true, result }, { status: 200, headers: { "cache-control": "no-store" } });
}
