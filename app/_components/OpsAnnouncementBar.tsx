import Link from "next/link";

import type { ActiveOpsBanner } from "@/lib/ops/banners.server";

const levelClass: Record<ActiveOpsBanner["level"], string> = {
  info: "border-sky-200 bg-sky-50 text-sky-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  maintenance: "border-violet-200 bg-violet-50 text-violet-900",
};

const levelLabel: Record<ActiveOpsBanner["level"], string> = {
  info: "안내",
  warning: "주의",
  maintenance: "점검",
};

export default function OpsAnnouncementBar({ banner }: { banner: ActiveOpsBanner }) {
  return (
    <div className={`border-b px-3 py-1.5 text-xs sm:px-4 ${levelClass[banner.level]}`}>
      <div className="mx-auto flex max-w-7xl items-center gap-2">
        <span className="font-semibold">{levelLabel[banner.level]}</span>
        <p className="line-clamp-1 flex-1">{banner.message}</p>
        {banner.href ? (
          <Link href={banner.href} className="font-semibold underline underline-offset-2">
            {banner.label ?? "자세히"}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
