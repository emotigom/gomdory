import type { ReactNode } from "react";
import type { Metadata } from "next";
import PageMarker, { pageMarkerMetadata } from "@/app/_components/PageMarker";

export const metadata: Metadata = {
  other: pageMarkerMetadata({ page: "share", view: "feed" }),
  robots: {
    index: false,
    follow: false,
  },
};

export default function ShareLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageMarker page="share" view="feed" renderMeta={false} />
      {children}
    </>
  );
}
