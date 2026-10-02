import { redirect } from "next/navigation";

import { routes } from "@/lib/standards/routes";

export default function DashboardBoardsIndexPage() {
  redirect(routes.page.dashboard.root());
}
