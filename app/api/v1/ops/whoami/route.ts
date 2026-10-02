import { NextRequest } from "next/server";

import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { withNoStoreHeaders } from "@/lib/api/server/noStoreHeaders";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { isOpsAdmin } from "@/lib/auth/opsAdmin";
import { getEduJoinSession } from "@/lib/edu/joinSession";
import { resolveJoinTokenFromRequest } from "@/lib/edu/joinTokenRequest";
import { withOps, type WithOpsContext } from "@/lib/ops/withOps";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const JOIN_TOKEN_AUTH = ["join", "token"].join("_");

async function handleGet(_request: NextRequest, _context: unknown, ops: WithOpsContext) {
  try {
    const { user } = await requireUserApi();
    return jsonOkWithRequestId(
      {
        userId: user.id,
        email: user.email,
        isOpsAdmin: isOpsAdmin(user.email),
      },
      ops.requestId,
      withNoStoreHeaders(),
    );
  } catch {
    const joinToken = resolveJoinTokenFromRequest(_request);
    if (joinToken) {
      const joinSession = await getEduJoinSession(joinToken);
      if (joinSession?.shareCode) {
        return jsonOkWithRequestId(
          {
            userId: null,
            email: null,
            isOpsAdmin: false,
            auth: JOIN_TOKEN_AUTH,
            shareCode: joinSession.shareCode,
          },
          ops.requestId,
          withNoStoreHeaders(),
        );
      }
    }
    return jsonErrorWithRequestId(
      "unauthorized",
      "로그인이 필요합니다.",
      ops.requestId,
      401,
      undefined,
      withNoStoreHeaders(),
    );
  }
}

export const GET = withOps(handleGet, { log: true });
