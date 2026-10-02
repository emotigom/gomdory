export type ConfettiOptions = {
  particleCount?: number;
  durationMs?: number;
  colors?: string[];
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  size: number;
  color: string;
};

const DEFAULT_COLORS = ["#22c55e", "#f97316", "#38bdf8", "#f43f5e", "#facc15"];

export function burstConfetti(options: ConfettiOptions = {}) {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const { particleCount = 90, durationMs = 1600, colors = DEFAULT_COLORS } = options;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const resize = () => {
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  resize();

  canvas.style.position = "fixed";
  canvas.style.inset = "0";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "60";

  document.body.appendChild(canvas);

  const particles: Particle[] = Array.from({ length: particleCount }).map(() => {
    const angle = Math.random() * Math.PI - Math.PI / 2;
    const velocity = 8 + Math.random() * 6;
    return {
      x: window.innerWidth / 2,
      y: window.innerHeight * 0.3,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      rotation: Math.random() * Math.PI,
      rotationSpeed: (Math.random() - 0.5) * 0.3,
      size: 6 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)] ?? DEFAULT_COLORS[0],
    };
  });

  const gravity = 0.22;
  const drag = 0.99;
  const start = performance.now();

  let rafId = 0;

  const tick = (now: number) => {
    const elapsed = now - start;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particles.forEach((particle) => {
      particle.vx *= drag;
      particle.vy = particle.vy * drag + gravity;
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.rotation += particle.rotationSpeed;

      ctx.save();
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.rotation);
      ctx.fillStyle = particle.color;
      ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
      ctx.restore();
    });

    if (elapsed < durationMs) {
      rafId = window.requestAnimationFrame(tick);
    } else {
      cleanup();
    }
  };

  const cleanup = () => {
    window.cancelAnimationFrame(rafId);
    canvas.remove();
    window.removeEventListener("resize", resize);
  };

  window.addEventListener("resize", resize);
  rafId = window.requestAnimationFrame(tick);
}
