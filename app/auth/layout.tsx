import type { ReactNode } from "react";
import type { Metadata } from "next";
import PageMarker, { pageMarkerMetadata } from "@/app/_components/PageMarker";

export const metadata: Metadata = {
  other: pageMarkerMetadata({ page: "auth" }),
};

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageMarker page="auth" renderMeta={false} />
      <div data-auth-interaction-scope>{children}</div>
    </>
  );
}
