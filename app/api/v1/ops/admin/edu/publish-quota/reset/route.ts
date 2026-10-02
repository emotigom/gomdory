import { handleOpsAdminEduPublishQuotaReset } from "./handler";
import { withOps } from "@/lib/ops/withOps";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const POST = withOps(handleOpsAdminEduPublishQuotaReset, { log: true, errorCode: "db_failed" });
