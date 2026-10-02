import { isLabsVrWorldEnabled } from "@/lib/labs/flags";
import { getLabsShowcaseFeed, type ShowcaseItem } from "@/lib/labs/showcaseFeed.server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readSupabaseCanonicalClientEnvReady } from "@/lib/env/appConfig";

import WorldClient from "./WorldClient";

export default async function LabsWorldPage() {
  if (!isLabsVrWorldEnabled()) {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-6 py-16">
        <div data-testid="labs-vr-world-disabled" />
        <h1 className="text-2xl font-semibold text-neutral-900">VR World (Labs)</h1>
        <p className="text-sm text-neutral-600">현재 비활성 상태입니다.</p>
      </main>
    );
  }

  let initialItems: ShowcaseItem[] = [];
  const envReady = readSupabaseCanonicalClientEnvReady();

  if (envReady) {
    try {
      const supabase = createSupabaseServerClient();
      const { data: auth } = await supabase.auth.getUser();
      initialItems = [...(await getLabsShowcaseFeed(auth.user?.id))];
    } catch {
      initialItems = [];
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-6 py-16">
      <div data-testid="labs-vr-world-enabled" />
      <h1 className="text-2xl font-semibold text-neutral-900">VR World (Labs)</h1>
      <WorldClient initialItems={initialItems} />
    </main>
  );
}
