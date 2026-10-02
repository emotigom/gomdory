import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requireUserApi() {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      throw new Error("unauthorized");
    }

    return { user: data.user };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("`cookies` was called outside a request scope")) {
      throw new Error("unauthorized");
    }
    throw error;
  }
}
