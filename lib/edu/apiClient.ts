"use client";

import { apiFetch } from "@/lib/http/apiFetch";
import { apiV1Path } from "@/lib/standards/pathTypes";

export type EduJoinResult =
  | { ok: true; anonId: string; name: string; shareCode: string; boardId: string | null }
  | { ok: false; message: string };

export type EduProgressResult = { ok: true } | { ok: false; message: string };
export type EduJoinSessionUpdateResult = { ok: true } | { ok: false; message: string };
export type EduJoinSessionCreateResult =
  | { ok: true; token: string; boardId: string | null }
  | { ok: false; message: string };

type EduJoinPayload = {
  shareCode: string;
  name: string;
  turnstileToken?: string | null;
};

type EduProgressPayload = {
  shareCode: string;
  completedLesson?: number;
  lastLesson?: number;
  publishedSlug?: string;
  anonId?: string | null;
};

type EduJoinSessionNicknamePayload = {
  token: string;
  nickname: string;
};

type EduJoinSessionCreatePayload = {
  shareCode: string;
  nickname?: string | null;
};

export async function joinEduClass(payload: EduJoinPayload): Promise<EduJoinResult> {
  try {
    const response = await apiFetch(apiV1Path("edu/class/join"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = (await response.json().catch(() => null)) as
      | { ok: true; anonId: string; name: string; shareCode: string; boardId: string | null }
      | { ok: false; error?: { message?: string } }
      | null;

    if (!response.ok || !data || !data.ok) {
      return {
        ok: false,
        message: data && "error" in data ? data.error?.message ?? "참여 등록에 실패했습니다." : "참여 등록에 실패했습니다.",
      };
    }

    return { ok: true, anonId: data.anonId, name: data.name, shareCode: data.shareCode, boardId: data.boardId ?? null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "참여 등록에 실패했습니다.";
    return { ok: false, message };
  }
}

export async function postEduProgress(payload: EduProgressPayload): Promise<EduProgressResult> {
  try {
    const response = await apiFetch(apiV1Path("edu/class/progress"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = (await response.json().catch(() => null)) as
      | { ok: true }
      | { ok: false; error?: { message?: string } }
      | null;

    if (!response.ok || !data || !data.ok) {
      return {
        ok: false,
        message: data && "error" in data ? data.error?.message ?? "진행 기록에 실패했습니다." : "진행 기록에 실패했습니다.",
      };
    }

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "진행 기록에 실패했습니다.";
    return { ok: false, message };
  }
}

export async function updateEduJoinSessionNickname(
  payload: EduJoinSessionNicknamePayload,
): Promise<EduJoinSessionUpdateResult> {
  try {
    const response = await apiFetch(apiV1Path("edu/join-session"), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = (await response.json().catch(() => null)) as
      | { ok: true }
      | { ok: false; error?: { message?: string } }
      | null;

    if (!response.ok || !data || !data.ok) {
      return {
        ok: false,
        message:
          data && "error" in data ? data.error?.message ?? "닉네임을 저장하지 못했습니다." : "닉네임을 저장하지 못했습니다.",
      };
    }

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "닉네임을 저장하지 못했습니다.";
    return { ok: false, message };
  }
}

export async function createEduJoinSession(
  payload: EduJoinSessionCreatePayload,
  options?: { signal?: AbortSignal; timeoutMs?: number },
): Promise<EduJoinSessionCreateResult> {
  try {
    const response = await apiFetch(apiV1Path("edu/join-session"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: options?.signal,
      timeoutMs: options?.timeoutMs,
    });

    const data = (await response.json().catch(() => null)) as
      | { ok: true; token: string; boardId?: string | null }
      | { ok: false; error?: { message?: string } }
      | null;

    if (!response.ok || !data || !data.ok) {
      return {
        ok: false,
        message:
          data && "error" in data ? data.error?.message ?? "입장 정보를 만들지 못했습니다." : "입장 정보를 만들지 못했습니다.",
      };
    }

    return { ok: true, token: data.token, boardId: data.boardId ?? null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "입장 정보를 만들지 못했습니다.";
    return { ok: false, message };
  }
}
