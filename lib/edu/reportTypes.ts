export type EduReportKey =
  | "prewarm_runs"
  | "prewarm_ok"
  | "prewarm_partial"
  | "share_ensure_ok"
  | "share_ensure_fail"
  | "netsaver_auto_downgrade"
  | "boost_started"
  | "boost_completed"
  | "endclass_runs";

export type EduDailyReport = {
  dateKST: string;
  boardId: string;
  codeHash?: string;
  totals: Record<EduReportKey, number>;
  lastEvents: Array<{ ts: number; type: string }>;
  headline: {
    level: "green" | "yellow" | "red";
    text: string;
    guidance: string;
  };
};
