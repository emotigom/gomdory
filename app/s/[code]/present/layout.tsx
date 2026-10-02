import type { ReactNode } from "react";
import type { Metadata } from "next";
import PageMarker, { pageMarkerMetadata } from "@/app/_components/PageMarker";

export const metadata: Metadata = {
  other: pageMarkerMetadata({ page: "share", view: "present" }),
  robots: {
    index: false,
    follow: false,
  },
};

export default function PresentLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageMarker page="share" view="present" renderMeta={false} />
      {children}
    </>
  );
}
