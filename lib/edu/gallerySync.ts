import "server-only";

import { getLessonIdFromNumber } from "@/lib/edu/lesson/lessonLock";
import { toSnakeKeys } from "@/lib/standards/fields";
import { EDU_COLUMNS, EDU_TABLES } from "@/lib/standards/eduDb";
import { createSupabaseAdminClient, type Database } from "@/lib/supabase/admin";
import { readEduviewOrigin } from "@/lib/env/appConfig";

type EduGalleryUpsertInput = {
  classCode: string;
  viewId: string;
  title: string;
  authorName: string;
  lessonId: number | null;
};

type EnsureGalleryResult = {
  inserted: boolean;
};

type GallerySyncDependencies = {
  createSupabaseAdminClientFn?: typeof createSupabaseAdminClient;
};

function buildPreviewUrl(viewId: string) {
  const publicOrigin = readEduviewOrigin();
  return `${publicOrigin}/v1/${viewId}/thumb.png`;
}

function getLessonKeyFromId(lessonId: number | null) {
  if (!lessonId) return null;
  return getLessonIdFromNumber(lessonId);
}

export async function upsertEduGalleryEntry(
  input: EduGalleryUpsertInput,
  deps?: GallerySyncDependencies,
) {
  const supabase = (deps?.createSupabaseAdminClientFn ?? createSupabaseAdminClient)();
  const payload = toSnakeKeys({
    classCode: input.classCode,
    viewId: input.viewId,
    lessonKey: getLessonKeyFromId(input.lessonId),
    title: input.title,
    authorName: input.authorName,
    previewUrl: buildPreviewUrl(input.viewId),
  }) as Database["public"]["Tables"]["edu_gallery"]["Insert"];

  const { error } = await supabase
    .from(EDU_TABLES.gallery)
    .upsert(payload, { onConflict: EDU_COLUMNS.viewId });

  if (error) {
    throw new Error(error.message);
  }
}

export async function ensureEduGalleryEntryForSlug(
  slug: string,
  deps?: GallerySyncDependencies,
): Promise<EnsureGalleryResult> {
  const supabase = (deps?.createSupabaseAdminClientFn ?? createSupabaseAdminClient)();
  const { data: existing, error: existingError } = await supabase
    .from(EDU_TABLES.gallery)
    .select(EDU_COLUMNS.viewId)
    .eq(EDU_COLUMNS.viewId, slug)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing) {
    return { inserted: false };
  }

  const { data: project, error: projectError } = await supabase
    .from(EDU_TABLES.projects)
    .select("share_code, title, author_name, lesson_id, created_at")
    .eq(EDU_COLUMNS.slug, slug)
    .maybeSingle();

  if (projectError) {
    throw new Error(projectError.message);
  }

  if (!project?.share_code) {
    return { inserted: false };
  }

  const { data: stats } = await supabase
    .from(EDU_TABLES.projectStats)
    .select(EDU_COLUMNS.viewCount)
    .eq(EDU_COLUMNS.slug, slug)
    .maybeSingle();

  const payload = toSnakeKeys({
    classCode: project.share_code,
    viewId: slug,
    lessonKey: getLessonKeyFromId((project.lesson_id as number | null) ?? null),
    title: project.title,
    authorName: project.author_name,
    previewUrl: buildPreviewUrl(slug),
    createdAt: project.created_at,
    viewCount: Number(stats?.[EDU_COLUMNS.viewCount] ?? 0),
  }) as Database["public"]["Tables"]["edu_gallery"]["Insert"];

  const { error } = await supabase.from(EDU_TABLES.gallery).insert(payload);

  if (error) {
    throw new Error(error.message);
  }

  return { inserted: true };
}

export function getLessonIdFromKey(lessonKey: string | null | undefined): number | null {
  if (lessonKey === "P1") return 1;
  if (lessonKey === "P2") return 2;
  if (lessonKey === "P3") return 3;
  if (lessonKey === "P4") return 4;
  return null;
}
