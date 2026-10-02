import "server-only";
import { createClient } from "@supabase/supabase-js";
import { validateSupabaseEnv } from "@/lib/server/env";
import { getCoursewareLessonByNumber } from "@/lib/edu/courseware/aiCoursewareSelectors";
import { generateJoinCode } from "./aiCoursewareJoinCode";
import type { CoursewareClassSessionRecord, CoursewareClassSessionSubmissionRecord } from "./aiCoursewareSessionTypes";

const k = "__cw_sessions__";

type MemoryStore = {
  sessions: Map<string, CoursewareClassSessionRecord>;
  submissions: Map<string, CoursewareClassSessionSubmissionRecord[]>;
};

type GlobalMemory = typeof globalThis & {
  [k]: MemoryStore | undefined;
};

const globalMemory = globalThis as GlobalMemory;
const mem: MemoryStore = globalMemory[k] ?? { sessions: new Map(), submissions: new Map() };
globalMemory[k] = mem;

type DbSessionRow = {
  id: string;
  join_code: string;
  title: string | null;
  day_number: number;
  lesson_numbers: number[];
  status: CoursewareClassSessionRecord["status"];
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  expires_at: string | null;
};

type DbSubmissionRow = {
  id: string;
  session_id: string;
  share_id: string;
  public_url: string;
  display_label: string;
  lesson_number: number;
  title_ko: string;
  note_ko: string | null;
  status: CoursewareClassSessionSubmissionRecord["status"];
  created_at: string;
  updated_at: string;
};

function db() {
  const env = validateSupabaseEnv({ requireAnonKey: false, requireServiceRoleKey: true });
  if (!env.ok || !env.serviceRoleKey) return null;
  return createClient(env.supabaseUrl, env.serviceRoleKey, { auth: { persistSession: false } });
}

function mapSessionRow(data: DbSessionRow): CoursewareClassSessionRecord {
  return {
    id: data.id,
    joinCode: data.join_code,
    title: data.title,
    dayNumber: data.day_number,
    lessonNumbers: data.lesson_numbers,
    status: data.status,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    closedAt: data.closed_at,
    expiresAt: data.expires_at,
  };
}

function mapSubmissionRow(data: DbSubmissionRow): CoursewareClassSessionSubmissionRecord {
  return {
    id: data.id,
    sessionId: data.session_id,
    shareId: data.share_id,
    publicUrl: data.public_url,
    displayLabel: data.display_label,
    lessonNumber: data.lesson_number,
    titleKo: data.title_ko,
    noteKo: data.note_ko,
    status: data.status,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function createClassSession(input: { dayNumber: number; title: string | null; lessonNumbers: number[] }) {
  const now = new Date().toISOString();
  const row: CoursewareClassSessionRecord = {
    id: crypto.randomUUID(),
    joinCode: generateJoinCode(),
    title: input.title,
    dayNumber: input.dayNumber,
    lessonNumbers: input.lessonNumbers,
    status: "active",
    createdAt: now,
    updatedAt: now,
    closedAt: null,
    expiresAt: null,
  };

  const client = db();
  if (!client) {
    mem.sessions.set(row.joinCode, row);
    return row;
  }

  const { data } = await client
    .from("courseware_class_sessions")
    .insert({
      join_code: row.joinCode,
      title: row.title,
      day_number: row.dayNumber,
      lesson_numbers: row.lessonNumbers,
      status: row.status,
    })
    .select("id,join_code,title,day_number,lesson_numbers,status,created_at,updated_at,closed_at,expires_at")
    .single();

  if (!data) return null;
  return mapSessionRow(data as DbSessionRow);
}

export async function getClassSessionByJoinCode(joinCode: string) {
  const client = db();
  const row: CoursewareClassSessionRecord | DbSessionRow | null = !client
    ? (mem.sessions.get(joinCode) ?? null)
    : ((await client
        .from("courseware_class_sessions")
        .select("id,join_code,title,day_number,lesson_numbers,status,created_at,updated_at,closed_at,expires_at")
        .eq("join_code", joinCode)
        .maybeSingle()).data as DbSessionRow | null);

  if (!row) return null;

  const session = client ? mapSessionRow(row as DbSessionRow) : (row as CoursewareClassSessionRecord);
  const lessons = session.lessonNumbers
    .map((n: number) => getCoursewareLessonByNumber(n))
    .filter((lesson): lesson is NonNullable<typeof lesson> => Boolean(lesson))
    .map((lesson) => ({
      lessonNumber: lesson.lessonNumber,
      titleKo: lesson.titleKo,
      artifactLabelKo: lesson.artifact.labelKo,
    }));

  return { session, lessons };
}

export async function submitClassSessionLink(sub: Omit<CoursewareClassSessionSubmissionRecord, "id" | "createdAt" | "updatedAt">) {
  const now = new Date().toISOString();
  const row: CoursewareClassSessionSubmissionRecord = {
    ...sub,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };

  const client = db();
  if (!client) {
    const arr = mem.submissions.get(sub.sessionId) ?? [];
    arr.unshift(row);
    mem.submissions.set(sub.sessionId, arr);
    return row;
  }

  const { data } = await client
    .from("courseware_class_session_submissions")
    .insert({
      session_id: sub.sessionId,
      share_id: sub.shareId,
      public_url: sub.publicUrl,
      display_label: sub.displayLabel,
      lesson_number: sub.lessonNumber,
      title_ko: sub.titleKo,
      note_ko: sub.noteKo,
      status: sub.status,
    })
    .select("id,session_id,share_id,public_url,display_label,lesson_number,title_ko,note_ko,status,created_at,updated_at")
    .single();

  if (!data) return null;
  return mapSubmissionRow(data as DbSubmissionRow);
}

export async function listSessionSubmissions(sessionId: string) {
  const client = db();
  if (!client) return mem.submissions.get(sessionId) ?? [];

  const { data } = await client
    .from("courseware_class_session_submissions")
    .select("id,session_id,share_id,public_url,display_label,lesson_number,title_ko,note_ko,status,created_at,updated_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false });

  return (data as DbSubmissionRow[] | null)?.map(mapSubmissionRow) ?? [];
}
