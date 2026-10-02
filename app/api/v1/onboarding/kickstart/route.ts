export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest } from "next/server";

import { withRequestId } from "@/lib/api/server/requestId";
import { jsonError, jsonOk } from "@/lib/api/server/response";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { kickstartOnce } from "@/lib/data/onboarding.server";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { validateSupabaseEnv } from "@/lib/server/env";

export async function POST(request: NextRequest): Promise<Response> {
  const requestId = getOrCreateRequestId(request);
  const logRequest = (status: number, context?: Record<string, unknown>) => {
    const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
    console.log(
      JSON.stringify(
        {
          level,
          route: request.nextUrl.pathname,
          method: request.method,
          status,
          requestId,
          ...(context ?? {}),
        },
        (_key, value) => (value === undefined ? undefined : value),
      ),
    );
  };

  const respond = (response: Response, context?: Record<string, unknown>) => {
    const withId = withRequestId(response, requestId);
    logRequest(withId.status, context);
    return withId;
  };

  const envValidation = validateSupabaseEnv();

  if (!envValidation.ok) {
    return respond(
      jsonError(
        "supabase_env_missing",
        "킥스타트를 실행할 수 없습니다. 잠시 후 다시 시도해 주세요.",
        500,
        { hint: "supabase_env_missing", requestId },
      ),
      { code: "supabase_env_missing", hint: "supabase_env_missing" },
    );
  }

  let userId: string;

  try {
    const { user } = await requireUserApi();
    userId = user.id;
  } catch {
    return respond(
      jsonError("unauthorized", "로그인이 필요합니다.", 401, {
        hint: "supabase_auth_failed",
        requestId,
      }),
      { code: "unauthorized", hint: "supabase_auth_failed" },
    );
  }

  try {
    const result = await kickstartOnce(userId);

    if (!result.created) {
      return respond(jsonOk({ skipped: true }), { code: "kickstart_skipped" });
    }

    return respond(jsonOk({ created: true, boardId: result.boardId ?? null }), {
      code: "kickstart_created",
      boardId: result.boardId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "킥스타트를 완료하지 못했습니다.";

    return respond(
      jsonError("kickstart_failed", message, 500, { hint: "unexpected", requestId }),
      { code: "kickstart_failed", hint: "unexpected" },
    );
  }
}
