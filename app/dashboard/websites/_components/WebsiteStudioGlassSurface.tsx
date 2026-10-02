import Image from "next/image";
import type { ReactNode } from "react";
import { websiteStudioGlassAssets } from "@/lib/website-studio/websiteStudioGlassAssets";

export function WebsiteStudioGlassSurface({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section data-website-studio-theme="glass" className={`relative overflow-hidden rounded-3xl border border-cyan-300/25 bg-slate-950/70 p-6 text-slate-100 shadow-[0_0_64px_rgba(34,211,238,0.12)] backdrop-blur ${className}`}>
      <DecorativeShellAsset />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_0%,rgba(34,211,238,0.18),transparent_34%),radial-gradient(circle_at_84%_100%,rgba(59,130,246,0.14),transparent_40%),linear-gradient(180deg,rgba(2,6,23,0.46),rgba(2,6,23,0.74))]" />
      <div className="relative z-10">{children}</div>
    </section>
  );
}

export function WebsiteStudioWorkspaceFrame({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 xl:grid-cols-[300px_minmax(480px,1fr)_440px]">{children}</div>;
}

export function WebsiteStudioGlassPanel({ children, title, label, className = "" }: { children: ReactNode; title?: string; label?: string; className?: string }) {
  return (
    <section className={`dashboard-websites-card relative overflow-hidden rounded-2xl border border-[rgba(80,180,220,0.22)] bg-[rgba(8,18,34,0.78)] p-4 shadow-[0_12px_42px_rgba(15,23,42,0.35)] ${className}`}>
      <div className="relative z-10">{label ? <p className="text-xs font-semibold text-cyan-200">{label}</p> : null}{title ? <h2 className="text-lg font-semibold text-slate-100">{title}</h2> : null}{children}</div>
    </section>
  );
}

export function WebsiteStudioPreviewShell({ children }: { children: ReactNode }) {
  return <div className="dashboard-websites-preview relative rounded-xl border border-cyan-300/20 bg-slate-950/50 p-3">{children}</div>;
}

function DecorativeShellAsset() {
  return (
    <div className="pointer-events-none absolute inset-0 h-full w-full object-cover">
      <Image
        aria-hidden="true"
        alt=""
        src={websiteStudioGlassAssets.shellFrame}
        fill
        sizes="100vw"
        loading="lazy"
        slot="shellFrame" className="opacity-12"
      />
    </div>
  );
}
