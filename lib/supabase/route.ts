import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

import { validateSupabaseEnv } from "@/lib/server/env";

type SupabaseValidationError = Exclude<ReturnType<typeof validateSupabaseEnv>, { ok: true }>;

export type SupabaseRouteClientResult = {
  supabase: ReturnType<typeof createServerClient> | null;
  applyCookies: <T extends NextResponse>(response: T) => T;
  envError: SupabaseValidationError | null;
};

export function createSupabaseRouteClient(req: NextRequest): SupabaseRouteClientResult {
  const validation = validateSupabaseEnv();

  const requestCookies = new Map(
    req.cookies.getAll().map((cookie) => [cookie.name, cookie.value]),
  );

  const pendingCookies = new Map<
    string,
    { name: string; value: string; options?: CookieOptions }
  >();

  const applyCookies = <T extends NextResponse>(response: T) => {
    pendingCookies.forEach((cookie) => {
      response.cookies.set({ name: cookie.name, value: cookie.value, ...(cookie.options ?? {}) });
    });
    return response;
  };

  if (!validation.ok) {
    return { supabase: null, applyCookies, envError: validation };
  }

  const supabase = createServerClient(validation.supabaseUrl, validation.supabaseAnonKey!, {
    cookies: {
      async getAll() {
        return Array.from(requestCookies.entries()).map(([name, value]) => ({ name, value }));
      },
      async setAll(cookies: { name: string; value: string; options?: CookieOptions }[]) {
        cookies.forEach((cookie) => {
          pendingCookies.set(cookie.name, cookie);
          if (cookie.value) {
            requestCookies.set(cookie.name, cookie.value);
          } else {
            requestCookies.delete(cookie.name);
          }
        });
      },
    },
  });

  return { supabase, applyCookies, envError: null };
}
