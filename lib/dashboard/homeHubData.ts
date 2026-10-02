export type DashboardHomeHubBoard = {
  id: string;
  title?: string | null;
  created_at?: string | null;
};

export type DashboardHomeHubAuthState = {
  isAuthenticated?: boolean;
};

export type DashboardHomeHubModelInput = {
  boards?: DashboardHomeHubBoard[];
  authState?: DashboardHomeHubAuthState;
  envMissing: boolean;
  requestId?: string;
  slots?: DashboardHomeHubModelSlot[];
};

export type DashboardHomeHubModelSlotInput = DashboardHomeHubModelInput;

export type DashboardHomeHubModelSlotPartial = {
  now?: {
    items?: DashboardHomeHubModel["now"]["items"];
  };
  shortcuts?: {
    items?: DashboardHomeHubModel["shortcuts"]["items"];
  };
};

export type DashboardHomeHubModelSlot = {
  id: string;
  build: (input: DashboardHomeHubModelSlotInput) => DashboardHomeHubModelSlotPartial;
};

export type DashboardHomeHubModel = {
  nextAction: {
    title: string;
    hint: string;
  };
  now: {
    title: string;
    hint: string;
    items: Array<{
      id: string;
      title: string;
      createdAtLabel: string;
    }>;
    emptyMessage: string;
    ctaLabel: string;
    ctaHref: string;
  };
  shortcuts: {
    title: string;
    hint: string;
    items: Array<{
      id: string;
      label: string;
      href: string;
    }>;
  };
  debugMarkers?: {
    kind: "env-missing" | "model-build-failed";
    message: string;
    requestId?: string;
  };
};

const FALLBACK_SHORTCUTS: DashboardHomeHubModel["shortcuts"]["items"] = [
  { id: "file", label: "파일", href: "/dashboard/files" },
  { id: "gallery", label: "갤러리", href: "/dashboard/gallery" },
  { id: "template", label: "템플릿", href: "/dashboard/templates" },
  { id: "settings", label: "설정", href: "/dashboard/settings/customize" },
];

export const BoardsSlot: DashboardHomeHubModelSlot = {
  id: "boards",
  build: (input) => ({
    now: {
      items: (input.boards ?? []).slice(0, 3).map((board) => ({
        id: board.id,
        title: board.title?.trim() ? board.title : "제목 없는 보드",
        createdAtLabel: formatDateLabel(board.created_at),
      })),
    },
  }),
};

export const TipsSlot: DashboardHomeHubModelSlot = {
  id: "tips",
  build: () => ({
    now: {
      items: [
        {
          id: "tip-quick-create",
          title: "새 보드 바로 만들기",
          createdAtLabel: "바로가기",
        },
      ],
    },
  }),
};

export const TroubleshootSlot: DashboardHomeHubModelSlot = {
  id: "troubleshoot",
  build: (input) => ({
    now: {
      items: input.envMissing
        ? [
            {
              id: "troubleshoot-env",
              title: "데이터 연결 필요",
              createdAtLabel: "환경 확인",
            },
          ]
        : [],
    },
  }),
};

function formatDateLabel(value: string | null | undefined) {
  if (!value) return "날짜 정보 없음";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "날짜 정보 없음";
  }

  return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

export function buildDashboardHomeHubModel(input: DashboardHomeHubModelInput): DashboardHomeHubModel {
  const baseModel: DashboardHomeHubModel = {
    nextAction: {
      title: "새 보드",
      hint: input.envMissing
        ? "데이터 연결 필요"
        : input.authState?.isAuthenticated === false
          ? "로그인 후 새 보드를 만들 수 있어요"
          : "이름만 정하면 바로 시작",
    },
    now: {
      title: "최근 보드",
      hint: input.envMissing ? "데이터 연결 필요" : "최근에 연 수업",
      items: [],
      emptyMessage: input.envMissing ? "데이터 연결 필요" : "아직 만든 보드가 없어요",
      ctaLabel: "보드 목록 열기",
      ctaHref: "/dashboard",
    },
    shortcuts: {
      title: "바로가기",
      hint: "파일·갤러리·템플릿·설정",
      items: FALLBACK_SHORTCUTS,
    },
    debugMarkers: input.envMissing
      ? {
          kind: "env-missing",
          message: "데이터 연결 필요",
          requestId: input.requestId,
        }
      : undefined,
  };

  const slots = input.slots ?? (input.envMissing ? [TroubleshootSlot] : [BoardsSlot, TipsSlot]);

  try {
    return slots.reduce<DashboardHomeHubModel>((acc, slot) => {
      const partial = slot.build(input);
      if (partial.now?.items?.length) {
        acc.now.items = [...acc.now.items, ...partial.now.items];
      }
      if (partial.shortcuts?.items?.length) {
        acc.shortcuts.items = [...acc.shortcuts.items, ...partial.shortcuts.items];
      }
      return acc;
    }, baseModel);
  } catch {
    return {
      ...baseModel,
      now: {
        ...baseModel.now,
        items: [],
      },
      debugMarkers: {
        kind: "model-build-failed",
        message: "홈 화면을 열지 못했어요.",
        requestId: input.requestId,
      },
    };
  }
}
