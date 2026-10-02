import { withOps } from "@/lib/ops/withOps";

import { handleOpsTrashPurge } from "./handler";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const POST = withOps(handleOpsTrashPurge, { log: true, errorCode: "forbidden" });
