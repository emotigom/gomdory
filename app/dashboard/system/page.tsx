export const dynamic = "force-dynamic";
export const revalidate = 0;

import SystemDiagClient from "./SystemDiagClient";
import { requireUser } from "@/lib/auth/requireUser";
import { routes } from "@/lib/standards/routes";

export default async function SystemDiagPage() {
  await requireUser(routes.page.dashboard.system());

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-gray-900">시스템 진단</p>
        <p className="text-sm text-gray-600">
          운영 중 장애가 감지되면 각 구성 요소 상태를 빠르게 확인하세요. 로그인 사용자만 접근할 수
          있으며, 민감 정보는 노출하지 않습니다.
        </p>
      </div>

      <SystemDiagClient />
    </main>
  );
}
