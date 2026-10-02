import type { GalleryItem } from "@/lib/gallery/getClassGalleryItems";

function createTextCover(key: string, type: GalleryItem["type"], title: string, subtitle: string): GalleryItem {
  return {
    id: `${type}-${key}`,
    type,
    title,
    subtitle,
    thumbUrl: null,
    primaryHref: "/dashboard",
    secondaryHref: "/dashboard/classes",
    primaryLabel: type === "board" ? "보드 열기" : type === "clip" ? "클립 열기" : "세션 열기",
    secondaryLabel: type === "board" ? "수업 시작" : "리포트",
    coverKey: key,
    createdAt: new Date().toISOString(),
  };
}

export function getDemoGalleryItems(classTitle: string): GalleryItem[] {
  return [
    createTextCover("demo-clip", "clip", "샘플 하이라이트 클립", `${classTitle} · 09:10 ~ 09:25`),
    createTextCover("demo-board", "board", "창의력 보드", "AI & 미디어 리터러시"),
    createTextCover("demo-session", "session", "프로젝트 피드백 세션", "학기말 전시 · 6개 팀"),
    createTextCover("demo-clip-2", "clip", "학생 발표 포인트", `${classTitle} · 4K 캡쳐`),
    createTextCover("demo-board-2", "board", "실험 노트 정리", "과학 실험 · 오늘"),
    createTextCover("demo-session-2", "session", "주간 리플렉션", "포커스 질문 3개"),
  ];
}
