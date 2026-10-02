import "server-only";

import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

import { validateSupabaseEnv } from "@/lib/server/env";

type PendingCookie = { name: string; value: string; options?: CookieOptions };

type SupabaseServerClientOptions = {
  authorization?: string | null;
};

export function createSupabaseServerClient(options: SupabaseServerClientOptions = {}) {
  const validation = validateSupabaseEnv();

  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const authorization = options.authorization?.trim();

  const cookieStorePromise = cookies();
  const requestCookiesPromise = cookieStorePromise.then((cookieStore) => {
    return new Map(cookieStore.getAll().map((cookie) => [cookie.name, cookie.value]));
  });

  return createServerClient(validation.supabaseUrl, validation.supabaseAnonKey!, {
    ...(authorization ? { global: { headers: { Authorization: authorization } } } : {}),
    cookies: {
      async getAll() {
        const requestCookies = await requestCookiesPromise;
        return Array.from(requestCookies.entries()).map(([name, value]) => ({ name, value }));
      },
      async setAll(cookieList: { name: string; value: string; options?: CookieOptions }[]) {
        const [cookieStore, requestCookies] = await Promise.all([
          cookieStorePromise,
          requestCookiesPromise,
        ]);
        cookieList.forEach(({ name, value, options }) => {
          if (value) {
            requestCookies.set(name, value);
          } else {
            requestCookies.delete(name);
          }
          cookieStore.set({ name, value, ...(options ?? {}) });
        });
      },
    },
  });
}

export async function createSupabaseServerActionClient() {
  const validation = validateSupabaseEnv();

  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const cookieStore = await cookies();
  const requestCookies = new Map(cookieStore.getAll().map((cookie) => [cookie.name, cookie.value]));
  const pendingCookies = new Map<string, PendingCookie>();

  const supabase = createServerClient(validation.supabaseUrl, validation.supabaseAnonKey!, {
    cookies: {
      async getAll() {
        return Array.from(requestCookies.entries()).map(([name, value]) => ({ name, value }));
      },
      async setAll(cookieList: PendingCookie[]) {
        cookieList.forEach((cookie) => {
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

  const applyCookies = async () => {
    pendingCookies.forEach((cookie) => {
      cookieStore.set({ name: cookie.name, value: cookie.value, ...(cookie.options ?? {}) });
    });
  };

  return { supabase, applyCookies, cookieStore };
}
