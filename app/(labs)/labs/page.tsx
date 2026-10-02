import Link from "next/link";

import { isLabsTerminalEnabled, isLabsVrWorldEnabled } from "@/lib/labs/flags";

export default function LabsPage() {
  const terminalEnabled = isLabsTerminalEnabled();
  const vrWorldEnabled = isLabsVrWorldEnabled();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-16">
      <h1 className="text-2xl font-semibold text-neutral-900">Labs</h1>
      <ul className="space-y-3 text-sm text-neutral-700">
        <li className="rounded-lg border border-neutral-200 px-4 py-3">
          <Link className="font-medium text-neutral-900 underline-offset-2 hover:underline" href="/labs/webllm">
            WebLLM
          </Link>
        </li>
        <li className="rounded-lg border border-neutral-200 px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <Link className="font-medium text-neutral-900 underline-offset-2 hover:underline" href="/labs/terminal">
              Terminal
            </Link>
            <span className="text-xs text-neutral-500">{terminalEnabled ? "사용 가능" : "비활성"}</span>
          </div>
        </li>
        <li className="rounded-lg border border-neutral-200 px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <Link className="font-medium text-neutral-900 underline-offset-2 hover:underline" href="/labs/world">
              VR World
            </Link>
            <span className="text-xs text-neutral-500">{vrWorldEnabled ? "사용 가능" : "비활성"}</span>
          </div>
        </li>
      </ul>
    </main>
  );
}
