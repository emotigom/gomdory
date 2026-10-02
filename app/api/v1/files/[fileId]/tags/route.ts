import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { updateBoardFileMetadata } from "@/lib/data/boardFiles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { FILE_TAG_LIMIT, normalizeFileTags } from "@/lib/files/normalizeTags";

type Dependencies = {
  requireUserApiFn?: typeof requireUserApi;
  updateBoardFileMetadataFn?: typeof updateBoardFileMetadata;
};

type TagPayload = {
  add?: string[];
  remove?: string[];
};

function normalizeTags(input: string[]): { ok: true; tags: string[] } | { ok: false; error: string } {
  const normalized = normalizeFileTags(input);
  if (normalized.invalid) {
    return { ok: false, error: "태그는 최대 8개, 24자 이내로 입력해 주세요." };
  }
  return { ok: true, tags: normalized.tags };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> },
  deps?: Dependencies,
) {
  const ensureUser = deps?.requireUserApiFn ?? requireUserApi;
  const updateFile = deps?.updateBoardFileMetadataFn ?? updateBoardFileMetadata;
  const requestId = getOrCreateRequestId(request);

  let userId: string | null = null;
  try {
    const { user } = await ensureUser();
    userId = user.id;
  } catch {
    return jsonErrorWithRequestId("UNAUTHORIZED", "unauthorized", requestId, 401);
  }

  const payload = (await request.json().catch(() => null)) as TagPayload | null;
  const addInput = Array.isArray(payload?.add) ? payload?.add ?? [] : [];
  const removeInput = Array.isArray(payload?.remove) ? payload?.remove ?? [] : [];
  if (addInput.length === 0 && removeInput.length === 0) {
    return jsonErrorWithRequestId("INVALID_PAYLOAD", "invalid_payload", requestId, 400);
  }

  const normalizedAdd = normalizeTags(addInput);
  if (!normalizedAdd.ok) {
    return jsonErrorWithRequestId("INVALID_TAGS", normalizedAdd.error, requestId, 400);
  }
  const normalizedRemove = normalizeTags(removeInput);
  if (!normalizedRemove.ok) {
    return jsonErrorWithRequestId("INVALID_TAGS", normalizedRemove.error, requestId, 400);
  }

  try {
    const { fileId } = await params;
    const supabase = createSupabaseServerClient();
    const { data: fileRow, error: fileError } = await supabase
      .from("board_files")
      .select("tags")
      .eq("id", fileId)
      .eq("owner_id", userId ?? "")
      .maybeSingle();

    if (fileError || !fileRow) {
      throw new Error(fileError?.message ?? "파일 정보를 찾지 못했습니다.");
    }

    const current = Array.isArray(fileRow.tags) ? (fileRow.tags as string[]) : [];
    const working = new Set(current.map((tag) => tag.trim().toLowerCase()).filter(Boolean));
    normalizedAdd.tags.forEach((tag) => working.add(tag));
    normalizedRemove.tags.forEach((tag) => working.delete(tag));
    const nextTags = Array.from(working.values()).slice(0, FILE_TAG_LIMIT);
    if (nextTags.length > FILE_TAG_LIMIT) {
      return jsonErrorWithRequestId("TAG_LIMIT_EXCEEDED", "태그는 최대 8개까지 가능합니다.", requestId, 400);
    }

    const updated = await updateFile({
      fileId,
      ownerId: userId ?? "",
      tags: nextTags,
    });
    return jsonOkWithRequestId({ tags: updated.tags ?? [] }, requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "파일 태그를 저장하지 못했습니다.";
    return jsonErrorWithRequestId("TAG_UPDATE_FAILED", message, requestId, 400);
  }
}
