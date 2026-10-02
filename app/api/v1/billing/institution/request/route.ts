import { ErrorCodes } from "@/lib/ops/errors";
import { withOps } from "@/lib/ops/withOps";

import { handlePost } from "./handler";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const POST = withOps(handlePost, { log: true, errorCode: ErrorCodes.dbFailed });
