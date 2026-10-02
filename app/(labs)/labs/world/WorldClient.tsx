"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { detectImmersiveVrSupport, type WebXrSupportState } from "@/lib/labs/webxrSupport";

type ShowcaseItem = {
  kind: "board" | "community";
  id: string;
  title: string;
  href: string;
  subtitle?: string;
};

type PanelProjection = {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
};

const PANEL_COLORS: Record<ShowcaseItem["kind"], string> = {
  board: "#22d3ee",
  community: "#a78bfa",
};

function computePanels(canvasWidth: number, canvasHeight: number, itemCount: number): PanelProjection[] {
  if (itemCount === 0) return [];

  const columns = Math.min(3, itemCount);
  const rows = Math.ceil(itemCount / columns);
  const laneWidth = canvasWidth / (columns + 1);
  const laneHeight = canvasHeight / (rows + 1);

  const panels: PanelProjection[] = [];
  for (let index = 0; index < itemCount; index += 1) {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const depth = row / Math.max(rows - 1, 1);
    const scale = 1 - depth * 0.3;
    const width = 180 * scale;
    const height = 98 * scale;
    const perspectiveShift = (col - (columns - 1) / 2) * 18 * (1 - depth);

    panels.push({
      index,
      x: laneWidth * (col + 1) + perspectiveShift - width / 2,
      y: laneHeight * (row + 1) - height / 2,
      width,
      height,
      depth,
    });
  }

  return panels.sort((a, b) => a.depth - b.depth);
}

export default function WorldClient({ initialItems }: { initialItems: readonly ShowcaseItem[] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [support, setSupport] = useState<WebXrSupportState | null>(null);
  const [showList, setShowList] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [xrMessage, setXrMessage] = useState<string | null>(null);

  const items = useMemo(() => initialItems.slice(0, 9), [initialItems]);

  useEffect(() => {
    let mounted = true;
    void detectImmersiveVrSupport().then((result) => {
      if (mounted) setSupport(result);
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || showList) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const panels = computePanels(canvas.width, canvas.height, items.length);

    const render = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#0b1120";
      context.fillRect(0, 0, canvas.width, canvas.height);

      context.strokeStyle = "#1f2937";
      context.lineWidth = 1;
      for (let i = 1; i < 7; i += 1) {
        const y = (canvas.height / 7) * i;
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(canvas.width, y);
        context.stroke();
      }

      for (const panel of panels) {
        const item = items[panel.index];
        if (!item) continue;

        const active = hoveredIndex === panel.index;
        const baseColor = PANEL_COLORS[item.kind];

        context.fillStyle = active ? "#f8fafc" : "#111827";
        context.fillRect(panel.x, panel.y, panel.width, panel.height);
        context.strokeStyle = active ? baseColor : "#334155";
        context.lineWidth = active ? 3 : 2;
        context.strokeRect(panel.x, panel.y, panel.width, panel.height);

        context.fillStyle = active ? "#111827" : "#e2e8f0";
        context.font = `${Math.floor(15 * (1 - panel.depth * 0.25))}px sans-serif`;
        context.fillText(item.title.slice(0, 16), panel.x + 10, panel.y + panel.height / 2);

        context.fillStyle = active ? baseColor : "#94a3b8";
        context.font = `${Math.floor(11 * (1 - panel.depth * 0.25))}px sans-serif`;
        context.fillText(item.kind === "board" ? "BOARD" : "COMMUNITY", panel.x + 10, panel.y + panel.height - 10);
      }
    };

    render();

    const toCanvasPoint = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((event.clientX - rect.left) / rect.width) * canvas.width,
        y: ((event.clientY - rect.top) / rect.height) * canvas.height,
      };
    };

    const pickPanelIndex = (x: number, y: number) => {
      const picked = [...panels].reverse().find((panel) => x >= panel.x && x <= panel.x + panel.width && y >= panel.y && y <= panel.y + panel.height);
      return picked?.index ?? null;
    };

    const onMove = (event: MouseEvent) => {
      const point = toCanvasPoint(event);
      const nextIndex = pickPanelIndex(point.x, point.y);
      setHoveredIndex((prev) => (prev === nextIndex ? prev : nextIndex));
    };

    const onClick = (event: MouseEvent) => {
      event.preventDefault();
      const point = toCanvasPoint(event);
      const nextIndex = pickPanelIndex(point.x, point.y);
      if (nextIndex === null) return;

      const target = items[nextIndex];
      if (!target) return;
      window.open(target.href, "_blank", "noopener,noreferrer");
    };

    const onLeave = () => setHoveredIndex(null);

    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("mouseleave", onLeave);

    return () => {
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("mouseleave", onLeave);
    };
  }, [hoveredIndex, items, showList]);

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-neutral-200 p-4 text-sm text-neutral-700">
        <p>헤드셋 없이도 마우스/키보드로 볼 수 있습니다.</p>
      </div>

      {showList ? null : (
        <canvas
          ref={canvasRef}
          width={900}
          height={420}
          className="h-72 w-full rounded-lg border border-neutral-200 bg-neutral-950"
          style={{ touchAction: "none" }}
          aria-label="VR 월드 쇼케이스 패널"
        />
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-800 disabled:cursor-not-allowed disabled:text-neutral-400"
          disabled={!support?.supported}
          onClick={() => setXrMessage("준비 중입니다.")}
        >
          VR로 시도
        </button>
        <button
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-800"
          onClick={() => setShowList((prev) => !prev)}
          type="button"
        >
          {showList ? "3D로 보기" : "목록으로 보기"}
        </button>
      </div>

      {!support?.supported ? <p className="text-xs text-neutral-500">{support?.reason ?? "WebXR 지원 확인 중"}</p> : null}
      {xrMessage ? <p className="text-xs text-neutral-500">{xrMessage}</p> : null}

      {showList ? (
        <ul className="space-y-2 text-sm text-neutral-700">
          {items.map((item) => (
            <li key={`${item.kind}-${item.id}`} className="flex items-center justify-between rounded border border-neutral-200 px-3 py-2">
              <div className="min-w-0">
                <span className="mr-2 rounded bg-neutral-100 px-2 py-0.5 text-xs uppercase text-neutral-600">{item.kind}</span>
                <span className="truncate">{item.title}</span>
              </div>
              <Link className="text-sm text-blue-700 underline" href={item.href} target="_blank" rel="noreferrer">
                열기
              </Link>
            </li>
          ))}
          {items.length === 0 ? <li className="rounded border border-neutral-200 px-3 py-2 text-neutral-500">표시할 항목이 없습니다.</li> : null}
        </ul>
      ) : null}
    </section>
  );
}
