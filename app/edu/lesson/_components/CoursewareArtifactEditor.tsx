import type { CoursewareArtifactDraft } from "@/lib/edu/courseware/aiCoursewareDraftTypes";

import ChecklistArtifactEditor from "./artifact-editors/ChecklistArtifactEditor";
import GenericArtifactEditor from "./artifact-editors/GenericArtifactEditor";
import LinkArtifactEditor from "./artifact-editors/LinkArtifactEditor";
import RevisionComparisonEditor from "./artifact-editors/RevisionComparisonEditor";
import TextArtifactEditor from "./artifact-editors/TextArtifactEditor";

export default function CoursewareArtifactEditor({ draft, onChange }: { draft: CoursewareArtifactDraft; onChange: (next: CoursewareArtifactDraft) => void }) {
  if (["checklist", "safety-check"].includes(draft.artifactType)) return <ChecklistArtifactEditor draft={draft} onChange={onChange} />;
  if (draft.artifactType === "revision-comparison") return <RevisionComparisonEditor draft={draft} onChange={onChange} />;
  if (["survey", "chart", "banner", "web-page-draft", "published-page", "info-card-page", "qr-share-card", "presentation-slides", "ai-classification-result"].includes(draft.artifactType)) return <LinkArtifactEditor draft={draft} onChange={onChange} />;
  if (["bingo", "role-card", "prompt-card", "problem-card", "topic-card", "data-insight", "rule-table", "recommender-design", "ai-error-log", "source-card", "copy-set", "page-plan", "feedback-card", "revision-log", "portfolio-outline", "showcase", "reflection-card"].includes(draft.artifactType)) return <TextArtifactEditor draft={draft} onChange={onChange} />;
  return <GenericArtifactEditor draft={draft} onChange={onChange} />;
}
