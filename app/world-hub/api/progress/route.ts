import { NextResponse } from "next/server";

import { validateSupabaseEnv } from "@/lib/server/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createEmptyMetaverseProgressSnapshot,
  parseMetaverseProgressWriteRequest,
} from "@/lib/world-hub/progress/contracts";
import {
  readMetaverseProgressSnapshotForUser,
  writeMetaverseProgressSnapshotForUser,
} from "@/lib/world-hub/progress/serverPersistence";

function createUnavailableSnapshot(detail: string, fallbackReason: "env-missing" | "unauthenticated") {
  return createEmptyMetaverseProgressSnapshot({
    source: {
      kind: "unavailable",
      label: "Supabase progress unavailable",
      detail,
      fallbackReason,
      diagnostics: {
        mode: "unavailable",
        storageKey: null,
        endpoint: "/world-hub/api/progress",
        userScoped: fallbackReason !== "env-missing",
        readStatus: "failed",
        writeStatus: "failed",
        syncedAtIso: null,
      },
    },
  });
}

async function getAuthenticatedUserId() {
  const validation = validateSupabaseEnv();
  if (!validation.ok) {
    return {
      ok: false as const,
      response: NextResponse.json(
        createUnavailableSnapshot("Supabase env is missing, so metaverse progress stayed on deterministic local fallback.", "env-missing"),
        { status: 503 },
      ),
    };
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false as const,
      response: NextResponse.json(
        createUnavailableSnapshot("No signed-in user was available for metaverse progress persistence.", "unauthenticated"),
        { status: 401 },
      ),
    };
  }

  return {
    ok: true as const,
    userId: user.id,
  };
}

export async function GET() {
  const auth = await getAuthenticatedUserId();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const snapshot = await readMetaverseProgressSnapshotForUser({ userId: auth.userId });
    return NextResponse.json(snapshot, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      createEmptyMetaverseProgressSnapshot({
        source: {
          kind: "unavailable",
          label: "Supabase progress read failed",
          detail: error instanceof Error ? error.message : "Metaverse progress read failed.",
          fallbackReason: "read-failed",
          diagnostics: {
            mode: "unavailable",
            storageKey: null,
            endpoint: "/world-hub/api/progress",
            userScoped: true,
            readStatus: "failed",
            writeStatus: "not-requested",
            syncedAtIso: null,
          },
        },
      }),
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await getAuthenticatedUserId();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = parseMetaverseProgressWriteRequest(await request.json());
    const writeResult = await writeMetaverseProgressSnapshotForUser({
      userId: auth.userId,
      payload: body.payload,
    });
    return NextResponse.json(writeResult, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      createEmptyMetaverseProgressSnapshot({
        source: {
          kind: "unavailable",
          label: "Supabase progress write failed",
          detail: error instanceof Error ? error.message : "Metaverse progress write failed.",
          fallbackReason: "write-failed",
          diagnostics: {
            mode: "unavailable",
            storageKey: null,
            endpoint: "/world-hub/api/progress",
            userScoped: true,
            readStatus: "not-requested",
            writeStatus: "failed",
            syncedAtIso: null,
          },
        },
      }),
      { status: 500 },
    );
  }
}
