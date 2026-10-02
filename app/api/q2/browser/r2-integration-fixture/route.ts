import { NextResponse } from "next/server";

import { assertQaObjectKey, deleteFixture, readFixture, uploadFixture } from "@/lib/q2/browser/r2IntegrationFixture.mjs";
import { readEnvString } from "@/lib/server/runtimeEnv";

export const runtime = "nodejs";

function fixtureAllowed(request: Request): boolean {
  const nodeEnv = readEnvString("NODE_ENV");
  const expectedToken = readEnvString("Q2_B9_R2_FIXTURE_TOKEN");
  if (nodeEnv === "production") return false;
  const host = request.headers.get("host")?.split(":")[0];
  const token = request.headers.get("x-q2-b9-r2-fixture-token");
  return (host === "127.0.0.1" || host === "localhost") && Boolean(token) && Boolean(expectedToken) && token === expectedToken;
}

function bucket(): R2Bucket {
  const candidate = (globalThis as typeof globalThis & { EDU_BUCKET?: R2Bucket }).EDU_BUCKET;
  if (!candidate) throw new Error("R2 fixture binding is unavailable");
  return candidate;
}

export async function POST(request: Request) {
  if (!fixtureAllowed(request)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  try {
    const body = await request.json() as { action?: string; key?: string; contentBase64?: string; mimeType?: string; sha256?: string };
    if (!body.key) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
    assertQaObjectKey(body.key);
    if (body.action === "upload") {
      const bytes = Uint8Array.from(Buffer.from(body.contentBase64 ?? "", "base64"));
      const result = await uploadFixture({ bucket: bucket(), key: body.key, bytes, mimeType: body.mimeType, sha256: body.sha256 });
      return NextResponse.json({ key: result.key, size: result.size });
    }
    if (body.action === "read") {
      const result = await readFixture({ bucket: bucket(), key: body.key });
      return result ? NextResponse.json({ bytes: Buffer.from(result.bytes).toString("base64"), contentType: result.contentType, sha256: result.sha256 }) : NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (body.action === "delete") return NextResponse.json({ deleted: await deleteFixture({ bucket: bucket(), key: body.key }) });
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "fixture_failed" }, { status: 400 });
  }
}
