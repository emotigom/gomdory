"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";

import { useCallback, useEffect, useMemo, useState } from "react";

import InlineAlert from "@/app/_components/InlineAlert";
import SkeletonBlock from "@/app/_components/SkeletonBlock";

export type ActivityFilter = "all" | "card" | "collab" | "trash" | "mine";

export type ActivityItem = {
  id: string;
  createdAt: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  actorUserId: string | null;
  actorRole: string | null;
  meta: Record<string, unknown> | null;
  requestId: string | null;
};

const FILTER_CONFIG: Record<
  ActivityFilter,
  { label: string; actionPrefix?: string; actor?: "me"; trashOnly?: boolean }
> = {
  all: { label: "전체" },
  card: { label: "카드", actionPrefix: "card." },
  collab: { label: "협업", actionPrefix: "collab." },
  trash: { label: "휴지통", actionPrefix: "card.", trashOnly: true },
  mine: { label: "내 활동", actor: "me" },
};

const TRASH_ACTIONS = new Set([
  "card.soft_delete",
  "card.restore",
  "card.delete",
  "card.purge",
]);

function formatRelativeTime(value: string): string {
  const target = new Date(value);
  const now = Date.now();
  const diffMs = target.getTime() - now;
  const diffMinutes = Math.round(diffMs / (1000 * 60));
  const diffHours = Math.round(diffMinutes / 60);
  const diffDays = Math.round(diffHours / 24);

  const formatter = new Intl.RelativeTimeFormat("ko", { numeric: "auto" });

  if (Math.abs(diffMinutes) < 60) {
    return formatter.format(diffMinutes, "minute");
  }
  if (Math.abs(diffHours) < 48) {
    return formatter.format(diffHours, "hour");
  }
  return formatter.format(diffDays, "day");
}

function formatActor(actorUserId: string | null, actorRole: string | null): string {
  if (actorUserId) {
    return actorUserId.length > 10 ? `${actorUserId.slice(0, 6)}…` : actorUserId;
  }
  if (actorRole) {
    return actorRole;
  }
  return "알 수 없음";
}

function formatActionLabel(action: string): string {
  const map: Record<string, string> = {
    "card.create": "카드 추가",
    "card.soft_delete": "휴지통으로 이동",
    "card.restore": "복구",
    "card.purge": "완전 삭제",
    "card.update": "카드 수정",
    "collab.invite.create": "초대 생성",
    "collab.invite.revoke": "초대 취소",
    "collab.invite.accept": "초대 수락",
    "collab.member.role_update": "권한 변경",
    "collab.member.remove": "멤버 제거",
  };
  return map[action] ?? action;
}

type ActivityPanelProps = {
  boardId: string;
  isOpen: boolean;
  filter: ActivityFilter;
  onFilterChange: (filter: ActivityFilter) => void;
  onClose: () => void;
  onJumpToCard: (cardId: string) => { ok: boolean };
  trashHref: string;
};

export default function ActivityPanel({
  boardId,
  isOpen,
  filter,
  onFilterChange,
  onClose,
  onJumpToCard,
  trashHref,
}: ActivityPanelProps) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const queryParams = useMemo(() => FILTER_CONFIG[filter], [filter]);

  const fetchActivities = useCallback(
    async (options?: { cursor?: string; reset?: boolean }) => {
      const params = new URLSearchParams();
      params.set("limit", "20");
      if (queryParams.actionPrefix) {
        params.set("actionPrefix", queryParams.actionPrefix);
      }
      if (queryParams.actor) {
        params.set("actor", queryParams.actor);
      }
      if (options?.cursor) {
        params.set("cursor", options.cursor);
      }

      const response = await fetch(apiV1Path(`boards/${boardId}/audit?${params.toString()}`));
      const result = (await response.json()) as
        | { ok: true; items: ActivityItem[]; nextCursor: string | null }
        | { ok: false; message?: string };

      if (!result || !("ok" in result) || !result.ok) {
        throw new Error(result && "message" in result ? result.message : "불러오지 못했습니다.");
      }

      const filteredItems = queryParams.trashOnly
        ? result.items.filter((item) => TRASH_ACTIONS.has(item.action))
        : result.items;

      setItems((prev) => (options?.reset ? filteredItems : [...prev, ...filteredItems]));
      setNextCursor(result.nextCursor);
    },
    [boardId, queryParams.actionPrefix, queryParams.actor, queryParams.trashOnly],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setIsLoading(true);
    setError(null);
    setInfo(null);
    fetchActivities({ reset: true })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "활동을 불러올 수 없습니다.");
      })
      .finally(() => setIsLoading(false));
  }, [fetchActivities, isOpen, filter]);

  const handleLoadMore = useCallback(() => {
    if (!nextCursor) {
      return;
    }
    setIsLoadingMore(true);
    fetchActivities({ cursor: nextCursor })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "추가 활동을 불러오지 못했습니다.");
      })
      .finally(() => setIsLoadingMore(false));
  }, [fetchActivities, nextCursor]);

  const handleJump = useCallback(
    (item: ActivityItem) => {
      setInfo(null);
      if (item.targetType === "card" && item.targetId) {
        const result = onJumpToCard(item.targetId);
        if (!result.ok) {
          setInfo("현재 목록에서 카드를 찾지 못했어요. 휴지통이나 필터를 확인해 주세요.");
        } else {
          onClose();
        }
        return;
      }
      setInfo("카드 대상이 없는 활동입니다.");
    },
    [onClose, onJumpToCard],
  );

  if (!isOpen) {
    return null;
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <span>최근 활동</span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">최대 20개</span>
        </div>
        <div className="flex items-center gap-2">
          {Object.entries(FILTER_CONFIG).map(([key, config]) => {
            const isActive = key === filter;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onFilterChange(key as ActivityFilter)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10 ${
                  isActive
                    ? "bg-gray-900 text-white"
                    : "border border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                }`}
              >
                {config.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded-full border border-gray-200 px-3 text-xs font-semibold text-gray-700 transition hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
          >
            닫기
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-3">
          <InlineAlert
            tone="error"
            title="활동을 불러오는 중 문제가 발생했습니다."
            description={error}
            action={
              <button
                type="button"
                onClick={() => fetchActivities({ reset: true }).catch(() => undefined)}
                className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-800 transition hover:border-gray-300"
              >
                다시 시도
              </button>
            }
          />
        </div>
      ) : null}

      {info ? (
        <div className="mt-3">
          <InlineAlert
            tone="info"
            title={info}
            description={
              trashHref
                ? "휴지통이나 필터를 확인하면 카드를 찾을 수 있습니다."
                : undefined
            }
            action={
              trashHref ? (
                <a
                  className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-800 transition hover:border-gray-300"
                  href={trashHref}
                >
                  휴지통 열기
                </a>
              ) : undefined
            }
          />
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, index) => (
              <div key={index} className="space-y-2 rounded-lg border border-gray-100 bg-gray-50 p-3">
                <SkeletonBlock className="h-4 w-1/3" />
                <SkeletonBlock className="h-4 w-1/2" />
                <SkeletonBlock className="h-4 w-full" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="rounded-md bg-gray-50 px-4 py-3 text-sm text-gray-600">최근 활동이 없습니다.</p>
        ) : (
          <ul className="space-y-2" aria-live="polite">
            {items.map((item) => {
              const createdDate = new Date(item.createdAt);
              return (
                <li
                  key={item.id}
                  className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-3 text-sm text-gray-800"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span title={createdDate.toLocaleString()} aria-label={createdDate.toLocaleString()}>
                        {formatRelativeTime(item.createdAt)}
                      </span>
                      <span className="text-gray-300">•</span>
                      <span>{formatActor(item.actorUserId, item.actorRole)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleJump(item)}
                      className="rounded-full px-3 py-1 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"
                    >
                      이동
                    </button>
                  </div>
                  <div className="mt-1 text-sm font-semibold text-gray-900">{formatActionLabel(item.action)}</div>
                  {item.targetType === "card" && item.targetId ? (
                    <p className="mt-1 text-xs text-gray-600">카드 ID: {item.targetId}</p>
                  ) : null}
                  {item.requestId ? (
                    <p className="mt-1 text-[11px] text-gray-400">요청 ID: {item.requestId}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {nextCursor ? (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            className="inline-flex items-center rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-800 transition hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoadingMore ? "불러오는 중..." : "더 보기"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
