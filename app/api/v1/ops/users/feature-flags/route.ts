import { withOps } from "@/lib/ops/withOps";

import { handleFeatureFlagsGet } from "./handler";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const GET = withOps(handleFeatureFlagsGet, { log: true });
