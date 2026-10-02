import type { EduLessonOpenSourceAdapter } from "@/lib/edu/courseware/lessonRuntime/lessonRuntimeTypes";

const ADAPTERS: Record<string, EduLessonOpenSourceAdapter> = {
  sandpack: { id: "sandpack", packageName: "@codesandbox/sandpack-react", lazy: true, fallbackSafe: true, license: "MIT", status: "planned" },
  tiptap: { id: "tiptap", packageName: "@tiptap/react", lazy: true, fallbackSafe: true, license: "MIT", status: "planned" },
  mermaid: { id: "mermaid", packageName: "mermaid", lazy: true, fallbackSafe: true, license: "MIT", status: "planned" },
  h5p_style: { id: "h5p_style", lazy: true, fallbackSafe: true, status: "planned" },
};

export function listCoursewareOpenSourceAdapters(): EduLessonOpenSourceAdapter[] {
  return Object.values(ADAPTERS).map((item) => ({ ...item }));
}

export function getCoursewareOpenSourceAdapter(id: string): EduLessonOpenSourceAdapter | null {
  const item = ADAPTERS[id];
  return item ? { ...item } : null;
}
