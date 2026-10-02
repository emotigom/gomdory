export const dynamic = "force-dynamic";

import { requireUser } from "@/lib/auth/requireUser";
import { routes } from "@/lib/standards/routes";

import FirstLessonWizard from "./FirstLessonWizard";

type SearchParams = Record<string, string | string[] | undefined>;

function parseStep(searchParams: SearchParams | undefined): number {
  const raw = searchParams?.step;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const num = Number(value);
  if (Number.isNaN(num) || num < 1 || num > 3) return 1;
  return Math.floor(num);
}

export default async function FirstLessonPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  await requireUser(routes.page.dashboard.firstLesson());
  const resolved = (await searchParams) ?? {};
  const initialStep = parseStep(resolved);

  return (
    <main data-page-marker="dashboard-first-lesson" className="min-h-screen bg-slate-50">
      <FirstLessonWizard initialStep={initialStep} />
    </main>
  );
}
