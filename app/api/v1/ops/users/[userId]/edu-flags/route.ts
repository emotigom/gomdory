import { withOps } from "@/lib/ops/withOps";

import { handleOpsUserEduFlagsGet, handleOpsUserEduFlagsPost } from "./handler";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const GET = withOps(handleOpsUserEduFlagsGet, { log: true });
export const POST = withOps(handleOpsUserEduFlagsPost, { log: true });
