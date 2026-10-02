export type ExhibitHighlightKind = "question" | "idea" | "result" | "photo_placeholder";

export type ExhibitHighlight = {
  type: "card";
  title?: string;
  textPreview: string;
  kind: ExhibitHighlightKind;
  score?: number;
};

export type ExhibitPayload = {
  schemaVersion: 1;
  generatedAt: string;
  board: {
    title: string;
    themeHint?: string | null;
    layout: "gallery" | "columns";
    counts: { cards: number; columns: number };
  };
  highlights: ExhibitHighlight[];
  aggregates: {
    questionsCount: number;
    helpCount: number;
    votesSummary?: { pollsCount: number; responsesCount: number };
    pulseSummary?: { total: number };
  };
  timeline: { label: string; count: number }[];
  notes: { teacherMessage?: string };
};
