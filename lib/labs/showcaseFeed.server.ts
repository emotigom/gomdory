import "server-only";

import { listBoardsForUser } from "@/lib/data/boards.server";
import { getLastOpenedBoardId } from "@/lib/dashboard/lastOpenedBoard.server";
import { getPinnedBoardIds } from "@/lib/dashboard/pinnedBoards.server";
import { sortBoardsForDashboard } from "@/lib/dashboard/sortBoardsForDashboard";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ShowcaseItem =
  | { kind: "board"; id: string; title: string; href: string; subtitle?: string }
  | { kind: "community"; id: string; title: string; href: string; subtitle?: string };

type BoardInput = {
  id: string;
  title: string | null;
  created_at: string;
  class_updated_at?: string | null;
};

type CommunityInput = {
  id: string;
  title: string | null;
  created_at: string;
};

type ShowcaseFeedDeps = {
  listBoards: (userId: string) => Promise<readonly BoardInput[]>;
  getLastOpened: (userId: string) => Promise<string | null>;
  getPinned: (userId: string) => Promise<readonly string[]>;
  listCommunity: () => Promise<readonly CommunityInput[]>;
};

export async function getLabsShowcaseFeed(userId?: string): Promise<readonly ShowcaseItem[]> {
  return buildLabsShowcaseFeed(userId, {
    listBoards: async (resolvedUserId) => {
      const supabase = createSupabaseServerClient();
      return listBoardsForUser({ supabase, userId: resolvedUserId });
    },
    getLastOpened: getLastOpenedBoardId,
    getPinned: getPinnedBoardIds,
    listCommunity: async () => {
      const supabase = createSupabaseServerClient();
      const { data, error } = await supabase
        .from("community_posts")
        .select("id,title,created_at")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(3);

      if (error) {
        return [];
      }

      return (data ?? []) as CommunityInput[];
    },
  });
}

export async function buildLabsShowcaseFeed(userId: string | undefined, deps: ShowcaseFeedDeps): Promise<readonly ShowcaseItem[]> {
  const items: ShowcaseItem[] = [];

  if (userId) {
    try {
      const [boards, lastOpenedBoardId, pinnedBoardIds] = await Promise.all([
        deps.listBoards(userId),
        deps.getLastOpened(userId),
        deps.getPinned(userId),
      ]);

      const sortedBoards = sortBoardsForDashboard(
        boards.map((board) => ({
          id: board.id,
          createdAt: board.created_at,
          lastUpdatedAt: board.class_updated_at ?? board.created_at,
        })),
        lastOpenedBoardId,
        [...pinnedBoardIds],
      );

      const boardLookup = new Map(boards.map((board) => [board.id, board]));
      for (const board of sortedBoards.slice(0, 6)) {
        const source = boardLookup.get(board.id);
        if (!source) continue;

        items.push({
          kind: "board",
          id: source.id,
          title: source.title?.trim() || "Untitled board",
          subtitle: "보드",
          href: `/dashboard/boards/${source.id}`,
        });
      }
    } catch {
      // fail-open: keep best-effort from other sources.
    }
  }

  try {
    const posts = await deps.listCommunity();
    for (const post of posts.slice(0, 3)) {
      items.push({
        kind: "community",
        id: post.id,
        title: post.title?.trim() || "커뮤니티 글",
        subtitle: "커뮤니티",
        href: "/community",
      });
    }
  } catch {
    // fail-open
  }

  return items;
}
