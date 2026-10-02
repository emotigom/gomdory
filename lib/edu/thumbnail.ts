export type EduThumbParams = {
  title: string;
  authorName?: string;
  lessonTitle?: string;
  slug?: string;
  h1?: string;
};

export function extractTitleHintsFromHtml(html: string): { title?: string; h1?: string } {
  if (!html) return {};

  if (typeof DOMParser !== "undefined") {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const title = doc.querySelector("title")?.textContent?.trim() ?? undefined;
    const h1 = doc.querySelector("h1")?.textContent?.trim() ?? undefined;
    return { title: title || undefined, h1: h1 || undefined };
  }

  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const rawTitle = titleMatch?.[1]?.trim();
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const rawH1 = h1Match?.[1]?.trim();

  return {
    title: rawTitle || undefined,
    h1: rawH1 ? stripTags(rawH1) : undefined,
  };
}

export async function makeEduThumbnailBlob(params: EduThumbParams): Promise<Blob> {
  const W = 1200;
  const H = 630;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas ctx");

  ctx.clearRect(0, 0, W, H);

  const gradient = ctx.createLinearGradient(0, 0, W, H);
  gradient.addColorStop(0, "#a7f3d0");
  gradient.addColorStop(0.5, "#fef9c3");
  gradient.addColorStop(1, "#bfdbfe");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  const pad = 64;
  ctx.save();
  ctx.shadowColor = "rgba(15, 23, 42, 0.12)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = "rgba(255,255,255,0.96)";
  roundRect(ctx, pad, pad, W - pad * 2, H - pad * 2, 36);
  ctx.fill();
  ctx.restore();

  const badgeText = getLessonBadgeText(params.lessonTitle);
  drawBadge(ctx, pad + 48, pad + 38, 64, badgeText);
  drawCornerBadge(ctx, W - pad - 230, pad + 30, 190, 44, badgeText);
  drawStickerStar(ctx, W - pad - 40, pad + 36, 20, "#facc15");
  drawStickerStar(ctx, pad + 70, H - pad - 70, 22, "#fb7185");

  ctx.fillStyle = "#0f172a";
  ctx.textBaseline = "top";
  const title = clampText(params.title, 64);
  const titleLines = splitIntoLines(ctx, title, W - pad * 2 - 96, "800 64px");
  ctx.font = "800 64px system-ui, -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
  ctx.fillText(titleLines[0] ?? title, pad + 48, pad + 120);

  if (titleLines.length > 1) {
    ctx.font = "800 52px system-ui, -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
    ctx.fillText(titleLines[1], pad + 48, pad + 200);
  }

  const subtitle = [params.lessonTitle, params.authorName ? `by ${params.authorName}` : ""]
    .filter(Boolean)
    .join(" · ");

  if (subtitle) {
    ctx.fillStyle = "#334155";
    ctx.font = "700 28px system-ui, -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
    wrapText(ctx, clampText(subtitle, 90), pad + 48, pad + 290, W - pad * 2 - 96, 36, 2);
  }

  if (params.h1) {
    ctx.fillStyle = "#475569";
    ctx.font = "600 24px system-ui, -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
    wrapText(ctx, clampText(params.h1, 120), pad + 48, pad + 380, W - pad * 2 - 96, 32, 3);
  }

  ctx.fillStyle = "#64748b";
  ctx.font = "500 22px system-ui, -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
  const footer = ["gomdory · EDU", params.slug ? `/${params.slug}` : ""]
    .filter(Boolean)
    .join(" ");
  ctx.fillText(footer, pad + 48, H - pad - 42);

  return await canvasToBlob(canvas, "image/png");
}

type CanvasLike = HTMLCanvasElement | OffscreenCanvas;

type Canvas2DContext =
  | CanvasRenderingContext2D
  | OffscreenCanvasRenderingContext2D
  | null;

function createCanvas(width: number, height: number): CanvasLike {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

async function canvasToBlob(canvas: CanvasLike, type: "image/png"): Promise<Blob> {
  if ("convertToBlob" in canvas) {
    return canvas.convertToBlob({ type });
  }

  return await new Promise<Blob>((resolve, reject) => {
    const htmlCanvas = canvas as HTMLCanvasElement;
    htmlCanvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("toBlob failed"));
        return;
      }
      resolve(blob);
    }, type);
  });
}

function stripTags(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function roundRect(ctx: NonNullable<Canvas2DContext>, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function clampText(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

function splitIntoLines(ctx: NonNullable<Canvas2DContext>, text: string, maxWidth: number, font: string) {
  ctx.save();
  ctx.font = `${font} system-ui, -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif`;
  const words = Array.from(text);
  const lines: string[] = [];
  let line = "";

  words.forEach((char) => {
    const next = line + char;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line.trimEnd());
      line = char.trimStart();
    } else {
      line = next;
    }
  });

  if (line) lines.push(line.trimEnd());
  ctx.restore();
  return lines.slice(0, 2);
}

function getLessonBadgeText(lessonTitle?: string) {
  if (!lessonTitle) return "LESSON";
  const match = lessonTitle.match(/(\d+)/);
  if (!match) return "LESSON";
  return `LESSON ${match[1]}`;
}

function drawBadge(
  ctx: NonNullable<Canvas2DContext>,
  x: number,
  y: number,
  radius: number,
  text: string,
) {
  ctx.save();
  ctx.fillStyle = "#facc15";
  ctx.shadowColor = "rgba(15, 23, 42, 0.18)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.fillStyle = "#1e293b";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "800 18px system-ui, -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawStickerStar(
  ctx: NonNullable<Canvas2DContext>,
  cx: number,
  cy: number,
  radius: number,
  color: string,
) {
  const spikes = 5;
  const step = Math.PI / spikes;
  const innerRadius = radius * 0.45;

  ctx.save();
  ctx.fillStyle = color;
  ctx.shadowColor = "rgba(15, 23, 42, 0.18)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i += 1) {
    const r = i % 2 === 0 ? radius : innerRadius;
    const x = cx + Math.cos(i * step - Math.PI / 2) * r;
    const y = cy + Math.sin(i * step - Math.PI / 2) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawCornerBadge(
  ctx: NonNullable<Canvas2DContext>,
  x: number,
  y: number,
  width: number,
  height: number,
  text: string,
) {
  ctx.save();
  ctx.fillStyle = "#0f172a";
  ctx.shadowColor = "rgba(15, 23, 42, 0.12)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;
  roundRect(ctx, x, y, width, height, 22);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.fillStyle = "#f8fafc";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "800 18px system-ui, -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
  ctx.fillText(text, x + width / 2, y + height / 2);
  ctx.restore();
}

function wrapText(
  ctx: NonNullable<Canvas2DContext>,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 2,
) {
  let line = "";
  let lineCount = 0;
  let yy = y;

  for (const char of Array.from(text)) {
    const next = line + char;
    if (ctx.measureText(next).width > maxWidth && line) {
      ctx.fillText(line.trimEnd(), x, yy);
      lineCount += 1;
      if (lineCount >= maxLines) {
        return;
      }
      yy += lineHeight;
      line = char.trimStart();
    } else {
      line = next;
    }
  }

  if (line && lineCount < maxLines) {
    ctx.fillText(line.trimEnd(), x, yy);
  }
}
