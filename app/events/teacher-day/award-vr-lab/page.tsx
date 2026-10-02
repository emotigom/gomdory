import type { Metadata } from "next";

import { AwardVrPage } from "../award-vr/AwardVrClient";

const routePath = "/events/teacher-day/award-vr-lab";

export const metadata: Metadata = {
  title: "Award VR 수업 실습 페이지",
  description: "AI에게 웹페이지 개선을 요청하는 방법을 배우기 위한 Award VR 수업 실습 페이지입니다.",
  alternates: { canonical: routePath },
  openGraph: {
    title: "Award VR 수업 실습 페이지",
    description: "카메라와 저장 기능은 그대로 두고, 문구와 화면 구성을 관찰하는 수업용 Award VR 페이지입니다.",
    url: routePath,
    type: "website",
    locale: "ko_KR",
  },
};

export default function TeacherDayAwardVrLabRoute() {
  return <AwardVrPage labMode />;
}
