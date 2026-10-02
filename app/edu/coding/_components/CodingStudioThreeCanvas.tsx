"use client";

import { useEffect, useRef } from "react";

import type { StudioRuntimeSceneTemplate, StudioRuntimeState } from "@/lib/coding-studio/types";

function projectPoint(x: number, z: number, w: number, h: number) {
  const scale = 34;
  const originX = w * 0.5;
  const originY = h * 0.72;
  return {
    x: originX + (x - z) * scale,
    y: originY - (x + z) * scale * 0.45,
  };
}

export function CodingStudioThreeCanvas({
  sceneTemplate,
  runtimeState,
}: {
  sceneTemplate: StudioRuntimeSceneTemplate;
  runtimeState: StudioRuntimeState;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#eff3f8";
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "#d9e0ea";
    ctx.lineWidth = 1;
    for (let i = -5; i <= 5; i++) {
      const a = projectPoint(i, -5, width, height);
      const b = projectPoint(i, 5, width, height);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();

      const c = projectPoint(-5, i, width, height);
      const d = projectPoint(5, i, width, height);
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.stroke();
    }

    const goal = projectPoint(sceneTemplate.goal.x, sceneTemplate.goal.z, width, height);
    ctx.fillStyle = runtimeState.reachedGoal ? "rgba(34, 197, 94, 0.95)" : "rgba(86, 171, 122, 0.85)";
    ctx.beginPath();
    ctx.arc(goal.x, goal.y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(15, 118, 110, 0.45)";
    ctx.lineWidth = 2;
    ctx.stroke();

    for (const obstacle of sceneTemplate.obstacles) {
      const p = projectPoint(obstacle.x, obstacle.z, width, height);
      ctx.fillStyle = runtimeState.blocked ? "#c9735e" : "#d49f82";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
      ctx.fill();
    }

    const agent = projectPoint(runtimeState.x, runtimeState.z, width, height);
    ctx.fillStyle = runtimeState.color;
    ctx.beginPath();
    ctx.arc(agent.x, agent.y, 11, 0, Math.PI * 2);
    ctx.fill();

    const rad = (runtimeState.heading * Math.PI) / 180;
    const tip = projectPoint(runtimeState.x + Math.cos(rad) * 0.35, runtimeState.z + Math.sin(rad) * 0.35, width, height);
    ctx.strokeStyle = "#22375b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(agent.x, agent.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();

    ctx.strokeStyle = "rgba(71, 85, 105, 0.5)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(agent.x, agent.y);
    ctx.lineTo(goal.x, goal.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }, [runtimeState, sceneTemplate]);

  return <canvas className="h-[360px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-[#f8fafc]" ref={canvasRef} />;
}
