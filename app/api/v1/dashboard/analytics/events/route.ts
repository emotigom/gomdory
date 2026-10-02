import { type NextRequest } from "next/server";

import { handleDashboardAnalyticsEventsPost } from "./handler";

export async function POST(request: NextRequest) {
  return handleDashboardAnalyticsEventsPost(request);
}
