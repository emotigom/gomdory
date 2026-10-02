export const dynamic = "force-dynamic";

import { requireUser } from "@/lib/auth/requireUser";
import StorageUsagePageClient from "./StorageUsagePageClient";
import { routes } from "@/lib/standards/routes";

export default async function StorageDashboardPage() {
  await requireUser(routes.page.dashboard.storage());

  return (
    <main data-page-marker="dashboard-storage">
      <StorageUsagePageClient />
    </main>
  );
}
