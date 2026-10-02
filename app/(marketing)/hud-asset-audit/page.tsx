import { marketingHudAssetSlots, marketingHudAssets } from '@/lib/marketing/marketingHudAssets';
import { notFound } from 'next/navigation';

const placementHints: Record<string, string> = {
  heroRightPanel: 'Hero command panel',
  heroTopBar: 'Hero top status strip',
  tabStrip: 'Hero/artifact tabs',
  cardFrame: 'Outcome and artifact cards',
  privacyShieldIcon: 'Trust medallion',
  commandSurfaceOverlay: 'Hero/final CTA texture',
};

export default function HudAssetAuditPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  return (
    <main className="mx-auto max-w-6xl px-6 py-10" data-testid="hud-asset-audit">
      <h1 className="text-2xl font-semibold">HUD Asset Audit (dev only)</h1>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {marketingHudAssetSlots.map((slot) => {
          const url = marketingHudAssets[slot];
          return (
            <article key={slot} className="rounded-xl border border-slate-600 bg-slate-950/80 p-4 text-slate-100">
              <p className="font-semibold">{slot}</p>
              <p className="mt-1 break-all text-xs text-slate-300">{url}</p>
              <p className="mt-1 text-xs text-cyan-200">{placementHints[slot] ?? 'Decorative/utility slot'}</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" aria-hidden="true" className="mt-3 h-24 w-full rounded border border-slate-700 object-contain" />
              <p className="mt-2 text-xs text-slate-400">Load state: browser network/devtools</p>
            </article>
          );
        })}
      </div>
    </main>
  );
}
