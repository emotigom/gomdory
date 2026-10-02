import type { ReactNode } from "react";
import { WebsiteStudioGlassSurface } from "@/app/dashboard/websites/_components/WebsiteStudioGlassSurface";

export default function WebsiteStudioShell({ children, runtime = "local-draft-glass" }: { children: ReactNode; runtime?: string }) {
  return (
    <WebsiteStudioGlassSurface className="mx-auto w-full max-w-[1320px] space-y-6 sm:p-8" >
      <div data-dashboard-websites-scope data-website-studio-theme="glass" data-website-studio-runtime={runtime}>{children}</div>
    </WebsiteStudioGlassSurface>
  );
}
