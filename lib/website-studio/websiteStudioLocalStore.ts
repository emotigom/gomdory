import { WEBSITE_STUDIO_TEMPLATES } from "@/lib/website-studio/websiteStudioTemplates";
import type { WebsiteStudioProject, WebsiteStudioTemplate } from "@/lib/website-studio/websiteStudioTypes";

const STORAGE_KEY = "gomdory.websiteStudio.localDrafts.v1";

type DraftStore = Record<string, WebsiteStudioProject>;

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readStore(): DraftStore {
  if (!canUseStorage()) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed as DraftStore : {};
  } catch {
    return {};
  }
}

function writeStore(store: DraftStore) {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // noop
  }
}

function cloneTemplate(template: WebsiteStudioTemplate, id: string, now: string, origin?: Pick<WebsiteStudioProject, "originBoardId" | "originSource" | "originDay">): WebsiteStudioProject {
  return {
    id,
    title: template.name,
    templateId: template.id,
    theme: structuredClone(template.theme),
    pages: structuredClone(template.starterPages),
    createdAt: now,
    updatedAt: now,
    ...(origin ?? {}),
  };
}

export function createLocalWebsiteProjectFromTemplate(templateId: string, origin?: Pick<WebsiteStudioProject, "originBoardId" | "originSource" | "originDay">): WebsiteStudioProject {
  const template = WEBSITE_STUDIO_TEMPLATES.find((item) => item.id === templateId) ?? WEBSITE_STUDIO_TEMPLATES[0];
  const id = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return cloneTemplate(template, id, new Date().toISOString(), origin);
}

export function saveLocalWebsiteProject(project: WebsiteStudioProject) {
  const store = readStore();
  store[project.id] = project;
  writeStore(store);
}

export function updateLocalWebsiteProject(project: WebsiteStudioProject) {
  saveLocalWebsiteProject({ ...project, updatedAt: new Date().toISOString() });
}

export function getLocalWebsiteProject(projectId: string): WebsiteStudioProject | null {
  const store = readStore();
  return store[projectId] ?? null;
}

export function listLocalWebsiteProjects(): WebsiteStudioProject[] {
  return Object.values(readStore()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export { STORAGE_KEY as WEBSITE_STUDIO_LOCAL_DRAFTS_KEY };

export function deleteLocalWebsiteProject(projectId: string) {
  const store = readStore();
  delete store[projectId];
  writeStore(store);
}
