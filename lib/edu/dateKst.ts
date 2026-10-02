const KST_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export const formatDateKst = (date: Date): string => {
  const parts = KST_FORMATTER.formatToParts(date);
  const lookup: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      lookup[part.type] = part.value;
    }
  }
  const year = lookup.year ?? "0000";
  const month = lookup.month ?? "01";
  const day = lookup.day ?? "01";
  return `${year}-${month}-${day}`;
};

const parseDateKst = (dateKst: string): { year: number; month: number; day: number } | null => {
  const match = /^\d{4}-\d{2}-\d{2}$/.exec(dateKst);
  if (!match) return null;
  const [year, month, day] = dateKst.split("-").map((part) => Number(part));
  if (!year || !month || !day) return null;
  return { year, month, day };
};

const dateFromKst = (dateKst: string): Date | null => {
  const parsed = parseDateKst(dateKst);
  if (!parsed) return null;
  return new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
};

const addDaysKst = (dateKst: string, delta: number): string => {
  const base = dateFromKst(dateKst);
  if (!base) return todayKst();
  const next = new Date(base.getTime());
  next.setUTCDate(next.getUTCDate() + delta);
  return formatDateKst(next);
};

export function todayKst(): string {
  return formatDateKst(new Date());
}

export function lastNDatesKst(n: number): string[] {
  const count = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  const today = todayKst();
  const dates: string[] = [];
  for (let i = 0; i < count; i += 1) {
    dates.push(addDaysKst(today, -i));
  }
  return dates;
}

export function weekKeyKst(dateKst: string): string {
  const base = dateFromKst(dateKst);
  if (!base) return `${new Date().getUTCFullYear()}-W01`;
  const date = new Date(base.getTime());
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const diffDays = Math.floor((date.getTime() - yearStart.getTime()) / 86400000) + 1;
  const week = Math.ceil(diffDays / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function startOfWeekKst(dateKst: string): string {
  const base = dateFromKst(dateKst);
  if (!base) return todayKst();
  const date = new Date(base.getTime());
  const day = date.getUTCDay();
  const diff = (day + 6) % 7;
  date.setUTCDate(date.getUTCDate() - diff);
  return formatDateKst(date);
}

export function endOfWeekKst(dateKst: string): string {
  const start = startOfWeekKst(dateKst);
  return addDaysKst(start, 6);
}

export function addDaysFromKst(dateKst: string, delta: number): string {
  return addDaysKst(dateKst, delta);
}

export function startOfWeekFromKeyKst(weekKey: string): string | null {
  const match = /^(\d{4})-W(\d{2})$/.exec(weekKey);
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  if (!year || !week || week < 1 || week > 53) return null;
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4.getTime());
  monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1 + (week - 1) * 7);
  return formatDateKst(monday);
}
