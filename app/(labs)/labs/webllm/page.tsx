import { isWebLLMLabsEnabled } from "@/lib/flags/featureFlags";

export default async function WebLLMLabsPage() {
  const enabled = isWebLLMLabsEnabled();

  if (!enabled) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-16">
        <h1 className="text-2xl font-semibold text-neutral-900">WebLLM (Labs)</h1>
        <p className="text-sm text-neutral-600">
          WebLLM 실험 페이지는 NEXT_PUBLIC_EDU_WEBLLM_LABS=1 환경에서만 활성화됩니다.
        </p>
      </main>
    );
  }

  const { default: WebLLMClient } = await import("./WebLLMClient");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-16">
      <h1 className="text-2xl font-semibold text-neutral-900">WebLLM (Labs)</h1>
      <WebLLMClient />
    </main>
  );
}
