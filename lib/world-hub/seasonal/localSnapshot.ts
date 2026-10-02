import type { WorldHubSeasonalDecorationContext } from "@/lib/world-hub/seasonal/contracts";

const DAY_MS = 24 * 60 * 60 * 1000;

type SeasonalWindow = {
  id: string;
  label: string;
  detail: string;
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
  layers: Array<{
    layerId: string;
    label: string;
    detail: string;
    zone: "home-lane" | "central-plaza" | "academy-lodge-approach";
    accent: string;
    suppresses: Array<"home-lane-celebration" | "class-celebration" | "session-celebration">;
  }>;
};

const PREVIEW_WINDOWS: SeasonalWindow[] = [
  {
    id: "spring-trail-lanterns",
    label: "Spring Trail Lanterns",
    detail: "Lantern strings and petal accents guide learners between home, plaza, and academy routes.",
    startMonth: 3,
    startDay: 1,
    endMonth: 4,
    endDay: 30,
    layers: [
      {
        layerId: "spring-home-petals",
        label: "Home petals",
        detail: "A gentle petal ring around keepsake anchors near the home campfire.",
        zone: "home-lane",
        accent: "#f9a8d4",
        suppresses: ["home-lane-celebration"],
      },
      {
        layerId: "spring-plaza-lanterns",
        label: "Plaza lantern strings",
        detail: "Soft lantern strings around the plaza gather ring.",
        zone: "central-plaza",
        accent: "#fcd34d",
        suppresses: ["session-celebration"],
      },
    ],
  },
  {
    id: "harvest-hearth-week",
    label: "Harvest Hearth Week",
    detail: "Warm harvest ribbons keep shared areas festive while preserving readable mission launch cues.",
    startMonth: 10,
    startDay: 12,
    endMonth: 11,
    endDay: 6,
    layers: [
      {
        layerId: "harvest-home-ribbons",
        label: "Home ribbon knots",
        detail: "Ribbon markers around home props emphasize belonging-first return moments.",
        zone: "home-lane",
        accent: "#f59e0b",
        suppresses: ["home-lane-celebration"],
      },
      {
        layerId: "harvest-academy-banners",
        label: "Academy banners",
        detail: "Subtle banner arc near academy approach; class cues remain dominant.",
        zone: "academy-lodge-approach",
        accent: "#fb923c",
        suppresses: ["session-celebration"],
      },
    ],
  },
];

function getWindowRange(args: {
  now: Date;
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
}) {
  const year = args.now.getUTCFullYear();
  const start = new Date(Date.UTC(year, args.startMonth - 1, args.startDay, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, args.endMonth - 1, args.endDay, 23, 59, 59, 999));
  return { start, end };
}

export function getLocalWorldHubSeasonalSnapshot(args: {
  context: WorldHubSeasonalDecorationContext;
  now: Date;
}) {
  const activeWindow = PREVIEW_WINDOWS.find((window) => {
    const { start, end } = getWindowRange({ now: args.now, ...window });
    const nowMs = args.now.getTime();
    return nowMs >= start.getTime() && nowMs <= end.getTime();
  });

  if (activeWindow) {
    const range = getWindowRange({ now: args.now, ...activeWindow });
    return {
      status: "active" as const,
      matchedWindowId: activeWindow.id,
      title: `${activeWindow.label} is live`,
      detail: activeWindow.detail,
      chips: ["Home-first seasonal pass", "Shared lanes stay readable"],
      layers: activeWindow.layers.map((layer) => ({
        ...layer,
        status: "active" as const,
        active: true,
        activeFromIso: range.start.toISOString(),
        activeUntilIso: range.end.toISOString(),
      })),
    };
  }

  const upcomingWindow = PREVIEW_WINDOWS.map((window) => {
    const range = getWindowRange({ now: args.now, ...window });
    return {
      window,
      startMs: range.start.getTime(),
      endMs: range.end.getTime(),
    };
  })
    .filter((entry) => entry.startMs > args.now.getTime())
    .sort((left, right) => left.startMs - right.startMs)[0];

  if (upcomingWindow) {
    const daysUntil = Math.max(1, Math.ceil((upcomingWindow.startMs - args.now.getTime()) / DAY_MS));
    return {
      status: "upcoming" as const,
      matchedWindowId: upcomingWindow.window.id,
      title: `${upcomingWindow.window.label} is coming`,
      detail: `${upcomingWindow.window.detail} Starts in about ${daysUntil} day${daysUntil === 1 ? "" : "s"}.`,
      chips: [`Starts in ~${daysUntil}d`, "Preview schedule snapshot"],
      layers: upcomingWindow.window.layers.map((layer) => ({
        ...layer,
        status: "upcoming" as const,
        active: false,
        activeFromIso: new Date(upcomingWindow.startMs).toISOString(),
        activeUntilIso: new Date(upcomingWindow.endMs).toISOString(),
      })),
    };
  }

  return {
    status: "inactive" as const,
    matchedWindowId: null,
    title: "Seasonal layer is resting",
    detail: "No scheduled seasonal layer is active today. Home, class, and session cues remain lightweight.",
    chips: ["Base hub readability mode", args.context.classId ? "Class context linked" : "Preview context"],
    layers: [],
  };
}
