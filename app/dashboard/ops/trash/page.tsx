export const dynamic = "force-dynamic";

import { getTrashSnapshot, restoreTrashItem, runOpsTrashPurgeAction } from "./actions";

type SearchParams = Promise<{ tab?: string }>;

function normalizeTab(tab?: string): "boards" | "cards" | "files" {
  if (tab === "cards" || tab === "files") return tab;
  return "boards";
}

export default async function OpsTrashPage({ searchParams }: { searchParams: SearchParams }) {
  const resolved = await searchParams;
  const activeTab = normalizeTab(resolved.tab);
  const snapshot = await getTrashSnapshot();

  const items = activeTab === "boards" ? snapshot.boards : activeTab === "cards" ? snapshot.cards : snapshot.files;

  return (
    <main className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h1 className="text-lg font-semibold text-slate-900">Trash Restore</h1>
        <p className="text-sm text-slate-600">최근 삭제된 보드/카드/파일 50개를 복구할 수 있습니다.</p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <a className={`rounded-lg border px-3 py-1.5 ${activeTab === "boards" ? "border-slate-900" : "border-slate-200"}`} href="?tab=boards">boards</a>
          <a className={`rounded-lg border px-3 py-1.5 ${activeTab === "cards" ? "border-slate-900" : "border-slate-200"}`} href="?tab=cards">cards</a>
          <a className={`rounded-lg border px-3 py-1.5 ${activeTab === "files" ? "border-slate-900" : "border-slate-200"}`} href="?tab=files">files</a>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <form
            action={async () => {
              "use server";
              await runOpsTrashPurgeAction({ dryRun: true });
            }}
          >
            <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700">지금 정리(드라이런)</button>
          </form>
          <form
            action={async () => {
              "use server";
              await runOpsTrashPurgeAction({ dryRun: false });
            }}
          >
            <button className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700">지금 정리(실행)</button>
          </form>
        </div>
      </section>

      {snapshot.warnings.length > 0 ? (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          {snapshot.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </section>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
              <div>
                <p className="font-medium text-slate-900">{item.title}</p>
                <p className="text-xs text-slate-500">{item.id} · {item.deletedAt}</p>
                {item.deletedPurgeAt ? (
                  <p className="mt-1 inline-flex rounded-md bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700">자동 삭제 예정일: {item.deletedPurgeAt}</p>
                ) : null}
              </div>
              <form
                action={async () => {
                  "use server";
                  await restoreTrashItem({ tab: activeTab, id: item.id });
                }}
              >
                <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700">Restore</button>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
