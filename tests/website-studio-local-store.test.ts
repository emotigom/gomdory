import assert from "node:assert/strict";
import test from "node:test";

import { createLocalWebsiteProjectFromTemplate, getLocalWebsiteProject, listLocalWebsiteProjects, saveLocalWebsiteProject } from "@/lib/website-studio/websiteStudioLocalStore";

test("local store is SSR safe", () => {
  assert.doesNotThrow(() => listLocalWebsiteProjects());
  assert.equal(getLocalWebsiteProject("missing"), null);
});

test("corrupt localStorage does not crash", () => {
  (globalThis as any).window = { localStorage: { getItem: () => "{bad json", setItem: () => undefined } };
  assert.doesNotThrow(() => listLocalWebsiteProjects());
});

test("template creates valid local project and can save/get", () => {
  const mem = new Map<string, string>();
  (globalThis as any).window = { localStorage: { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) } };
  const project = createLocalWebsiteProjectFromTemplate("self-intro-ko");
  assert.equal(project.id.startsWith("local_"), true);
  saveLocalWebsiteProject(project);
  assert.equal(getLocalWebsiteProject(project.id)?.id, project.id);
});
