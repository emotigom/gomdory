import { NextResponse } from "next/server";

import { requireUserApi } from "@/lib/auth/requireUserApi";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type WaitlistDeps = {
  requireUserApiFn?: typeof requireUserApi;
  createSupabaseAdminClientFn?: typeof createSupabaseAdminClient;
};

function jsonError(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export async function POST(_request: Request, _context: unknown, deps?: WaitlistDeps) {
  const requireUser = deps?.requireUserApiFn ?? requireUserApi;

  let user;
  try {
    ({ user } = await requireUser());
  } catch {
    return jsonError("unauthorized", "인증이 필요합니다.", 401);
  }

  const email = user.email;
  if (!email) {
    return jsonError("missing_email", "이메일 정보가 필요합니다.");
  }

  const admin = (deps?.createSupabaseAdminClientFn ?? createSupabaseAdminClient)();
  const { error } = await admin
    .from("pro_waitlist")
    .insert({ user_id: user.id, email })
    .select("id")
    .maybeSingle();

  if (error && !error.message.includes("duplicate key value")) {
    return jsonError("waitlist_insert_failed", error.message, 502);
  }

  return NextResponse.json({ ok: true });
}
