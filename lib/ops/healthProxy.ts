import "server-only";

import { NextResponse } from "next/server";

export async function proxyInternalHealthRequest(request: Request): Promise<Response> {
  const upstreamUrl = new URL("/__health", request.url);
  const upstreamResponse = await fetch(upstreamUrl, { headers: request.headers });

  return new NextResponse(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: upstreamResponse.headers,
  });
}
