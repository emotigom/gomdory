import "server-only";

import { createClient } from "@supabase/supabase-js";

import { validateSupabaseEnv } from "@/lib/server/env";

import type { CoursewarePublishedSnapshot } from "./aiCoursewarePublishTypes";

const key = "__courseware_publish_snapshots__";

type GlobalStore = typeof globalThis & {
  [key]: Map<string, CoursewarePublishedSnapshot> | undefined;
};

const globalStore = globalThis as GlobalStore;
const store = globalStore[key] ?? new Map<string, CoursewarePublishedSnapshot>();
globalStore[key] = store;

const TABLE = "courseware_published_snapshots";

export const isCoursewarePublishWriteEnabled = () => process.env.COURSEWARE_PUBLIC_PUBLISH_ENABLED === "1";

function getServiceClient() {
  const env = validateSupabaseEnv({ requireAnonKey: false, requireServiceRoleKey: true });
  if (!env.ok || !env.serviceRoleKey) return null;
  return createClient(env.supabaseUrl, env.serviceRoleKey, { auth: { persistSession: false } });
}

export async function savePublishedSnapshot(snapshot: CoursewarePublishedSnapshot) {
  if (!isCoursewarePublishWriteEnabled()) return null;
  const client = getServiceClient();
  if (!client) {
    if (process.env.NODE_ENV !== "production") {
      store.set(snapshot.shareId, snapshot);
      return snapshot;
    }
    return null;
  }
  const { data, error } = await client.from(TABLE).insert({
    share_id: snapshot.shareId,
    title: snapshot.titleKo,
    description: snapshot.descriptionKo ?? null,
    lesson_number: snapshot.lessonNumber ?? null,
    artifact_label: snapshot.artifactLabelKo ?? null,
    snapshot_json: snapshot,
    renderer_version: snapshot.rendererVersion,
    visibility: snapshot.visibility,
    noindex: snapshot.noindex,
  }).select("snapshot_json").single();
  if (error) return null;
  return (data?.snapshot_json as CoursewarePublishedSnapshot) ?? null;
}

export async function getPublishedSnapshot(shareId: string) {
  const client = getServiceClient();
  if (!client) return store.get(shareId) ?? null;
  const { data } = await client.from(TABLE).select("snapshot_json, revoked_at, visibility").eq("share_id", shareId).maybeSingle();
  if (!data || data.revoked_at || data.visibility !== "link-public") return null;
  return data.snapshot_json as CoursewarePublishedSnapshot;
}
