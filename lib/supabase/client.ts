import { createClient, type AuthChangeEvent, type SupabaseClient } from "@supabase/supabase-js";

import { validateSupabaseEnv } from "@/lib/server/env";

let browserClient: SupabaseClient | null = null;

export function createSupabaseBrowserClient(): SupabaseClient | null {
  if (typeof window === "undefined") {
    return null;
  }

  if (browserClient) {
    return browserClient;
  }

  const validation = validateSupabaseEnv();

  if (!validation.ok) {
    console.warn(validation.message);
    return null;
  }

  browserClient = createClient(validation.supabaseUrl, validation.supabaseAnonKey!, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });

  return browserClient;
}

export async function setSupabaseBrowserSession(tokens: {
  accessToken: string;
  refreshToken: string;
}): Promise<{ error: Error | null }> {
  const supabase = createSupabaseBrowserClient();

  if (!supabase) {
    return { error: new Error("Supabase client is not available.") };
  }

  const { error } = await supabase.auth.setSession({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
  });

  return { error: error ?? null };
}

export async function getSupabaseBrowserAccessToken(): Promise<string | null> {
  const supabase = createSupabaseBrowserClient();

  if (!supabase) {
    return null;
  }

  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export function subscribeSupabaseBrowserAuthState(
  callback: (event: AuthChangeEvent, accessToken: string | null) => void,
): { unsubscribe: () => void } | null {
  const supabase = createSupabaseBrowserClient();

  if (!supabase) {
    return null;
  }

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session?.access_token ?? null);
  });

  return subscription;
}
