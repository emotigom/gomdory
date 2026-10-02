export type LessonLibraryResourceType = "html-presentation";

export type LessonLibraryResourceStatus = "draft" | "private" | "published";

export type LessonLibraryLearnPath = `/learn/${string}`;

export type LessonLibraryEntryUrl = `https://assets.gomdory.com/education-library/${string}/index.html`;

export type LessonLibraryResource = {
  id: string;
  title: string;
  description: string;
  lessonRange: string;
  type: LessonLibraryResourceType;
  learnPath: LessonLibraryLearnPath;
  entryUrl: LessonLibraryEntryUrl;
  status: LessonLibraryResourceStatus;
};

export const lessonLibraryRegistry = [
  {
    id: "ai-image-generation-11-12",
    title: "11~12차시 이미지 생성 AI 이론",
    description: "노이즈, 디퓨전, 프롬프트, 시드, 생성형 AI의 한계를 설명하는 발표 자료",
    lessonRange: "11~12차시",
    type: "html-presentation",
    learnPath: "/learn/ai-image-generation-11-12",
    entryUrl: "https://assets.gomdory.com/education-library/ai-image-generation-11-12/index.html",
    status: "published",
  },
] as const satisfies readonly LessonLibraryResource[];

export type LessonLibraryResourceId = (typeof lessonLibraryRegistry)[number]["id"];

export function getLessonLibraryResource(id: string): LessonLibraryResource | undefined {
  return lessonLibraryRegistry.find((resource) => resource.id === id);
}

export function getPublishedLessonLibraryResource(id: string): LessonLibraryResource | undefined {
  const resource = getLessonLibraryResource(id);
  return resource?.status === "published" ? resource : undefined;
}

export function getPublishedLessonLibraryResources(): readonly LessonLibraryResource[] {
  return lessonLibraryRegistry.filter((resource) => resource.status === "published");
}
