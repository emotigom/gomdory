import { headers } from "next/headers";

import { listCardsForShare } from "@/lib/data/share";
import {
  getHost,
  redirectToHostIfNeeded,
  STUDENT_HOST,
  TEACHER_HOST,
} from "@/lib/http/hosts";
import { resolvePublicShareWall } from "@/lib/share/public/access";

import ClassBanner from "../../../../components/ClassBanner";
import ClassEndedOverlay from "../../../../components/ClassEndedOverlay";
import RulesOverlay from "../../../../components/RulesOverlay";
import SlideDeck from "./SlideDeck";
import WallRealtimeRefresh from "../WallRealtimeRefresh";

export default async function SharedWallSlidesPage({
  params,
}: {
  params: Promise<{ code: string; wallId: string }>;
}) {
  const requestHeaders = await headers();
  const host = await getHost();

  await redirectToHostIfNeeded({
    desiredHost: STUDENT_HOST,
    requestUrl: new URL(
      requestHeaders.get("x-url") ?? "/s",
      `https://${host || TEACHER_HOST}`,
    ),
  });

  const { code, wallId } = await params;
  const { board, wall } = await resolvePublicShareWall({ code, wallId });

  if (!board) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6 text-center">
        <h1 className="text-2xl font-semibold text-gray-900">공유를 찾을 수 없습니다</h1>
        <p className="text-gray-600">올바른 6자리 코드를 확인해주세요.</p>
      </div>
    );
  }

  if (!wall) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6 text-center">
        <h1 className="text-2xl font-semibold text-gray-900">담벼락을 찾을 수 없습니다</h1>
        <p className="text-gray-600">다시 시도해주세요.</p>
      </div>
    );
  }

  const cards = await listCardsForShare(wall.id, { order: "asc" });
  const featuredCards = cards.filter((card) => card.is_featured);
  const pinnedCards = cards.filter((card) => !card.is_featured && card.is_pinned);
  const normalCards = cards.filter((card) => !card.is_featured && !card.is_pinned);

  const orderedCards = [...featuredCards, ...pinnedCards, ...normalCards].map((card) => ({
    id: card.id,
    text: card.text,
    author_name: card.author_name,
    author_type: card.author_type,
    created_at: card.created_at,
    is_featured: card.is_featured,
    is_pinned: card.is_pinned,
    card_color_token: card.card_color_token,
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      <WallRealtimeRefresh wallId={wallId} />
      {board.class_state === "ended" ? (
        <ClassEndedOverlay notice={board.class_notice} />
      ) : null}
      <RulesOverlay rulesText={board.rules_text} notice={board.class_notice} />
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        <ClassBanner
          state={board.class_state}
          notice={board.class_notice}
          variant="projector"
        />
        <SlideDeck cards={orderedCards} wallTitle={wall.title} />
      </div>
    </div>
  );
}
