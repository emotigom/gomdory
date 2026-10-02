import { NextResponse } from "next/server";

import { mergeNoStoreHeaders } from "@/lib/api/server/noStoreHeaders";

const GONE_PAYLOAD = {
  ok: false,
  code: "gone",
  message: "This feature is disabled.",
} as const;

export function goneResponse() {
  return NextResponse.json(GONE_PAYLOAD, { status: 410, headers: mergeNoStoreHeaders() });
}
