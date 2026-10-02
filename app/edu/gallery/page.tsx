"use client";

import { useSearchParams } from "next/navigation";

import EduGallery from "@/app/edu/_components/EduGallery";

export default function EduGalleryPage() {
  const searchParams = useSearchParams();
  const code = (searchParams.get("code") ?? "").trim();
  return <EduGallery initialShareCode={code} allowCodeInput />;
}
