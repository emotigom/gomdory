import { publishStudentAppDeployment } from "./publishStudentAppDeployment";
import { storeStudentAppDeployment } from "./storeStudentAppDeployment";
import { isStudentAppSubmissionOpen } from "./submissionWindow";

const AUTO_PUBLISH_BLOCKING_WARNINGS = new Set([
  "external_script_src_detected",
  "form_action_detected",
  "network_request_api_detected",
]);

type SessionRow = {
  id: string;
  status: string;
  starts_at: string;
  ends_at: string;
  ended_at: string | null;
  publish_mode: string | null;
  started_by: string;
};

type ExistingDeploymentRow = { id: string };

type QueryResult<T> = Promise<{ data: T | null; error: { message?: string } | null }>;
type QueryBuilder = {
  select: (columns: string) => QueryBuilder;
  eq: (column: string, value: unknown) => QueryBuilder;
  is: (column: string, value: null) => QueryBuilder;
  order: (column: string, options: { ascending: boolean }) => QueryBuilder;
  limit: (count: number) => QueryBuilder;
  maybeSingle: <T>() => QueryResult<T>;
};
type SupabaseLike = { from: (table: string) => QueryBuilder };

export function getAutoPublishBlockingWarnings(warnings: readonly string[] | null | undefined) {
  return (warnings ?? []).filter((warning) => AUTO_PUBLISH_BLOCKING_WARNINGS.has(warning));
}

export async function autoPublishStudentAppSubmission(input: {
  bucket: R2Bucket;
  supabase: SupabaseLike;
  boardId: string;
  submissionId: string;
  wallId?: string | null;
  cardId?: string | null;
  classId?: string | null;
  rawPayload: unknown;
  safety: { warnings?: string[]; blockedReasons?: string[] };
  now?: Date;
  storeDeployment?: typeof storeStudentAppDeployment;
  publishDeployment?: typeof publishStudentAppDeployment;
}) {
  const now = input.now ?? new Date();
  const sessionRes = await input.supabase
    .from("student_app_class_sessions")
    .select("id, status, starts_at, ends_at, ended_at, publish_mode, started_by")
    .eq("board_id", input.boardId)
    .eq("status", "active")
    .is("ended_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<SessionRow>();

  if (sessionRes.error) return { status: "publish_failed" as const };
  if (!sessionRes.data || !isStudentAppSubmissionOpen(sessionRes.data, now)) {
    return { status: "session_closed" as const };
  }
  if (sessionRes.data.publish_mode !== "auto_publish") return { status: "teacher_review" as const };

  const blockingWarnings = getAutoPublishBlockingWarnings(input.safety.warnings);
  if ((input.safety.blockedReasons?.length ?? 0) > 0 || blockingWarnings.length > 0) {
    return { status: "needs_teacher_review" as const, blockingWarnings };
  }

  const existingRes = await input.supabase
    .from("student_app_deployments")
    .select("id")
    .eq("board_id", input.boardId)
    .eq("source_submission_id", input.submissionId)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle<ExistingDeploymentRow>();
  if (existingRes.error) return { status: "publish_failed" as const };

  let deploymentId = existingRes.data?.id ?? null;
  if (!deploymentId) {
    try {
      const stored = await (input.storeDeployment ?? storeStudentAppDeployment)({
        bucket: input.bucket,
        supabase: input.supabase as unknown as Parameters<typeof storeStudentAppDeployment>[0]["supabase"],
        userId: sessionRes.data.started_by,
        boardId: input.boardId,
        wallId: input.wallId ?? null,
        cardId: input.cardId ?? null,
        classId: input.classId ?? null,
        sourceSubmissionId: input.submissionId,
        rawPayload: input.rawPayload,
      });
      if (!stored.ok) return { status: "needs_teacher_review" as const, blockingWarnings: [] };
      deploymentId = stored.deployment.id;
    } catch {
      return { status: "publish_failed" as const };
    }
  }

  try {
    const published = await (input.publishDeployment ?? publishStudentAppDeployment)({
      supabase: input.supabase as unknown as Parameters<typeof publishStudentAppDeployment>[0]["supabase"],
      userId: sessionRes.data.started_by,
      boardId: input.boardId,
      deploymentId,
    });
    return { status: "published" as const, deploymentId, publicUrl: published.deployment.publicUrl };
  } catch {
    return { status: "publish_failed" as const, deploymentId };
  }
}
