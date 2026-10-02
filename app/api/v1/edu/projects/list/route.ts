import { type NextRequest } from "next/server";

import { handleGet } from "./handler";

export async function GET(request: NextRequest) {
  return handleGet(request);
}
