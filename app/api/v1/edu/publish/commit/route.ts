import { NextRequest } from "next/server";

import { handleEduPublishCommit } from "@/lib/server/edu/publish/handleEduPublishCommit";

export async function POST(request: NextRequest) {
  return handleEduPublishCommit(request);
}
