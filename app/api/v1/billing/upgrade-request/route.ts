import { withOps } from "@/lib/ops/withOps";

import { handlePost } from "./handler";

export const POST = withOps(handlePost, { log: true });
