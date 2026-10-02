export type SessionReport = {
  title: string;
  durationSeconds: number;
  presence: { peak: number; avg: number };
  flow: { steps: Array<{ ts: string; label?: unknown; stepId?: unknown; index?: unknown }> };
  questions: { total: number; pinned: number };
  polls: Array<{ pollId?: unknown; title?: unknown; topOption: string | null; total: number }>;
  pulse: { peak: number };
  highlights?: string[];
};
