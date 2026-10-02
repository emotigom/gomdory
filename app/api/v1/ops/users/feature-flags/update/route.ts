import { withOps } from "@/lib/ops/withOps";

import { handleFeatureFlagsUpdate } from "./handler";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const POST = withOps(handleFeatureFlagsUpdate, { log: true });
