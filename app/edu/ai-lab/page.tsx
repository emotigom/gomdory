import Link from "next/link";
import type { Metadata } from "next";
import { isWebLLMLabEnabled } from "@/lib/webllm/webllmFlags";
import WebLLMLabClient from "./WebLLMLabClient";

export const metadata: Metadata = {
  title: "WebLLM Lab 진단 | 곰도리",
  description: "브라우저 기반 AI 실행 가능성을 진단하는 실험실 페이지",
};

export default function EduAiLabPage() {
  if (!isWebLLMLabEnabled()) {
    return (
      <main className="mx-auto max-w-3xl p-6 space-y-3">
        <h1 className="text-2xl font-semibold">WebLLM Lab 진단</h1>
        <p className="text-sm text-slate-600">브라우저 AI 실행 가능성 진단</p>
        <p>현재 WebLLM Lab은 비활성화되어 있습니다.</p>
        <p>관리자가 NEXT_PUBLIC_WEBLLM_LAB_V1를 명시적으로 활성화하면 진단 페이지를 사용할 수 있습니다.</p>
        <Link href="/" className="inline-flex rounded bg-black px-4 py-2 text-sm text-white">
          홈으로 이동
        </Link>
      </main>
    );
  }

  return <WebLLMLabClient />;
}
