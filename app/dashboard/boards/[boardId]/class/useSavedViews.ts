"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type ViewState = {
  searchQuery: string;
  showSelectedOnly: boolean;
  tagsFilter: string[];
  inboxOnly?: boolean;
};

export type SavedView = {
  id: string;
  name: string;
  state: ViewState;
  createdAt: number;
  updatedAt: number;
  isPinned: boolean;
  pinOrder: number;
  isDefault: boolean;
};

type UseSavedViewsOptions = {
  boardId: string;
  onApply: (state: ViewState) => void;
};

type SavedViewsNotice = {
  title: string;
  description?: string;
  actionLabel?: string;
};

type SavedViewsResult = {
  views: SavedView[];
  maxViews: number;
  notice: SavedViewsNotice | null;
  isReady: boolean;
  defaultViewId: string | null;
  retryRemote: () => void;
  addView: (
    input: { name: string; state: ViewState; isPinned?: boolean; isDefault?: boolean; pinOrder?: number },
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  updateView: (
    id: string,
    patch: Partial<Pick<SavedView, "name" | "state" | "isPinned" | "pinOrder" | "isDefault">>,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  deleteView: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  applyView: (id: string) => SavedView | null;
  reorderPinned: (
    entries: Array<{ id: string; pinOrder: number }>,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
};

const MAX_VIEWS = 5;

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getStorageKey(boardId: string) {
  return `gom:class:views:${boardId}`;
}

function getMigrationKey(boardId: string) {
  return `gom:class:views:migrated:${boardId}`;
}

function normalizePinOrder(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.max(0, Math.round(parsed));
}

function safeParseViews(raw: string | null): SavedView[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as SavedView[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((view) => view && typeof view.id === "string")
      .map((view) => ({
        ...view,
        state: normalizeState(view.state),
        isPinned: Boolean((view as Partial<SavedView>).isPinned),
        pinOrder: Number((view as Partial<SavedView>).pinOrder ?? 0),
        isDefault: Boolean((view as Partial<SavedView>).isDefault),
      }));
  } catch {
    return [];
  }
}

function sortViews(views: SavedView[]) {
  return [...views].sort((a, b) => b.updatedAt - a.updatedAt);
}

function normalizeName(name: string) {
  return name.trim();
}

type ApiError = {
  ok: false;
  code: string;
  message: string;
};

type ApiView = {
  id: string;
  name: string;
  state: ViewState;
  createdAt: number;
  updatedAt: number;
  isPinned?: boolean;
  pinOrder?: number;
  isDefault?: boolean;
};

function normalizeState(state: Partial<ViewState> | undefined): ViewState {
  const tags = Array.isArray(state?.tagsFilter)
    ? state!.tagsFilter.filter((value) => typeof value === "string").map((value) => value.trim())
    : [];

  return {
    searchQuery: state?.searchQuery ?? "",
    showSelectedOnly: Boolean(state?.showSelectedOnly),
    tagsFilter: tags,
    inboxOnly: Boolean(state?.inboxOnly),
  };
}

function mapApiView(view: ApiView): SavedView {
  return {
    ...view,
    createdAt: Number(view.createdAt),
    updatedAt: Number(view.updatedAt),
    state: normalizeState(view.state),
    isPinned: Boolean(view.isPinned),
    pinOrder: Number(view.pinOrder ?? 0),
    isDefault: Boolean(view.isDefault),
  };
}

function isFallbackError(code?: string) {
  return code === "unauthorized" || code === "forbidden" || code === "network_error";
}

function createFallbackNotice(): SavedViewsNotice {
  return {
    title: "오프라인이라 로컬로 저장했어요.",
    description: "연결이 복구되면 다시 동기화해 주세요.",
    actionLabel: "다시 시도",
  };
}

export default function useSavedViews({ boardId, onApply }: UseSavedViewsOptions): SavedViewsResult {
  const storageKey = useMemo(() => getStorageKey(boardId), [boardId]);
  const migrationKey = useMemo(() => getMigrationKey(boardId), [boardId]);
  const [views, setViews] = useState<SavedView[]>([]);
  const [notice, setNotice] = useState<SavedViewsNotice | null>(null);
  const [isReady, setIsReady] = useState(false);
  const remoteAvailableRef = useRef(true);

  const defaultViewId = useMemo(() => views.find((view) => view.isDefault)?.id ?? null, [views]);

  const persistViews = useCallback(
    (next: SavedView[] | ((current: SavedView[]) => SavedView[])) => {
      setViews((current) => {
        const computed = typeof next === "function" ? next(current) : next;
        const sorted = sortViews(computed);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(storageKey, JSON.stringify(sorted));
        }
        return sorted;
      });
    },
    [storageKey],
  );

  const loadRemote = useCallback(async () => {
    try {
      const response = await fetch(apiV1Path(`boards/${boardId}/class/views`), {
        method: "GET",
        cache: "no-store",
      });
      if (!response.ok) {
        remoteAvailableRef.current = false;
        setNotice(createFallbackNotice());
        return null;
      }
      const data = (await response.json()) as { ok: true; views: ApiView[] } | ApiError;
      if (!data.ok) {
        remoteAvailableRef.current = false;
        setNotice(createFallbackNotice());
        return null;
      }
      remoteAvailableRef.current = true;
      setNotice(null);
      return data.views.map(mapApiView);
    } catch {
      remoteAvailableRef.current = false;
      setNotice(createFallbackNotice());
      return null;
    }
  }, [boardId]);

  const migrateLocalViews = useCallback(
    async (localViews: SavedView[]) => {
      const results: SavedView[] = [];
      for (const view of localViews.slice(0, MAX_VIEWS)) {
        const response = await fetch(apiV1Path(`boards/${boardId}/class/views`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: view.name,
            state: view.state,
            isPinned: view.isPinned,
            pinOrder: view.pinOrder,
            isDefault: view.isDefault,
          }),
        });
        if (!response.ok) {
          throw new Error("migration_failed");
        }
        const data = (await response.json()) as { ok: true; view: ApiView } | ApiError;
        if (!data.ok) {
          throw new Error("migration_failed");
        }
        results.push(mapApiView(data.view));
      }
      return results;
    },
    [boardId],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const localViews = safeParseViews(window.localStorage.getItem(storageKey));
    setViews(sortViews(localViews));

    let cancelled = false;

    const run = async () => {
      const remoteViews = await loadRemote();
      if (cancelled || !remoteViews) {
        setIsReady(true);
        return;
      }

      if (remoteViews.length === 0 && localViews.length > 0) {
        const alreadyMigrated = window.localStorage.getItem(migrationKey) === "true";
        if (!alreadyMigrated) {
          try {
            const migrated = await migrateLocalViews(localViews);
            if (!cancelled) {
              persistViews(migrated);
              window.localStorage.setItem(migrationKey, "true");
            }
            setIsReady(true);
            return;
          } catch {
            if (!cancelled) {
              setNotice(createFallbackNotice());
            }
            setIsReady(true);
            return;
          }
        }
        persistViews(localViews);
        setIsReady(true);
        return;
      }

      persistViews(remoteViews);
      setIsReady(true);
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [loadRemote, migrationKey, migrateLocalViews, persistViews, storageKey]);

  const retryRemote = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    setNotice(null);
    void (async () => {
      const remoteViews = await loadRemote();
      if (remoteViews) {
        persistViews(remoteViews);
        setIsReady(true);
      }
    })();
  }, [loadRemote, persistViews]);

  const mergeServerViews = useCallback(
    (payload: { view?: ApiView; views?: ApiView[] }) => {
      const nextViews = payload.views?.map(mapApiView);
      if (nextViews) {
        persistViews(nextViews);
        return;
      }
      if (payload.view) {
        persistViews((current) => {
          const mapped = mapApiView(payload.view!);
          const withoutOptimistic = current.filter(
            (view) => view.id !== mapped.id && view.name !== mapped.name,
          );
          return [...withoutOptimistic, mapped];
        });
      }
    },
    [persistViews],
  );

  const nextPinOrder = useCallback(() => {
    const pinned = views.filter((view) => view.isPinned);
    if (pinned.length === 0) {
      return 0;
    }
    return Math.max(...pinned.map((view) => view.pinOrder)) + 1;
  }, [views]);

  const addView = useCallback(
    async (input: { name: string; state: ViewState; isPinned?: boolean; isDefault?: boolean; pinOrder?: number }) => {
      const trimmed = normalizeName(input.name);
      if (!trimmed) {
        return { ok: false as const, error: "뷰 이름을 입력해 주세요." };
      }
      if (views.length >= MAX_VIEWS) {
        return { ok: false as const, error: "최대 5개까지만 저장할 수 있어요." };
      }
      const now = Date.now();
      const pinOrder = input.isPinned ? normalizePinOrder(input.pinOrder ?? nextPinOrder()) : 0;
      const optimisticView: SavedView = {
        id: createId(),
        name: trimmed,
        state: input.state,
        createdAt: now,
        updatedAt: now,
        isPinned: Boolean(input.isPinned),
        pinOrder,
        isDefault: Boolean(input.isDefault),
      };
      const optimisticList = optimisticView.isDefault
        ? views.map((view) => ({ ...view, isDefault: false }))
        : views;
      persistViews([...optimisticList, optimisticView]);

      if (!remoteAvailableRef.current) {
        setNotice(createFallbackNotice());
        return { ok: true as const };
      }

      try {
        const response = await fetch(apiV1Path(`boards/${boardId}/class/views`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: trimmed,
            state: input.state,
            isPinned: input.isPinned,
            pinOrder,
            isDefault: input.isDefault,
          }),
        });
        const data = (await response.json()) as { ok: true; view: ApiView; views?: ApiView[] } | ApiError;
        if (!response.ok || !data.ok) {
          const code = !data.ok ? data.code : "network_error";
          if (code === "limit_reached") {
            persistViews(views);
            return { ok: false as const, error: "최대 5개까지만 저장할 수 있어요." };
          }
          if (code === "duplicate_name") {
            persistViews(views);
            return { ok: false as const, error: "같은 이름이 있어요." };
          }
          if (isFallbackError(code)) {
            setNotice(createFallbackNotice());
            return { ok: true as const };
          }
          persistViews(views);
          return { ok: false as const, error: "저장에 실패했어요." };
        }
        mergeServerViews({ view: data.view, views: data.views });
        return { ok: true as const };
      } catch {
        setNotice(createFallbackNotice());
        return { ok: true as const };
      }
    },
    [boardId, mergeServerViews, nextPinOrder, persistViews, views],
  );

  const updateView = useCallback(
    async (
      id: string,
      patch: Partial<Pick<SavedView, "name" | "state" | "isPinned" | "pinOrder" | "isDefault">>,
    ) => {
      const previous = views.find((view) => view.id === id);
      if (!previous) {
        return { ok: false as const, error: "뷰를 찾을 수 없어요." };
      }
      const nextName = patch.name ? normalizeName(patch.name) : previous.name;
      const nextView: SavedView = {
        ...previous,
        ...patch,
        name: nextName,
        updatedAt: Date.now(),
        pinOrder: patch.pinOrder ?? previous.pinOrder,
        isPinned: patch.isPinned ?? previous.isPinned,
        isDefault: patch.isDefault ?? previous.isDefault,
      };
      const nextViews = (patch.isDefault ? views.map((view) => ({ ...view, isDefault: false })) : views).map(
        (view) => (view.id === id ? nextView : view),
      );
      persistViews(nextViews);

      if (!remoteAvailableRef.current) {
        setNotice(createFallbackNotice());
        return { ok: true as const };
      }

      try {
        const response = await fetch(apiV1Path(`boards/${boardId}/class/views`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id,
            name: patch.name,
            state: patch.state,
            isPinned: patch.isPinned,
            pinOrder: patch.pinOrder,
            isDefault: patch.isDefault,
          }),
        });
        const data = (await response.json()) as { ok: true; view: ApiView; views?: ApiView[] } | ApiError;
        if (!response.ok || !data.ok) {
          const code = !data.ok ? data.code : "network_error";
          if (code === "duplicate_name") {
            persistViews(views);
            return { ok: false as const, error: "같은 이름이 있어요." };
          }
          if (isFallbackError(code)) {
            setNotice(createFallbackNotice());
            return { ok: true as const };
          }
          persistViews(views);
          return { ok: false as const, error: "수정에 실패했어요." };
        }
        mergeServerViews({ view: data.view, views: data.views });
        return { ok: true as const };
      } catch {
        setNotice(createFallbackNotice());
        return { ok: true as const };
      }
    },
    [boardId, mergeServerViews, persistViews, views],
  );

  const deleteView = useCallback(
    async (id: string) => {
      const nextViews = views.filter((view) => view.id !== id);
      persistViews(nextViews);

      if (!remoteAvailableRef.current) {
        setNotice(createFallbackNotice());
        return { ok: true as const };
      }

      try {
        const response = await fetch(apiV1Path(`boards/${boardId}/class/views`), {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        const data = (await response.json()) as { ok: true; views?: ApiView[] } | ApiError;
        if (!response.ok || !data.ok) {
          const code = !data.ok ? data.code : "network_error";
          if (isFallbackError(code)) {
            setNotice(createFallbackNotice());
            return { ok: true as const };
          }
          persistViews(views);
          return { ok: false as const, error: "삭제에 실패했어요." };
        }
        if (data.views) {
          mergeServerViews({ views: data.views });
        }
        return { ok: true as const };
      } catch {
        setNotice(createFallbackNotice());
        return { ok: true as const };
      }
    },
    [boardId, mergeServerViews, persistViews, views],
  );

  const reorderPinned = useCallback(
    async (entries: Array<{ id: string; pinOrder: number }>) => {
      if (entries.length === 0) {
        return { ok: false as const, error: "순서를 저장할 뷰가 없어요." };
      }
      const updated = views.map((view) => {
        const entry = entries.find((item) => item.id === view.id);
        if (!entry) {
          return view;
        }
        return { ...view, pinOrder: entry.pinOrder, isPinned: true, updatedAt: Date.now() };
      });
      persistViews(updated);

      if (!remoteAvailableRef.current) {
        setNotice(createFallbackNotice());
        return { ok: true as const };
      }

      try {
        const response = await fetch(apiV1Path(`boards/${boardId}/class/views`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reorderPinned: entries }),
        });
        const data = (await response.json()) as { ok: true; views?: ApiView[] } | ApiError;
        if (!response.ok || !data.ok) {
          const code = !data.ok ? data.code : "network_error";
          if (isFallbackError(code)) {
            setNotice(createFallbackNotice());
            return { ok: true as const };
          }
          persistViews(views);
          return { ok: false as const, error: "순서를 저장하지 못했어요." };
        }
        if (data.views) {
          mergeServerViews({ views: data.views });
        }
        return { ok: true as const };
      } catch {
        setNotice(createFallbackNotice());
        return { ok: true as const };
      }
    },
    [boardId, mergeServerViews, persistViews, views],
  );

  const applyView = useCallback(
    (id: string) => {
      const view = views.find((entry) => entry.id === id) ?? null;
      if (!view) {
        return null;
      }
      onApply(view.state);
      return view;
    },
    [onApply, views],
  );

  return {
    views,
    maxViews: MAX_VIEWS,
    notice,
    isReady,
    defaultViewId,
    retryRemote,
    addView,
    updateView,
    deleteView,
    applyView,
    reorderPinned,
  };
}
