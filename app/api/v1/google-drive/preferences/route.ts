import { NextResponse, type NextRequest } from "next/server";

import { requireUserApi } from "@/lib/auth/requireUserApi";
import {
  clearGoogleDriveIntegrationPreference,
  readGoogleDriveIntegrationPreference,
  saveGoogleDriveIntegrationPreference,
} from "@/lib/q2/browser/googleDriveIntegrationFixture";
import { isQ2B9FixtureAuthorized } from "@/lib/q2/browser/resultDownloadFixture";
import type { GoogleDrivePreference, GoogleDrivePurpose } from "@/lib/google-drive/types";
import { toCamelKeys, toSnakeKeys } from "@/lib/standards/fields";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type PreferenceRow = {
  userId: string;
  purpose: GoogleDrivePurpose;
  folderId: string;
  folderName: string;
  folderWebViewLink: string | null;
  updatedAt: string;
};

const PURPOSES = new Set<GoogleDrivePurpose>([
  "student-records",
  "student-gallery",
  "board-backup",
]);

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

function readPurpose(request: NextRequest): GoogleDrivePurpose | null {
  const purpose = request.nextUrl.searchParams.get("purpose");
  return purpose && PURPOSES.has(purpose as GoogleDrivePurpose)
    ? (purpose as GoogleDrivePurpose)
    : null;
}

function toPreference(row: PreferenceRow): GoogleDrivePreference {
  return {
    userId: row.userId,
    purpose: row.purpose,
    folderId: row.folderId,
    folderName: row.folderName,
    ...(row.folderWebViewLink ? { folderWebViewLink: row.folderWebViewLink } : {}),
    updatedAt: row.updatedAt,
  };
}

const toPreferenceRow = (row: Record<string, unknown>) => toCamelKeys(row) as PreferenceRow;

async function authenticate() {
  try {
    return await requireUserApi();
  } catch {
    return null;
  }
}

function fixtureAuthorized(request: NextRequest) {
  return isQ2B9FixtureAuthorized(request.headers.get("x-q2-browser-fixture-authorized"));
}

function fixturePurposeOnly(purpose: GoogleDrivePurpose | null) {
  return purpose === "board-backup";
}

export async function GET(request: NextRequest) {
  const purpose = readPurpose(request);
  if (!purpose) return jsonError("invalid_purpose", "저장 목적이 올바르지 않습니다.", 400);
  if (fixtureAuthorized(request)) {
    if (!fixturePurposeOnly(purpose)) return jsonError("invalid_purpose", "저장 목적이 올바르지 않습니다.", 400);
    return NextResponse.json({ ok: true, preference: readGoogleDriveIntegrationPreference() });
  }

  const auth = await authenticate();
  if (!auth) return jsonError("unauthorized", "로그인이 필요합니다.", 401);

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("google_drive_preferences")
    .select("user_id,purpose,folder_id,folder_name,folder_web_view_link,updated_at")
    .eq("user_id", auth.user.id)
    .eq("purpose", purpose)
    .maybeSingle();

  if (error) return jsonError("preference_read_failed", "저장 폴더 정보를 불러오지 못했습니다.", 502);
  return NextResponse.json({ ok: true, preference: data ? toPreference(toPreferenceRow(data as Record<string, unknown>)) : null });
}

export async function PUT(request: NextRequest) {
  const purpose = readPurpose(request);
  if (!purpose) return jsonError("invalid_purpose", "저장 목적이 올바르지 않습니다.", 400);

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const folderId = typeof body?.folderId === "string" ? body.folderId.trim() : "";
  const folderName = typeof body?.folderName === "string" ? body.folderName.trim() : "";
  const folderWebViewLink =
    typeof body?.folderWebViewLink === "string" ? body.folderWebViewLink.trim() || null : null;
  if (!folderId || !folderName) {
    return jsonError("invalid_body", "저장 폴더 정보가 올바르지 않습니다.", 400);
  }

  if (fixtureAuthorized(request)) {
    if (!fixturePurposeOnly(purpose)) return jsonError("invalid_purpose", "저장 목적이 올바르지 않습니다.", 400);
    return NextResponse.json({ ok: true, preference: saveGoogleDriveIntegrationPreference({ folderId, folderName, folderWebViewLink: folderWebViewLink ?? undefined }) });
  }

  const auth = await authenticate();
  if (!auth) return jsonError("unauthorized", "로그인이 필요합니다.", 401);

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("google_drive_preferences")
    .upsert(
      toSnakeKeys({
        userId: auth.user.id,
        purpose,
        folderId,
        folderName,
        folderWebViewLink,
      }),
      { onConflict: "user_id,purpose" },
    )
    .select("user_id,purpose,folder_id,folder_name,folder_web_view_link,updated_at")
    .single();

  if (error || !data) {
    return jsonError("preference_write_failed", "저장 폴더 정보를 저장하지 못했습니다.", 502);
  }
  return NextResponse.json({ ok: true, preference: toPreference(toPreferenceRow(data as Record<string, unknown>)) });
}

export async function DELETE(request: NextRequest) {
  const purpose = readPurpose(request);
  if (!purpose) return jsonError("invalid_purpose", "저장 목적이 올바르지 않습니다.", 400);

  if (fixtureAuthorized(request)) {
    if (!fixturePurposeOnly(purpose)) return jsonError("invalid_purpose", "저장 목적이 올바르지 않습니다.", 400);
    clearGoogleDriveIntegrationPreference();
    return NextResponse.json({ ok: true });
  }

  const auth = await authenticate();
  if (!auth) return jsonError("unauthorized", "로그인이 필요합니다.", 401);

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("google_drive_preferences")
    .delete()
    .eq("user_id", auth.user.id)
    .eq("purpose", purpose);

  if (error) return jsonError("preference_delete_failed", "저장 폴더 연결을 해제하지 못했습니다.", 502);
  return NextResponse.json({ ok: true });
}
