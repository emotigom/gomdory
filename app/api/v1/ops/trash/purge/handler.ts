import type { NextRequest } from "next/server";

import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { withNoStoreHeaders } from "@/lib/api/server/noStoreHeaders";
import { ErrorCodes } from "@/lib/ops/errors";
import type { WithOpsContext } from "@/lib/ops/withOps";
import { runTrashPurge } from "@/lib/ops/trashPurge.server";

type Body = {
  dryRun?: unknown;
};

export async function handleOpsTrashPurge(request: NextRequest, _context: unknown, ops: WithOpsContext) {
  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {
    body = {};
  }

  if (typeof body.dryRun !== "boolean") {
    return jsonErrorWithRequestId(
      ErrorCodes.validationFailed,
      "dryRun(boolean)이 필요합니다.",
      ops.requestId,
      400,
      undefined,
      withNoStoreHeaders(),
    );
  }

  const summary = await runTrashPurge({ dryRun: body.dryRun });
  return jsonOkWithRequestId(
    {
      dryRun: summary.dryRun,
      scanned: summary.scanned,
      purged: summary.purged,
      failed: summary.failed,
    },
    ops.requestId,
    withNoStoreHeaders(),
  );
}
