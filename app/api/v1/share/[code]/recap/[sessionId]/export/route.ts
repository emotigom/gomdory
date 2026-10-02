import { getSharedRecap } from "@/lib/data/recap";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { parseTemplateId, renderMarkdown, type RecapData } from "@/lib/recap/templates";
import { routes } from "@/lib/standards/routes";

type ExportVersion = "v1" | "v2";

function normalizeYamlString(value: string) {
  return value.replace(/"/g, '\\"');
}

function yamlValue(value: string | null | undefined) {
  if (!value) {
    return "null";
  }
  const normalized = value.replace(/\r\n/g, "\n");
  if (normalized.includes("\n")) {
    const lines = normalized.split("\n").map((line) => `  ${line}`);
    return `|\n${lines.join("\n")}`;
  }
  return `"${normalizeYamlString(normalized)}"`;
}

function buildFrontmatter(input: {
  schemaVersion: string;
  templateId: string;
  board: RecapData["board"];
  session: RecapData["session"];
}) {
  return [
    "---",
    `schemaVersion: "${input.schemaVersion}"`,
    `templateId: "${input.templateId}"`,
    "meta:",
    "  board:",
    `    id: "${input.board.id ? input.board.id : ""}"`,
    `    title: "${normalizeYamlString(input.board.title)}"`,
    `    shareCode: "${input.board.shareCode ?? ""}"`,
    "  session:",
    `    id: "${input.session.id ?? ""}"`,
    `    startedAt: "${input.session.startedAt}"`,
    `    endedAt: "${input.session.endedAt}"`,
    "  report:",
    `    title: ${yamlValue(input.session.reportTitle ?? null)}`,
    `    schoolName: ${yamlValue(input.session.schoolName ?? null)}`,
    `    className: ${yamlValue(input.session.className ?? null)}`,
    `    subject: ${yamlValue(input.session.subject ?? null)}`,
    `    teacherName: ${yamlValue(input.session.teacherName ?? null)}`,
    `    periodLabel: ${yamlValue(input.session.periodLabel ?? null)}`,
    `    learningGoals: ${yamlValue(input.session.learningGoals ?? null)}`,
    `    template: ${yamlValue(input.session.reportTemplate ?? null)}`,
    `    updatedAt: ${yamlValue(input.session.reportUpdatedAt ?? null)}`,
    "---",
    "",
  ].join("\n");
}

function buildFileName(
  title: string,
  endedAt: string,
  ext: "json" | "md",
  templateId?: string,
) {
  const date = new Date(endedAt).toISOString().split("T")[0] ?? "recap";
  const sanitized = title
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/(^-+|-+$)/g, "")
    .slice(0, 40);
  const base = sanitized.length > 0 ? sanitized : "board";
  if (ext === "md" && templateId) {
    return `recap-${base}-${date}-${templateId}.${ext}`;
  }
  return `recap-${base}-${date}.${ext}`;
}

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ code: string; sessionId: string }>;
  },
) {
  const requestId = getOrCreateRequestId(request);
  const { code, sessionId } = await params;
  const recap = await getSharedRecap({ code, sessionId });

  if (!recap) {
    const headers = new Headers();
    headers.set("x-request-id", requestId);
    headers.set("x-gom-request-id", requestId);
    return new Response("Not found", { status: 404, headers });
  }

  const url = new URL(request.url);
  const format = url.searchParams.get("format")?.toLowerCase() === "md" ? "md" : "json";
  const exportVersion: ExportVersion = url.searchParams.get("v") === "1" ? "v1" : "v2";
  const templateId = parseTemplateId(
    url.searchParams.get("t") ?? recap.session.reportTemplate,
  );
  const filename = buildFileName(recap.board.title, recap.session.endedAt, format, templateId);

  if (format === "md") {
    const recapData: RecapData = {
      board: {
        id: recap.board.id,
        title: recap.board.title,
        shareCode: recap.board.shareCode,
      },
      session: {
        id: recap.session.id,
        startedAt: recap.session.startedAt,
        endedAt: recap.session.endedAt,
        notice: recap.session.notice,
        rulesText: recap.session.rulesText,
        stats: recap.session.stats,
        reportTitle: recap.session.reportTitle,
        schoolName: recap.session.schoolName,
        className: recap.session.className,
        subject: recap.session.subject,
        teacherName: recap.session.teacherName,
        periodLabel: recap.session.periodLabel,
        learningGoals: recap.session.learningGoals,
        reportTemplate: recap.session.reportTemplate,
        reportUpdatedAt: recap.session.reportUpdatedAt,
      },
      walls: recap.walls.map((wall) => ({
        id: wall.id,
        title: wall.title,
        description: wall.description,
      })),
      cards: recap.cards.map((card) => ({
        id: card.id,
        wallId: card.wallId,
        text: card.text,
        authorType: card.authorType,
        authorName: card.authorName,
        createdAt: card.createdAt,
        isFeatured: card.isFeatured,
        isPinned: card.isPinned,
        files: card.files.map((file) => ({
          id: file.fileId,
          filename: file.filename,
          downloadPath: routes.api.share.files.download(recap.board.shareCode, file.fileId),
        })),
        externalFiles: card.externalAttachments.map((file, index) => ({
          id: `${card.id}-external-${index}`,
          filename: file.filename,
          downloadPath: file.downloadPath ?? undefined,
        })),
      })),
    };
    const markdownBody = renderMarkdown(templateId, recapData);
    const body =
      exportVersion === "v2"
        ? `${buildFrontmatter({
            schemaVersion: "gom-recap-v2",
            templateId,
            board: recapData.board,
            session: recapData.session,
          })}${markdownBody}`
        : markdownBody;
    const headers = new Headers({
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    });
    headers.set("x-request-id", requestId);
    headers.set("x-gom-request-id", requestId);
    return new Response(body, { headers });
  }

  const walls = recap.walls.map((wall) => ({
    id: wall.id,
    title: wall.title,
    cards: recap.cards
      .filter((card) => card.wallId === wall.id)
      .map((card) => ({
        id: card.id,
        text: card.text,
        authorType: card.authorType,
        authorName: card.authorName,
        createdAt: card.createdAt,
        isFeatured: card.isFeatured,
        isPinned: card.isPinned,
        files: [
          ...card.files.map((file) => ({
            id: file.fileId,
            filename: file.filename,
            byteSize: file.byteSize,
            contentType: file.contentType,
            downloadPath: routes.api.share.files.download(recap.board.shareCode, file.fileId),
          })),
          ...card.externalAttachments.map((file, index) => ({
            id: `${card.id}-external-${index}`,
            filename: file.filename,
            byteSize: file.byteSize ?? undefined,
            contentType: file.contentType ?? undefined,
            downloadPath: file.downloadPath ?? undefined,
          })),
        ],
      })),
  }));

  const payload =
    exportVersion === "v2"
      ? {
          schemaVersion: "gom-recap-v2",
          generatedAt: new Date().toISOString(),
          meta: {
            board: {
              id: recap.board.id,
              title: recap.board.title,
              shareCode: recap.board.shareCode,
            },
            session: {
              id: recap.session.id,
              startedAt: recap.session.startedAt,
              endedAt: recap.session.endedAt,
            },
            report: {
              title: recap.session.reportTitle,
              schoolName: recap.session.schoolName,
              className: recap.session.className,
              subject: recap.session.subject,
              teacherName: recap.session.teacherName,
              periodLabel: recap.session.periodLabel,
              learningGoals: recap.session.learningGoals,
              template: recap.session.reportTemplate,
              updatedAt: recap.session.reportUpdatedAt,
            },
          },
          content: {
            notice: recap.session.notice,
            rulesText: recap.session.rulesText,
            stats: recap.session.stats,
            walls: recap.walls.map((wall) => ({
              id: wall.id,
              title: wall.title,
              description: wall.description,
            })),
            cards: recap.cards.map((card) => ({
              id: card.id,
              wallId: card.wallId,
              text: card.text,
              authorType: card.authorType,
              authorName: card.authorName,
              createdAt: card.createdAt,
              isFeatured: card.isFeatured,
              isPinned: card.isPinned,
              attachments: [
                ...card.files.map((file) => ({
                  id: file.fileId,
                  filename: file.filename,
                  byteSize: file.byteSize,
                  contentType: file.contentType,
                  downloadPath: routes.api.share.files.download(recap.board.shareCode, file.fileId),
                  source: "internal" as const,
                })),
                ...card.externalAttachments.map((file, index) => ({
                  id: `${card.id}-external-${index}`,
                  filename: file.filename,
                  byteSize: file.byteSize ?? undefined,
                  contentType: file.contentType ?? undefined,
                  downloadPath: file.downloadPath ?? undefined,
                  source: "external" as const,
                })),
              ],
            })),
          },
        }
      : {
          schema: "gom-recap",
          version: 1,
          generatedAt: new Date().toISOString(),
          board: {
            id: recap.board.id,
            title: recap.board.title,
            shareCode: recap.board.shareCode,
          },
          session: {
            id: recap.session.id,
            startedAt: recap.session.startedAt,
            endedAt: recap.session.endedAt,
            notice: recap.session.notice,
            rulesText: recap.session.rulesText,
            stats: recap.session.stats,
          },
          walls,
        };

  const headers = new Headers({
    "content-type": "application/json; charset=utf-8",
    "content-disposition": `attachment; filename="${filename}"`,
  });
  headers.set("x-request-id", requestId);
  headers.set("x-gom-request-id", requestId);
  return new Response(JSON.stringify(payload, null, 2), { headers });
}
