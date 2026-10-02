import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { isTeacherHost } from "@/lib/http/siteConfig";
import SelfcheckClient from "@/app/edu/selfcheck/SelfcheckClient";

export default async function EduSelfcheckPage() {
  const host = (await headers()).get("host") ?? "";
  if (!isTeacherHost(host)) {
    notFound();
  }

  return <SelfcheckClient />;
}
