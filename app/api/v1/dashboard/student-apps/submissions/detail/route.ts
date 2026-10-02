import { NextRequest } from "next/server";

import { requireUserApi } from "@/lib/auth/requireUserApi";
import { getEduBucketFromRuntimeEnv } from "@/lib/cloudflare/getCloudflareRuntimeEnv";
import { toCamelKeys } from "@/lib/standards/fields";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const error = (status: number, code: string, message: string) =>
  Response.json({ ok: false, error: { code, message } }, { status, headers: { "cache-control": "no-store" } });

export async function GET(request: NextRequest) {
  let userId = "";
  try { userId = (await requireUserApi()).user.id; } catch { return error(401, "unauthorized", "로그인이 필요합니다."); }
  const boardId = request.nextUrl.searchParams.get("boardId")?.trim();
  const submissionId = request.nextUrl.searchParams.get("submissionId")?.trim();
  if (!boardId || !submissionId) return error(400, "invalid_request", "boardId와 submissionId가 필요합니다.");

  const bucket = getEduBucketFromRuntimeEnv();
  if (!bucket) return error(503, "storage_unavailable", "스토리지를 사용할 수 없습니다.");

  const supabase = createSupabaseAdminClient();
  const boardRes = await supabase.from("boards").select("id, owner_id").eq("id", boardId).maybeSingle();
  if (boardRes.error) return error(500, "internal_error", "요청을 처리하지 못했습니다.");
  if (!boardRes.data || boardRes.data.owner_id !== userId) return error(403, "forbidden_board", "보드 접근 권한이 없습니다.");

  const submissionRes = await supabase.from("student_app_submissions").select("id,title,status,submitted_by_name,summary,created_at").eq("id", submissionId).eq("board_id", boardId).is("deleted_at", null).maybeSingle();
  if (submissionRes.error) return error(500, "internal_error", "요청을 처리하지 못했습니다.");
  if (!submissionRes.data) return error(404, "not_found", "제출물을 찾을 수 없습니다.");

  const filesRes = await supabase.from("student_app_submission_files").select("path, objectKey:r2_key, contentType:content_type, sizeBytes:size_bytes").eq("submission_id", submissionId).order("path", { ascending: true });
  if (filesRes.error) return error(500, "internal_error", "요청을 처리하지 못했습니다.");
  type SubmissionFileRow = { path: string; objectKey: string; contentType: string; sizeBytes: number };
  const rows = (filesRes.data ?? []).map((row) => toCamelKeys(row as Record<string, unknown>) as SubmissionFileRow);
  if (rows.length > 100) return error(413, "submission_too_large", "파일 수가 너무 많습니다.");
  const totalSize = rows.reduce((sum, row) => sum + (row.sizeBytes ?? 0), 0);
  if (totalSize > 10 * 1024 * 1024) return error(413, "submission_too_large", "제출물 크기가 너무 큽니다.");

  const files: Array<{ name: string; path: string; contentType: string; sizeBytes: number; contentText?: string; contentBase64?: string }> = [];
  for (const row of rows) {
    const obj = await bucket.get(row.objectKey);
    if (!obj) return error(500, "storage_unavailable", "제출 파일을 읽을 수 없습니다.");
    const ab = await obj.arrayBuffer();
    const bytes = new Uint8Array(ab);
    const looksText = row.contentType.startsWith("text/") || /json|javascript|xml|svg/.test(row.contentType);
    const name = row.path.split("/").pop() || row.path;
    if (looksText) files.push({ name, path: row.path, contentType: row.contentType, sizeBytes: row.sizeBytes, contentText: new TextDecoder().decode(bytes) });
    else { let bin = ""; for (const b of bytes) bin += String.fromCharCode(b); files.push({ name, path: row.path, contentType: row.contentType, sizeBytes: row.sizeBytes, contentBase64: btoa(bin) }); }
  }

  const submission = toCamelKeys(submissionRes.data as Record<string, unknown>) as { id: string; title: string; status: string; submittedByName: string | null; summary: unknown; createdAt: string };
  return Response.json({ ok: true, submission: { id: submission.id, title: submission.title, status: submission.status, submittedByName: submission.submittedByName, summary: submission.summary, createdAt: submission.createdAt }, files }, { headers: { "cache-control": "no-store" } });
}
