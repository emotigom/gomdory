import { proxyInternalHealthRequest } from "@/lib/ops/healthProxy";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return proxyInternalHealthRequest(request);
}
