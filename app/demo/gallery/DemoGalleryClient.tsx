"use client";

import { useRouter } from "next/navigation";

import { ClassGallery2p5D } from "@/app/dashboard/_components/ClassGallery2p5D";

const demoItems = [
  {
    boardId: "demo-01",
    title: "AI 상상력 수업 · 챗봇과 이야기하기",
    heroFileId: "/demo/gallery/cover-1.svg",
    updatedAt: new Date().toISOString(),
  },
  {
    boardId: "demo-02",
    title: "세계 시민 프로젝트 · 환경 실험 기록",
    heroFileId: "/demo/gallery/cover-2.svg",
    updatedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    boardId: "demo-03",
    title: "문학 토론 · 인물 감정 지도 만들기",
    heroFileId: "/demo/gallery/cover-3.svg",
    updatedAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
  },
  {
    boardId: "demo-04",
    title: "경제 수업 · 뉴스 클리핑 벽",
    heroFileId: "/demo/gallery/cover-2.svg",
    updatedAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
  },
  {
    boardId: "demo-05",
    title: "과학 실험 · 데이터 시각화",
    heroFileId: "/demo/gallery/cover-1.svg",
    updatedAt: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
  },
  {
    boardId: "demo-06",
    title: "역사 수업 · 타임라인 스토리텔링",
    heroFileId: "/demo/gallery/cover-3.svg",
    updatedAt: new Date(Date.now() - 1000 * 60 * 540).toISOString(),
  },
  {
    boardId: "demo-07",
    title: "STEAM 챌린지 · 프로토타입 피드백",
    heroFileId: "/demo/gallery/cover-1.svg",
    updatedAt: new Date(Date.now() - 1000 * 60 * 720).toISOString(),
  },
  {
    boardId: "demo-08",
    title: "미술 감상 · 색채 분석 워크숍",
    heroFileId: "/demo/gallery/cover-2.svg",
    updatedAt: new Date(Date.now() - 1000 * 60 * 900).toISOString(),
  },
];

export function DemoGalleryClient() {
  const router = useRouter();

  return (
    <ClassGallery2p5D
      items={demoItems}
      onCreate={() => router.push("/auth/login?returnTo=/dashboard")}
    />
  );
}
