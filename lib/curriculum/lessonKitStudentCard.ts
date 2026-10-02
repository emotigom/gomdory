import { getHtmlLessonKitById, getLessonKitStudentDownloads } from "@/lib/curriculum/lessonKitRegistry";

export function generateLessonKitStudentCardText(lessonId: string): string | undefined {
  const lessonKit = getHtmlLessonKitById(lessonId);
  if (!lessonKit?.studentCard) return undefined;

  const downloads = getLessonKitStudentDownloads(lessonId);
  if (!downloads?.zipUrl || downloads.files.length === 0) return undefined;

  const title = lessonKit.studentCard.displayTitle ?? lessonKit.title;
  const fallbackLinks = downloads.files.map((file) => `- ${file.label}: ${file.url}`).join("\n");
  const tasks = lessonKit.studentCard.tasks.map((task, index) => `${index + 1}. ${task}`).join("\n");

  return [
    `[오늘의 수업 자료] ${title}`,
    lessonKit.description,
    "",
    `[ZIP 다운로드] ${downloads.zipUrl}`,
    "ZIP 다운로드가 어렵다면 아래 개별 파일/코드 보기 링크를 이용하세요.",
    fallbackLinks,
    "",
    "[오늘 해야 할 일]",
    tasks,
    "",
    `[저장 위치] ${lessonKit.studentCard.saveLocation}`,
  ].join("\n");
}
