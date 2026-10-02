import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createBoard } from "@/lib/data/boards.server";
import { enableSharing } from "@/lib/data/share";

const KICKSTART_VERSION = 1;
const KICKSTART_TITLE = "첫 수업 보드";
const KICKSTART_DESCRIPTION = "공유코드로 학생을 초대하고, 발표(HUD)로 진행하세요.";

export type KickstartResult = {
  created: boolean;
  skipped: boolean;
  boardId?: string;
};

type KickstartDependencies = {
  claimKickstart: (userId: string, version: number) => Promise<boolean>;
  finalizeKickstart: (userId: string, version: number, kickstartedAt: string) => Promise<void>;
  rollbackKickstart: (userId: string) => Promise<void>;
  createBoard: typeof createBoard;
  ensureShare: typeof enableSharing;
  now: () => string;
};

async function claimKickstart(userId: string, version: number): Promise<boolean> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("user_onboarding")
    .insert({ user_id: userId, kickstart_version: version })
    .select("user_id");

  if (error) {
    if (error.code === "23505") {
      return false;
    }
    throw new Error(error.message);
  }

  return (data ?? []).length > 0;
}

async function finalizeKickstart(userId: string, version: number, kickstartedAt: string): Promise<void> {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("user_onboarding")
    .update({ kickstarted_at: kickstartedAt, kickstart_version: version })
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }
}

async function rollbackKickstart(userId: string): Promise<void> {
  const supabase = createSupabaseServerClient();
  await supabase.from("user_onboarding").delete().eq("user_id", userId).is("kickstarted_at", null);
}

export async function kickstartOnce(
  userId: string,
  deps: Partial<KickstartDependencies> = {},
): Promise<KickstartResult> {
  const claimKickstartFn = deps.claimKickstart ?? claimKickstart;
  const finalizeKickstartFn = deps.finalizeKickstart ?? finalizeKickstart;
  const rollbackKickstartFn = deps.rollbackKickstart ?? rollbackKickstart;
  const createBoardFn = deps.createBoard ?? createBoard;
  const ensureShareFn = deps.ensureShare ?? enableSharing;
  const now = deps.now ?? (() => new Date().toISOString());

  const claimed = await claimKickstartFn(userId, KICKSTART_VERSION);

  if (!claimed) {
    return { created: false, skipped: true };
  }

  try {
    const board = await createBoardFn({
      title: KICKSTART_TITLE,
      description: KICKSTART_DESCRIPTION,
      boardViewType: "grid",
    });

    await ensureShareFn(board.id);
    await finalizeKickstartFn(userId, KICKSTART_VERSION, now());

    return { created: true, skipped: false, boardId: board.id };
  } catch (error) {
    try {
      await rollbackKickstartFn(userId);
    } catch (rollbackError) {
      console.error("kickstart rollback failed", rollbackError);
    }
    throw error;
  }
}
