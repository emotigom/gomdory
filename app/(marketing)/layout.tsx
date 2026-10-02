import type { Metadata } from "next";
import type { ReactNode } from "react";

import OpsAnnouncementBar from "@/app/_components/OpsAnnouncementBar";
import { getActiveBanner } from "@/lib/ops/banners.server";
import MarketingFooter from "./_components/MarketingFooter";
import MarketingNav from "./_components/MarketingNav";
import { containerClass, sectionClass, subtleBgLayers } from "./_components/marketingTokens";

import { TEACHER_CANONICAL_HOST } from "@/lib/http/siteConfig";

const metadataBase = new URL(`https://${TEACHER_CANONICAL_HOST}`);

const socialImageUrl = "/logo/gom.svg";

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: "곰도리 | 수업 준비부터 작품 발표까지",
    template: "%s | 곰도리",
  },
  description:
    "수업 자료, 학생 작품, 발표와 정리를 한 보드에서 이어가는 AI·코딩 수업 공간입니다.",
  keywords: ["교실 운영", "수업 준비", "학생 참여", "교사용 보드", "코딩 수업", "교육 플랫폼"],
  openGraph: {
    title: "곰도리 | 자료부터 작품 발표까지 한곳에",
    description: "수업 준비와 학생 참여가 한 흐름으로 이어지는 AI·코딩 수업 보드",
    images: [{ url: socialImageUrl }],
  },
  twitter: {
    title: "곰도리 | AI·코딩 수업 보드",
    description: "수업 자료, 학생 작품, 발표와 정리를 한곳에서",
    images: [socialImageUrl],
  },
  icons: {
    icon: [{ url: socialImageUrl }],
  },
};

export default async function MarketingLayout({ children }: { children: ReactNode }) {
  const banner = await getActiveBanner();

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[var(--theme-bg)] font-sans text-lg text-[var(--theme-text)] antialiased">
      {subtleBgLayers({ className: "opacity-95" })}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-6 focus:top-4 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-indigo-700 focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-white"
      >
        본문으로 건너뛰기
      </a>
      {banner ? <OpsAnnouncementBar banner={banner} /> : null}
      <MarketingNav />
      <main id="main-content" className={`${containerClass} pb-24 pt-10 sm:pb-32 sm:pt-14`}>
        <div className={sectionClass}>{children}</div>
      </main>
      <MarketingFooter />
    </div>
  );
}
