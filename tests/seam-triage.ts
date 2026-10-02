export type SeamTriageGuide = {
  seam: string;
  summary: string;
  sourceOfTruth: readonly string[];
  validateEntrypoint?: string;
  fastCommands: readonly string[];
  docs?: readonly string[];
  violations?: readonly string[];
};

const formatList = (label: string, items: readonly string[]) => {
  if (items.length === 0) {
    return null;
  }

  return [label, ...items.map((item) => `- ${item}`)].join("\n");
};

export const formatSourceOfTruthNote = (sourceOfTruth: readonly string[]) =>
  `Authoritative sources: ${sourceOfTruth.join(", ")}`;

export const formatSeamTriageGuide = ({
  seam,
  summary,
  sourceOfTruth,
  validateEntrypoint = "npm run validate:seams",
  fastCommands,
  docs = [],
  violations = [],
}: SeamTriageGuide) => {
  const sections = [
    `${seam} seam drifted away from the documented contract.`,
    summary,
    formatSourceOfTruthNote(sourceOfTruth),
    `Validation entrypoint: ${validateEntrypoint}`,
    formatList("Run next (entrypoint first, then narrow by seam):", fastCommands),
    formatList("Reference docs / tests:", docs),
    violations.length > 0 ? ["Violations:", ...violations].join("\n") : null,
  ].filter(Boolean);

  return sections.join("\n");
};
