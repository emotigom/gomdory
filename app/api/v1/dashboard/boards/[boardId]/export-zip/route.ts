import { NextResponse } from "next/server";

import packageJson from "@/package.json";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { presignGetUrl } from "@/lib/r2/client";
import { createZip } from "@/lib/board/zipWriter";
import { readEnvString } from "@/lib/server/runtimeEnv";

type ZipFileEntry = {
  filename: string;
  data: Uint8Array;
};

function sanitizeFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop()?.trim() ?? "";
  const cleaned = base.replace(/[^A-Za-z0-9._-]+/g, "_");
  const fallback = cleaned || "file";

  return fallback.length > 200 ? fallback.slice(0, 200) : fallback;
}

function buildErrorResponse(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;

  const runners = new Array(Math.min(limit, items.length)).fill(null).map(async () => {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await worker(items[current]!);
    }
  });

  await Promise.all(runners);
  return results;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  let userId = "";
  try {
    const { user } = await requireUserApi();
    userId = user.id;
  } catch {
    return buildErrorResponse(401, "로그인이 필요합니다.");
  }

  const { boardId } = await params;
  const supabase = createSupabaseAdminClient();

  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select(
      "id, title, description, board_view_type, rules_text, created_at, class_updated_at, rules_updated_at, share_updated_at, share_write_updated_at, owner_id",
    )
    .eq("id", boardId)
    .maybeSingle();

  if (boardError) {
    return buildErrorResponse(400, boardError.message);
  }

  if (!board || board.owner_id !== userId) {
    return buildErrorResponse(404, "보드를 찾을 수 없습니다.");
  }

  const { data: walls, error: wallError } = await supabase
    .from("walls")
    .select("id, title, position, created_at")
    .eq("board_id", boardId)
    .order("position", { ascending: true });

  if (wallError) {
    return buildErrorResponse(400, wallError.message);
  }

  const wallIds = (walls ?? []).map((wall) => wall.id);

  const { data: cards, error: cardsError } = await supabase
    .from("cards")
    .select(
      "id, wall_id, author_type, author_name, text, created_at, updated_at, is_hidden, is_pinned, pinned_at, is_featured, featured_at, card_color_token, external_attachments",
    )
    .in("wall_id", wallIds.length > 0 ? wallIds : [""])
    .order("created_at", { ascending: true });

  if (cardsError) {
    return buildErrorResponse(400, cardsError.message);
  }

  const cardIds = (cards ?? []).map((card) => card.id);

  const { data: files, error: filesError } = await supabase
    .from("files")
    .select(
      "id, card_id, filename, content_type, size_bytes, r2_key, status, created_at",
    )
    .in("card_id", cardIds.length > 0 ? cardIds : [""])
    .eq("status", "ready");

  if (filesError) {
    return buildErrorResponse(400, filesError.message);
  }

  const filesByCardId = new Map<string, (typeof files)[number][]>();
  (files ?? []).forEach((file) => {
    if (!file.r2_key) {
      return;
    }
    const list = filesByCardId.get(file.card_id) ?? [];
    list.push(file);
    filesByCardId.set(file.card_id, list);
  });

  const fileEntries: ZipFileEntry[] = [];
  const fileIdToEntry = new Map<string, { filename: string; file: (typeof files)[number] }>();
  const toDownload = (files ?? []).filter((file) => file.status === "ready" && file.r2_key);

  await runWithConcurrency(toDownload, 3, async (file) => {
    const downloadUrl = await presignGetUrl({ key: file.r2_key, expiresSeconds: 600 });
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      return;
    }
    const buffer = new Uint8Array(await response.arrayBuffer());
    const safeName = sanitizeFilename(file.filename);
    const zipName = `files/${file.id}__${safeName}`;
    fileEntries.push({ filename: zipName, data: buffer });
    fileIdToEntry.set(file.id, { filename: safeName, file });
  });

  const wallIndexById = new Map<string, number>();
  (walls ?? []).forEach((wall, index) => {
    wallIndexById.set(wall.id, index);
  });

  const updatedAtCandidates = [
    board.class_updated_at,
    board.rules_updated_at,
    board.share_updated_at,
    board.share_write_updated_at,
    board.created_at,
  ]
    .filter(Boolean)
    .map((value) => new Date(value as string).getTime())
    .filter((value) => Number.isFinite(value));
  const updatedAt =
    updatedAtCandidates.length > 0
      ? new Date(Math.max(...updatedAtCandidates)).toISOString()
      : new Date().toISOString();

  const payload = {
    meta: {
      schemaVersion: "gom-board-zip-v1",
      exportedAt: new Date().toISOString(),
      app: "gom-clean",
      appVersion: readEnvString("APP_VERSION") ?? packageJson.version,
    },
    board: {
      title: board.title,
      description: board.description ?? null,
      view_type: board.board_view_type,
      rules_text: board.rules_text ?? null,
      createdAt: board.created_at,
      updatedAt,
    },
    walls: (walls ?? []).map((wall) => ({
      title: wall.title,
      position: wall.position,
      createdAt: wall.created_at,
      tempId: wall.id,
    })),
    cards: (cards ?? []).map((card) => {
      const wallIndex = wallIndexById.get(card.wall_id) ?? 0;
      const internalFiles = (filesByCardId.get(card.id) ?? [])
        .filter((file) => fileIdToEntry.has(file.id))
        .map((file) => ({
          fileId: file.id,
          originalFilename: file.filename,
          mimeType: file.content_type,
          sizeBytes: file.size_bytes,
        }));

      return {
        wallIndex,
        wallTempId: card.wall_id,
        text: card.text,
        author: {
          type: card.author_type,
          name: card.author_name,
        },
        createdAt: card.created_at,
        updatedAt: card.updated_at ?? card.created_at,
        is_hidden: card.is_hidden,
        is_pinned: card.is_pinned,
        pinned_at: card.pinned_at,
        is_featured: card.is_featured,
        featured_at: card.featured_at,
        card_color_token: card.card_color_token,
        internal_files: internalFiles,
        external_attachments: card.external_attachments ?? [],
      };
    }),
  };

  const boardJson = JSON.stringify(payload, null, 2);
  const entries: ZipFileEntry[] = [
    { filename: "board.json", data: new TextEncoder().encode(boardJson) },
    ...fileEntries,
  ];

  const zipBuffer = createZip(entries);
  const filename = `board-${boardId}.zip`;

  return new Response(zipBuffer as BodyInit, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}
