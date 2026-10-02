import { type NextRequest } from "next/server";

import { AUDIT_ACTIONS } from "@/lib/data/auditActions";

import { handleHomeHubV2ViewedPost } from "./handler";

export async function POST(request: NextRequest) {
  return handleHomeHubV2ViewedPost(request, {
    action: AUDIT_ACTIONS.dashboardHomeHubV2Viewed,
    meta: { source: "dashboard" },
  });
}
