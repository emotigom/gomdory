// app/layout.tsx
import { ReactNode, Suspense } from "react";
import { headers } from "next/headers";
import "./globals.css";
import { RequestContextProvider } from "./_components/request-context";
import ServiceWorkerRegistration from "./_components/ServiceWorkerRegistration";
import ClientErrorReporter from "./_components/ClientErrorReporter";
import GlobalUiErrorReporter from "./_components/GlobalUiErrorReporter";
import RequestIdOverlay from "./_components/RequestIdOverlay";
import ViewportVars from "./_components/ViewportVars";
import { ThemeProvider } from "./_components/ThemeProvider";
import type { Metadata } from "next";

import { TEACHER_CANONICAL_HOST } from "@/lib/http/siteConfig";

const metadataBase = new URL(`https://${TEACHER_CANONICAL_HOST}`);
const socialImageUrl = new URL("/logo/gom.png", metadataBase).toString();
const faviconUrl = new URL("/favicon.svg", metadataBase).toString();

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: "곰도리 | AI·코딩 수업 보드",
    template: "%s | 곰도리",
  },
  description:
    "수업 자료, 학생 작품, 발표와 정리를 한 보드에서 이어가는 AI·코딩 수업 공간입니다.",
  applicationName: "곰도리",
  generator: "Next.js",
  referrer: "origin-when-cross-origin",
  formatDetection: { email: true, address: false, telephone: true },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  alternates: {
    canonical: "/",
    languages: {
      "ko-KR": "/",
    },
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "곰도리",
    locale: "ko_KR",
    title: "곰도리 | AI·코딩 수업 보드",
    description:
      "수업 자료부터 학생 작품, 발표와 정리까지 한 보드에서 이어가는 곰도리.",
    images: [
      {
        url: socialImageUrl,
        alt: "곰도리 | AI·코딩 수업 보드",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "곰도리 | AI·코딩 수업 보드",
    description:
      "수업 자료, 학생 작품, 발표와 정리를 한곳에서.",
    images: [socialImageUrl],
  },
  icons: {
    icon: [{ url: faviconUrl }],
    shortcut: [{ url: faviconUrl }],
    apple: [{ url: faviconUrl }],
  },
  manifest: "/manifest.webmanifest",
  keywords: [
    "곰도리에듀",
    "학습지원 소프트웨어",
    "AI 수업",
    "코딩 수업",
    "교사 수업 지원",
    "교실 운영",
    "교육 기술",
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const requestHeaders = await headers();
  const rawUrl = requestHeaders.get("x-url");
  const parsedUrl = rawUrl ? new URL(rawUrl) : null;
  const requestId = requestHeaders.get("cf-ray") ?? requestHeaders.get("x-request-id") ?? crypto.randomUUID();

  return (
    <html lang="ko" data-gom-theme="gomdory-studio" data-gom-theme-active="gomdory-studio" data-theme="classic" data-theme-active="gomdory-studio" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#f5f0e6" />
        <meta name="gom:app" content="1" />
      </head>
      <body className="scroll-smooth bg-[var(--theme-bg)] font-sans text-[var(--theme-text)] antialiased">
        <ThemeProvider>
        <div data-gom-app="1" className="sr-only" />
        <RequestContextProvider requestId={requestId} path={parsedUrl?.pathname ?? "/"}>
          <ViewportVars />
          {children}
          <ServiceWorkerRegistration />
          <ClientErrorReporter />
          <GlobalUiErrorReporter />
          <Suspense fallback={null}>
            <RequestIdOverlay />
          </Suspense>
        </RequestContextProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
