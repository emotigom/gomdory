import type { ReactNode } from "react";
import type { Metadata } from "next";
import EduHeader from "./_components/EduHeader";
import TeacherDebugPanel from "./_components/TeacherDebugPanel";
import P2PBootstrap from "./_components/P2PBootstrap";
import "./edu.css";

export const metadata: Metadata = {
  title: {
    default: "곰도리에듀 수업 참여 | AI·코딩 학습 활동",
    template: "%s | 곰도리에듀",
  },
  description: "곰도리에듀에서 교사가 준비한 AI·코딩 수업 활동에 참여하고 결과물을 정리합니다.",
  robots: {
    index: true,
    follow: true,
  },
};

export default function EduLayout({ children }: { children: ReactNode }) {
  return (
    <div className="edu-bg min-h-screen text-[var(--theme-text)]">
      <div className="relative">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-6 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-[var(--theme-card)] focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-[var(--theme-accent)] focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-[var(--theme-focus)] focus:ring-offset-2"
        >
          본문으로 건너뛰기
        </a>
        <EduHeader />
        <main id="main-content" className="mx-auto w-full max-w-[1800px] px-4 pb-20 sm:px-6 lg:px-8 2xl:max-w-none 2xl:px-10">
          {children}
        </main>
        <TeacherDebugPanel />
        <P2PBootstrap />
      </div>
    </div>
  );
}
