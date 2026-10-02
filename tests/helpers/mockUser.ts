import type { User } from "@supabase/auth-js";

export const makeMockUser = (overrides: Partial<User> = {}): User => ({
  id: overrides.id ?? "user-1",
  app_metadata: overrides.app_metadata ?? {},
  user_metadata: overrides.user_metadata ?? {},
  aud: overrides.aud ?? "authenticated",
  created_at: overrides.created_at ?? new Date(0).toISOString(),
  ...overrides,
});
