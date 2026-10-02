import "server-only";

import { isOpsAdmin } from "@/lib/auth/opsAdmin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getCurrentUserOpsAdmin(): Promise<boolean> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error) return false;
    return isOpsAdmin(data.user?.email ?? null);
  } catch {
    return false;
  }
}

