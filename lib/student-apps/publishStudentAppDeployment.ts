const STUDENT_APP_PUBLIC_BASE_URL = "https://eduview.gkrry.com";

type QueryError = { message?: string } | null;
type BoardRow = { id: string; owner_id: string };
type DeploymentRow = {
  id: string; board_id: string; title: string; slug: string; version: number; status: string; file_count: number; total_size_bytes: number; entry_file: string; published_at: string | null;
};

type SupabaseQueryBuilder = {
  select: (columns: string) => SupabaseQueryBuilder;
  eq: (column: string, value: string) => SupabaseQueryBuilder;
  is: (column: string, value: null) => SupabaseQueryBuilder;
  maybeSingle: () => Promise<unknown>;
  update: (values: Record<string, unknown>) => SupabaseQueryBuilder;
};

type SupabaseLike = { from: (table: string) => SupabaseQueryBuilder };
type ErrorWithCode = Error & { code?: string };
const coded = (code: string) => { const e = new Error(code) as ErrorWithCode; e.code = code; return e; };
const publicUrlFor = (id: string) => `${STUDENT_APP_PUBLIC_BASE_URL}/apps/${id}/`;

async function verifyBoardOwner(input: { supabase: SupabaseLike; boardId: string; userId: string }) {
  const boardRes = await input.supabase.from("boards").select("id, owner_id").eq("id", input.boardId).maybeSingle() as { data: BoardRow | null; error: QueryError };
  if (boardRes.error) throw coded("storage_schema_unavailable");
  if (!boardRes.data || boardRes.data.owner_id !== input.userId) throw coded("forbidden_board");
}

async function loadDeployment(input: { supabase: SupabaseLike; boardId: string; deploymentId: string }) {
  const depRes = await input.supabase.from("student_app_deployments").select("id, board_id, title, slug, version, status, file_count, total_size_bytes, entry_file, published_at").eq("id", input.deploymentId).eq("board_id", input.boardId).is("deleted_at", null).maybeSingle() as { data: DeploymentRow | null; error: QueryError };
  if (depRes.error) throw coded("storage_schema_unavailable");
  if (!depRes.data) throw coded("deployment_not_found");
  return depRes.data;
}

export async function publishStudentAppDeployment(input: { supabase: SupabaseLike; userId: string; boardId: string; deploymentId: string }) {
  await verifyBoardOwner(input);
  const row = await loadDeployment(input);
  if (!["stored", "approved", "published"].includes(row.status)) throw coded("deployment_not_publishable");
  const now = new Date().toISOString();
  const nextPublishedAt = row.published_at ?? now;
  const updateRes = await input.supabase.from("student_app_deployments").update({ status: "published", published_at: nextPublishedAt, updated_at: now }).eq("id", row.id).eq("board_id", input.boardId).select("id, board_id, title, slug, version, status, file_count, total_size_bytes, entry_file, published_at").maybeSingle() as { data: DeploymentRow | null; error: QueryError };
  if (updateRes.error || !updateRes.data) throw coded("storage_schema_unavailable");
  const d = updateRes.data;
  return { ok: true as const, deployment: { id: d.id, boardId: d.board_id, title: d.title, slug: d.slug, version: d.version, status: d.status, fileCount: d.file_count, totalSizeBytes: d.total_size_bytes, entryFile: d.entry_file, publishedAt: d.published_at, publicUrl: publicUrlFor(d.id) } };
}

export async function unpublishStudentAppDeployment(input: { supabase: SupabaseLike; userId: string; boardId: string; deploymentId: string }) {
  await verifyBoardOwner(input);
  const row = await loadDeployment(input);
  if (row.status !== "published") throw coded("deployment_not_publishable");
  const now = new Date().toISOString();
  const updateRes = await input.supabase.from("student_app_deployments").update({ status: "stored", published_at: null, updated_at: now }).eq("id", row.id).eq("board_id", input.boardId).select("id, board_id, status, published_at").maybeSingle() as { data: { id: string; board_id: string; status: string; published_at: null } | null; error: QueryError };
  if (updateRes.error || !updateRes.data) throw coded("storage_schema_unavailable");
  return { ok: true as const, deployment: { id: updateRes.data.id, boardId: updateRes.data.board_id, status: updateRes.data.status, publishedAt: null } };
}
