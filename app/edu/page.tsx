import type { Metadata } from "next";

import EduJoinClient from "./EduJoinClient";

export const metadata: Metadata = {
  title: "곰도리에듀 학생 입장 | 공유 코드로 수업 참여",
  description: "곰도리에듀 수업 공유 코드로 교사가 준비한 AI·코딩 수업 활동에 안전하게 참여하는 학생 입장 페이지입니다.",
  alternates: { canonical: "/edu" },
  openGraph: {
    title: "곰도리에듀 학생 입장 | 공유 코드 수업 참여",
    description: "공유 코드로 교사 주도 곰도리에듀 수업 활동에 참여합니다.",
    url: "/edu",
  },
};

export default function EduPage() {
  return <EduJoinClient />;
}
