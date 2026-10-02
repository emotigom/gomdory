import { requireUser } from "@/lib/auth/requireUser";
import { getPlanSummaryForUser } from "@/lib/billing/entitlements";
import { getTemplateProState, fetchCommunityTemplates } from "@/lib/data/templateLibrary";

import { TemplateLibraryClient } from "./TemplateLibraryClient";

export const dynamic = "force-dynamic";

export default async function CommunityTemplatePage() {
  const { user } = await requireUser("/dashboard/templates/community");
  const { templates, engagement } = await fetchCommunityTemplates(user);
  const plan = await getPlanSummaryForUser(user.id);
  const proState = getTemplateProState(user, plan);

  return (
    <main className="space-y-8 p-4 md:p-8" data-page-marker="dashboard-templates-community">
      <TemplateLibraryClient
        templates={templates}
        likedTemplateIds={Array.from(engagement.likedTemplateIds)}
        reviews={Array.from(engagement.reviewsByTemplate.entries()).map(([templateId, review]) => ({
          templateId,
          rating: review.rating,
          comment: review.comment,
        }))}
        proEnabled={proState.enabled}
        isProUser={proState.hasAccess}
      />
    </main>
  );
}
