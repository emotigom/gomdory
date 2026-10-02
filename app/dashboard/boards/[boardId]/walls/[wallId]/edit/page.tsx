import Link from "next/link";
import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth/requireUser";
import { getWall } from "@/lib/data/walls";

import { updateWallAction } from "./actions";

export default async function WallEditPage({
  params,
}: {
  params: Promise<{ boardId: string; wallId: string }>;
}) {
  const { boardId, wallId } = await params;
  await requireUser(`/dashboard/boards/${boardId}/walls/${wallId}/edit`);
  const wall = await getWall(boardId, wallId);

  if (!wall) {
    return notFound();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-gray-900">담벼락 수정</h1>
        <p className="text-sm text-gray-600">담벼락 제목과 설명을 수정합니다.</p>
      </div>

      <form
        action={updateWallAction.bind(null, boardId, wallId)}
        className="space-y-4"
      >
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-900" htmlFor="title">
            제목
          </label>
          <input
            id="title"
            name="title"
            defaultValue={wall.title}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-gray-900 focus:outline-none"
            maxLength={60}
            required
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-900" htmlFor="description">
            설명
          </label>
          <textarea
            id="description"
            name="description"
            defaultValue={wall.description ?? ""}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-gray-900 focus:outline-none"
            rows={4}
            maxLength={200}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <Link
            href={`/dashboard/boards/${boardId}/walls/${wallId}`}
            className="text-sm font-medium text-gray-600 hover:text-gray-800"
          >
            돌아가기
          </Link>
          <button
            type="submit"
            className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
          >
            저장
          </button>
        </div>
      </form>
    </div>
  );
}
