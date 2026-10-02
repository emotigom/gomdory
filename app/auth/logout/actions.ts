"use server";

import { redirect } from "next/navigation";

import { logAudit } from "@/lib/data/audit";
import { createSupabaseServerActionClient } from "@/lib/supabase/server";

export async function logoutAction() {
  const { supabase, applyCookies } = await createSupabaseServerActionClient();

  void logAudit({ action: "auth.logout" });
  await supabase.auth.signOut();
  await applyCookies();

  redirect("/");
}
