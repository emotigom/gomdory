import { requireUserApi } from "@/lib/auth/requireUserApi";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { publishStudentAppDeployment, unpublishStudentAppDeployment } from "@/lib/student-apps/publishStudentAppDeployment";

const error = (status: number, code: string, message: string) => Response.json({ ok: false, error: { code, message } }, { status, headers: { "cache-control": "no-store" } });

export async function POST(request: Request) {
  let userId = "";
  try {
    userId = (await requireUserApi()).user.id;
  } catch {
    return error(401, "unauthorized", "로그인이 필요합니다.");
  }

  let body: { boardId?: string; deploymentId?: string; action?: string } | null = null;
  try {
    body = await request.json();
  } catch {
    return error(400, "invalid_body", "요청 본문이 올바르지 않습니다.");
  }
  if (!body || typeof body !== "object") return error(400, "invalid_body", "요청 본문이 올바르지 않습니다.");
  const boardId = body.boardId?.trim();
  const deploymentId = body.deploymentId?.trim();
  const action = body.action;
  if (!boardId) return error(400, "board_id_required", "boardId가 필요합니다.");
  if (!deploymentId) return error(400, "deployment_id_required", "deploymentId가 필요합니다.");
  if (action !== "publish" && action !== "unpublish") return error(400, "invalid_action", "action은 publish 또는 unpublish여야 합니다.");

  const supabase = createSupabaseAdminClient() as unknown as Parameters<typeof publishStudentAppDeployment>[0]["supabase"];
  try {
    const result = action === "publish"
      ? await publishStudentAppDeployment({ supabase, userId, boardId, deploymentId })
      : await unpublishStudentAppDeployment({ supabase, userId, boardId, deploymentId });
    return Response.json(result, { status: 200, headers: { "cache-control": "no-store" } });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "forbidden_board") return error(403, code, "보드 접근 권한이 없습니다.");
    if (code === "deployment_not_found") return error(404, code, "배포를 찾을 수 없습니다.");
    if (code === "deployment_not_publishable") return error(409, code, "현재 배포 상태에서는 이 작업을 할 수 없습니다.");
    if (code === "storage_schema_unavailable") return error(503, code, "저장소 스키마를 사용할 수 없습니다.");
    return error(500, "internal_error", "요청을 처리하지 못했습니다.");
  }
}
