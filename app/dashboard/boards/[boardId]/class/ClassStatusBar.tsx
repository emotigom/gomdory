import Link from "next/link";

import { buttonTone, cn, hairlineBorderClass, pill, surface } from "@/app/_components/uiTokens";
import { buildJoinUrl } from "@/lib/http/publicLinks";
import { LinkCopyButton } from "./LinkCopyButton";

export function ClassStateBadge({ state }: { state: "idle" | "live" | "ended" }) {
  const label = state === "live" ? "진행" : state === "ended" ? "종료" : "대기";
  const styles =
    state === "live"
      ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200/80"
      : state === "ended"
        ? "bg-gray-200 text-gray-700 ring-1 ring-gray-300/80"
        : "bg-blue-100 text-blue-800 ring-1 ring-blue-200/80";

  return (
    <span className={cn(pill.badge, styles)}>{label}</span>
  );
}

function StatusBadge({ label }: { label: string }) {
  return (
    <span
      className={cn(
        pill.badge,
        "border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-semibold text-gray-700",
      )}
    >
      {label}
    </span>
  );
}

type ClassStatusBarProps = {
  title: string;
  classState: "idle" | "live" | "ended";
  shareCode?: string | null;
  studentLink?: string | null;
  writeLocked: boolean;
  realtimeStatusLabel?: string;
  lastUpdatedAt?: string | null;
  boardId: string;
};

export default function ClassStatusBar({
  title,
  classState,
  shareCode,
  studentLink,
  writeLocked,
  realtimeStatusLabel = "알 수 없음",
  lastUpdatedAt,
  boardId,
}: ClassStatusBarProps) {
  const hasShareLink = Boolean(studentLink);
  const entryUrl = buildJoinUrl();
  const formattedUpdatedAt = lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleString("ko-KR") : null;
  const quickActionBase = cn(
    buttonTone("secondary", { size: "sm" }),
    "h-9 px-3 text-[11px] font-semibold",
  );

  return (
    <div className={cn(surface.card, "border border-gray-200 px-4 py-3")}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-gray-900">{title}</p>
            <ClassStateBadge state={classState} />
            <StatusBadge label={`Realtime ${realtimeStatusLabel}`} />
            <StatusBadge label={`글쓰기 ${writeLocked ? "잠금" : "허용"}`} />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span>공유 코드: {shareCode ?? "-"}</span>
            {formattedUpdatedAt ? <span>최근 업데이트: {formattedUpdatedAt}</span> : null}
          </div>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div
            className={cn(
              "flex min-w-0 flex-col gap-1 rounded-lg px-3 py-2 text-xs text-gray-700",
              hairlineBorderClass,
              "bg-slate-50/80",
            )}
          >
            <span className="text-[11px] font-semibold text-gray-500">학생 링크</span>
            <span className="text-[11px] font-medium text-gray-600">학생 접속(코드 입력): {entryUrl}</span>
            <span
              className={`min-w-0 truncate text-[11px] font-medium ${hasShareLink ? "text-gray-800" : "text-gray-400"}`}
              title={studentLink ?? "공유 링크가 비활성화되어 있습니다."}
            >
              학생 바로 입장: {studentLink ?? "공유 링크가 비활성화되어 있습니다."}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-700">
            <span className="text-[11px] font-semibold text-gray-400">Quick Actions</span>
            {hasShareLink ? (
              <LinkCopyButton
                value={studentLink ?? ""}
                ariaLabel="학생 공유 링크 복사"
                label="학생 링크 복사"
                className={quickActionBase}
              />
            ) : null}
            {hasShareLink ? (
              <a
                href={studentLink!}
                className={quickActionBase}
                target="_blank"
                rel="noreferrer"
                aria-label="학생 화면 열기"
              >
                학생 화면 열기
              </a>
            ) : null}
            <Link href={`/dashboard/boards/${boardId}/board`} className={quickActionBase}>
              보드로 이동
            </Link>
            <a href="#card-form" className={quickActionBase}>
              자료 추가
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
