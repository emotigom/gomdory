import { withOps } from "@/lib/ops/withOps";

import { handleOpsUsersSearch } from "./handler";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const GET = withOps(handleOpsUsersSearch, { log: true });
