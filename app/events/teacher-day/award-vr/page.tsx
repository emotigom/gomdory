import type { Metadata } from "next";

import { AwardVrPage } from "./AwardVrClient";

const routePath = "/events/teacher-day/award-vr";

export const metadata: Metadata = {
  title: "나만의 AI 포토 카드",
  description: "카메라를 켜고 나만의 개성과 아이디어를 담은 AI 포토 카드를 만드는 체험입니다.",
  alternates: { canonical: routePath },
  openGraph: {
    title: "나만의 AI 포토 카드",
    description: "나만의 개성과 아이디어를 담아 포토 카드를 만들어 봐요.",
    url: routePath,
    type: "website",
    locale: "ko_KR",
  },
};

export default function TeacherDayAwardVrRoute() {
  return <AwardVrPage />;
}
