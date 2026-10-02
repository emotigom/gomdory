import assert from "node:assert/strict";
import test from "node:test";

import { listRevisions } from "@/lib/db/siteContentRevisions";
import { getSiteContentByKey, publishSiteContent, rollbackSiteContent } from "@/lib/site-content/server";

type SiteRow = {
  key: string;
  title: string;
  body: string;
  body_blocks: unknown[] | null;
  status: "draft" | "published";
  updated_at: string;
  published_at: string | null;
  publish_at: string | null;
  expires_at: string | null;
};

type RevisionRow = {
  id: string;
  key: string;
  title: string;
  body: string;
  body_blocks: unknown[] | null;
  status: "draft" | "published" | "rollback";
  created_at: string;
  note: string | null;
};

function createAdminStub() {
  const site = new Map<string, SiteRow>();
  const revisions: RevisionRow[] = [];
  let seq = 0;

  const from = (table: string) => {
    let eqField: string | null = null;
    let eqValue: string | null = null;
    let orderDesc = false;

    const chain = {
      select: (_columns?: string) => chain,
      eq: (field: string, value: string) => {
        eqField = field;
        eqValue = value;
        return chain;
      },
      order: (_field: string, opts?: { ascending?: boolean }) => {
        orderDesc = opts?.ascending === false;
        return chain;
      },
      limit: (n: number) => Promise.resolve({ data: getRows().slice(0, n), error: null }),
      maybeSingle: () => Promise.resolve({ data: getRows()[0] ?? null, error: null }),
      single: () => Promise.resolve({ data: getRows()[0] ?? null, error: null }),
      insert: (payload: Record<string, unknown>) => {
        if (table === "site_content_revisions") {
          revisions.push({
            id: `rev-${++seq}`,
            key: String(payload.key),
            title: String(payload.title ?? ""),
            body: String(payload.body ?? ""),
            body_blocks: (payload.body_blocks as unknown[] | null) ?? [],
            status: payload.status as RevisionRow["status"],
            created_at: new Date(Date.now() + seq).toISOString(),
            note: typeof payload.note === "string" ? payload.note : null,
          });
        }
        return chain;
      },
      upsert: (payload: Record<string, unknown>) => {
        if (table === "site_content") {
          site.set(String(payload.key), {
            key: String(payload.key),
            title: String(payload.title ?? ""),
            body: String(payload.body ?? ""),
            body_blocks: (payload.body_blocks as unknown[] | null) ?? [],
            status: payload.status as SiteRow["status"],
            updated_at: String(payload.updated_at),
            published_at: (payload.published_at as string | null) ?? null,
            publish_at: (payload.publish_at as string | null) ?? null,
            expires_at: (payload.expires_at as string | null) ?? null,
          });
        }
        return chain;
      },
    };

    const getRows = () => {
      if (table === "site_content") {
        let rows = Array.from(site.values());
        if (eqField === "key" && eqValue) rows = rows.filter((row) => row.key === eqValue);
        return rows;
      }
      if (table === "site_content_revisions") {
        let rows = [...revisions];
        if (eqField === "key" && eqValue) rows = rows.filter((row) => row.key === eqValue);
        if (eqField === "id" && eqValue) rows = rows.filter((row) => row.id === eqValue);
        if (orderDesc) rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
        return rows;
      }
      return [];
    };

    return chain;
  };

  return { admin: { from }, revisions, site };
}

test("publish writes revision + updates published snapshot", async () => {
  const stub = createAdminStub();
  const createFn = () => stub.admin as never;

  const result = await publishSiteContent("usage", { title: "T", body: "B" }, createFn as never);
  assert.ok(result);
  assert.equal(stub.revisions.length, 1);
  assert.equal(stub.revisions[0]?.status, "published");
  assert.equal(stub.site.get("usage")?.status, "published");
});

test("rollback updates published snapshot and adds rollback revision", async () => {
  const stub = createAdminStub();
  const createFn = () => stub.admin as never;

  await publishSiteContent("usage", { title: "v1", body: "one" }, createFn as never);
  await publishSiteContent("usage", { title: "v2", body: "two" }, createFn as never);
  const firstRevisionId = stub.revisions[0]!.id;

  const result = await rollbackSiteContent("usage", firstRevisionId, undefined, createFn as never);
  assert.ok(result);
  assert.equal(stub.revisions.at(-1)?.status, "rollback");
  assert.equal(stub.site.get("usage")?.title, "v1");
});

test("list ordering newest-first", async () => {
  const stub = createAdminStub();
  const createFn = () => stub.admin as never;

  await publishSiteContent("usage", { title: "a", body: "a" }, createFn as never);
  await publishSiteContent("usage", { title: "b", body: "b" }, createFn as never);

  const items = await listRevisions("usage", 20, createFn as never);
  assert.equal(items[0]?.title, "b");
  assert.equal(items[1]?.title, "a");
});

test("published snapshot is visible only within publish/expires window", async () => {
  const stub = createAdminStub();
  const createFn = () => stub.admin as never;
  const now = new Date();

  await publishSiteContent(
    "usage",
    {
      title: "window",
      body: "body",
      publishAt: new Date(now.getTime() + 60_000).toISOString(),
      expiresAt: new Date(now.getTime() + 120_000).toISOString(),
    },
    createFn as never,
  );

  const before = await getSiteContentByKey("usage", createFn as never);
  assert.equal(before, null);

  stub.site.set("usage", {
    ...stub.site.get("usage")!,
    publish_at: new Date(now.getTime() - 60_000).toISOString(),
    expires_at: new Date(now.getTime() + 60_000).toISOString(),
    body_blocks: [],
  });
  const active = await getSiteContentByKey("usage", createFn as never);
  assert.ok(active);

  stub.site.set("usage", {
    ...stub.site.get("usage")!,
    publish_at: new Date(now.getTime() - 120_000).toISOString(),
    expires_at: new Date(now.getTime() - 60_000).toISOString(),
    body_blocks: [],
  });
  const expired = await getSiteContentByKey("usage", createFn as never);
  assert.equal(expired, null);
});
