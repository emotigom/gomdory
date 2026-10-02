import Link from "next/link";

import { readBuildId, readOpsAdminEmailsRaw } from "@/lib/env/appConfig";
import { routes } from "@/lib/standards/routes";

function maskAllowlist(raw: string) {
  const emails = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const masked = emails.slice(0, 2).map((email) => {
    const at = email.indexOf("@");
    if (at <= 0) return "••••";
    const local = email.slice(0, at);
    const domain = email.slice(at);
    if (local.length <= 1) return `•••${domain}`;
    return `${local[0]}•••${domain}`;
  });

  return {
    count: emails.length,
    masked,
  };
}

export default function OpsAccessDenied({
  email,
  requestedPath,
}: {
  email: string | null | undefined;
  requestedPath?: string;
}) {
  const rawAllowlist = readOpsAdminEmailsRaw();
  const allowlistInfo = maskAllowlist(rawAllowlist);
  const buildId = readBuildId();

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-10" data-page-marker="ops-access-denied">
      <header className="space-y-2">
        <p className="text-xs font-semibold text-slate-500">Ops</p>
        <h1 className="text-2xl font-bold text-slate-900">운영자 권한이 필요합니다</h1>
        <p className="text-sm text-slate-600">
          이 페이지는 운영자(Ops Admin)만 접근할 수 있습니다.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="space-y-2 text-sm text-slate-700">
          <p>
            <span className="font-semibold">현재 로그인:</span> {email ?? "(unknown)"}
          </p>
          {requestedPath ? (
            <p>
              <span className="font-semibold">요청 경로:</span> {requestedPath}
            </p>
          ) : null}
          <p>
            <span className="font-semibold">BUILD_ID:</span> {buildId}
          </p>
          <p className="text-xs text-slate-500">
            OPS_ADMIN_EMAILS에 현재 로그인 이메일을 추가한 뒤 다시 시도해 주세요.
          </p>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <p className="font-semibold text-slate-700">현재 OPS_ADMIN_EMAILS 상태</p>
          <p className="mt-1 text-slate-600">
            등록된 이메일 수: <span className="font-semibold">{allowlistInfo.count}</span>
          </p>
          {allowlistInfo.masked.length > 0 ? (
            <p className="mt-1 text-slate-600">
              샘플: <span className="font-semibold">{allowlistInfo.masked.join(", ")}</span>
              {allowlistInfo.count > allowlistInfo.masked.length ? " …" : ""}
            </p>
          ) : (
            <p className="mt-1 text-slate-600">(설정되지 않았거나 비어있습니다)</p>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link
            href={routes.page.dashboard.root()}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm"
          >
            대시보드
          </Link>
          <Link
            href={routes.page.auth.login()}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm"
          >
            다시 로그인
          </Link>
          <Link
            href={routes.api.ops.whoami()}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm"
          >
            {routes.api.ops.whoami()} 확인
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">설정 방법</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-700">
          <li>
            Cloudflare 대시보드에서 해당 환경(Preview/Production)의 <span className="font-semibold">환경변수</span>를
            엽니다.
          </li>
          <li>
            <span className="font-semibold">OPS_ADMIN_EMAILS</span> 값을
            <span className="font-semibold"> 콤마(,)</span>로 구분해 설정합니다.
          </li>
          <li>
            예: <span className="rounded bg-slate-100 px-2 py-1 font-mono text-xs">{email ?? "you@example.com"}</span>
            또는
            <span className="rounded bg-slate-100 px-2 py-1 font-mono text-xs">
              {email ?? "you@example.com"},other@example.com
            </span>
          </li>
          <li>배포를 다시 실행하거나(필요 시) 환경변수 반영 후 재시도합니다.</li>
        </ol>
      </section>
    </main>
  );
}
