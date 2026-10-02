type QueryError = { message?: string } | null;

type BoardRow = { id: string; owner_id: string };
const STUDENT_APP_PUBLIC_BASE_URL = "https://eduview.gkrry.com";

type DeploymentRow = {
  id: string;
  board_id: string;
  card_id: string | null;
  title: string;
  slug: string;
  version: number;
  status: string;
  file_count: number;
  total_size_bytes: number;
  entry_file: string;
  created_at: string;
  stored_at: string | null;
  approved_at: string | null;
  published_at: string | null;
  archived_at: string | null;
};

type QueryResult<T> = Promise<{ data: T | null; error: QueryError }>;
type SupabaseLike = {
  from: (table: string) => {
    select: (query: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => QueryResult<BoardRow>;
        is: (column: string, value: null) => {
          order: (column: string, options: { ascending: boolean }) => {
            limit: (value: number) => Promise<{ data: DeploymentRow[] | null; error: QueryError }>;
          };
        };
      };
    };
  };
};

type ErrorWithCode = Error & { code?: string };
const makeCodedError = (message: string, code: string): ErrorWithCode => {
  const err = new Error(message) as ErrorWithCode;
  err.code = code;
  return err;
};

export async function listStudentAppDeployments(input: { supabase: SupabaseLike; userId: string; boardId: string; limit?: number }) {
  const clampedLimit = Math.max(1, Math.min(input.limit ?? 20, 50));

  const boardRes = await input.supabase.from("boards").select("id, owner_id").eq("id", input.boardId).maybeSingle();
  if (boardRes.error) throw makeCodedError("storage_schema_unavailable", "storage_schema_unavailable");
  if (!boardRes.data || boardRes.data.owner_id !== input.userId) throw makeCodedError("forbidden_board", "forbidden_board");

  const listRes = await input.supabase
    .from("student_app_deployments")
    .select("id, board_id, card_id, title, slug, version, status, file_count, total_size_bytes, entry_file, created_at, stored_at, approved_at, published_at, archived_at")
    .eq("board_id", input.boardId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(clampedLimit);

  if (listRes.error) throw makeCodedError("storage_schema_unavailable", "storage_schema_unavailable");

  return {
    ok: true as const,
    deployments: (listRes.data ?? []).map((row) => ({
      id: row.id,
      boardId: row.board_id,
      cardId: row.card_id,
      title: row.title,
      slug: row.slug,
      version: row.version,
      status: row.status,
      fileCount: row.file_count,
      totalSizeBytes: row.total_size_bytes,
      entryFile: row.entry_file,
      createdAt: row.created_at,
      storedAt: row.stored_at,
      approvedAt: row.approved_at,
      publishedAt: row.published_at,
      archivedAt: row.archived_at,
      publicUrl: row.status === "published" && row.published_at ? `${STUDENT_APP_PUBLIC_BASE_URL}/apps/${row.id}/` : null,
    })),
  };
}
