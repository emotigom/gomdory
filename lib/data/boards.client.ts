import { apiV1Path } from "@/lib/standards/pathTypes";

import "client-only";

import { assertSchemaVersion } from "@/lib/contracts/assertSchemaVersion";
import { SCHEMA_VERSIONS } from "@/lib/contracts/schemaVersion";
import { normalizeBoardSummary } from "@/lib/data/boards";
import { safeDisplayMessage } from "@/lib/ui/safeErrors";

export type BoardOption = { id: string; title: string };

type BoardsResponse = {
  boards?: unknown;
  code?: unknown;
  error?: unknown;
  ok?: boolean;
  requestId?: unknown;
  userMessage?: unknown;
};

export type BoardFetchIssue = {
  code: string;
  requestId?: string;
  status?: number;
  unauthorized?: boolean;
  message?: string;
};

export type BoardFetchResult = {
  boards: BoardOption[];
  issue: BoardFetchIssue | null;
};

export const IMPORT_BOARDS_FALLBACK_MESSAGE =
  "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function logFetchFailure(issue: BoardFetchIssue, message?: string) {
  console.error(
    JSON.stringify(
      {
        level: "error",
        stage: "import_boards_fetch_failed",
        code: issue.code,
        requestId: issue.requestId,
        status: issue.status,
        unauthorized: issue.unauthorized,
        message,
      },
      (_key, value) => (value === undefined ? undefined : value),
    ),
  );
}

export async function fetchDashboardBoards(): Promise<BoardFetchResult> {
  try {
    const response = await fetch(apiV1Path("dashboard/boards"), { cache: "no-store", method: "GET" });

    let payload: BoardsResponse | null = null;
    let parsedJson = false;

    try {
      payload = (await response.clone().json()) as BoardsResponse;
      parsedJson = true;
    } catch {
      payload = null;
    }

    const code = optionalString(payload?.code);
    const requestId =
      optionalString(payload?.requestId) ?? response.headers.get("x-request-id") ?? undefined;
    if (response.ok) {
      const schemaVersion =
        payload && typeof payload === "object" && "schemaVersion" in payload
          ? (payload as { schemaVersion?: unknown }).schemaVersion
          : undefined;
      assertSchemaVersion(schemaVersion, SCHEMA_VERSIONS.dashboardBoards, {
        endpoint: apiV1Path("dashboard/boards"),
        requestId,
      });
    }
    const userMessageSource = payload?.userMessage ?? payload?.error;
    const userMessage =
      userMessageSource === undefined
        ? undefined
        : safeDisplayMessage(userMessageSource, IMPORT_BOARDS_FALLBACK_MESSAGE);

    if (response.ok && payload && typeof payload === "object" && "boards" in payload) {
      const rawBoards = Array.isArray(payload.boards) ? payload.boards : [];
      const normalized = rawBoards.map((board) => normalizeBoardSummary(board));
      const filtered = normalized.filter(
        (board): board is NonNullable<typeof board> => Boolean(board?.boardId),
      );
      const boards: BoardOption[] = filtered.map((board) => ({
        id: board.boardId,
        title: board.title,
      }));

      return { boards, issue: null };
    }

    if (response.status === 401) {
      const issue: BoardFetchIssue = {
        code: code ?? "unauthorized",
        requestId,
        status: response.status,
        unauthorized: true,
        message: userMessage,
      };
      logFetchFailure(issue);
      return { boards: [], issue };
    }

    if (!parsedJson) {
      const issue: BoardFetchIssue = { code: "non_json_response", status: response.status };
      logFetchFailure(issue);
      return { boards: [], issue };
    }

    const issue: BoardFetchIssue = {
      code: code ?? "unknown_error",
      requestId,
      status: response.status,
      message: userMessage,
    };
    logFetchFailure(issue);
    return { boards: [], issue };
  } catch (error) {
    const issue: BoardFetchIssue = { code: "network_error" };
    logFetchFailure(issue, error instanceof Error ? error.message : String(error));
    return { boards: [], issue };
  }
}
