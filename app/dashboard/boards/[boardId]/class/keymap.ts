export type KeySpec = string;

export type KeymapCommandId =
  | "togglePalette"
  | "toggleSort"
  | "toggleSelection"
  | "focusSearch"
  | "navUp"
  | "navDown"
  | "openActive"
  | "toggleSelectActive"
  | "undo"
  | "redo"
  | "toggleSafeMode"
  | "classModeCollect"
  | "classModeOrganize"
  | "classModePresent"
  | "toggleFullscreen"
  | "applyPinned1"
  | "applyPinned2"
  | "applyPinned3"
  | "applyPinned4"
  | "applyPinned5"
  | "togglePinnedView"
  | "setDefaultView";

export type KeymapValue = KeySpec | KeySpec[] | null;

export type Keymap = Record<KeymapCommandId, KeymapValue>;

export type NormalizedKeymap = Record<KeymapCommandId, KeySpec[]>;

export const KEYMAP_COMMANDS: Array<{ id: KeymapCommandId; label: string; description: string }> = [
  {
    id: "togglePalette",
    label: "명령 팔레트 토글",
    description: "명령 팔레트를 열거나 닫습니다.",
  },
  {
    id: "toggleSort",
    label: "정렬 토글",
    description: "드래그 정렬 모드를 전환합니다.",
  },
  {
    id: "toggleSelection",
    label: "선택 모드 토글",
    description: "카드 선택 모드를 전환합니다.",
  },
  {
    id: "focusSearch",
    label: "검색 포커스",
    description: "검색 입력창으로 이동합니다.",
  },
  {
    id: "navUp",
    label: "위로 이동",
    description: "카드 포커스를 위로 이동합니다.",
  },
  {
    id: "navDown",
    label: "아래로 이동",
    description: "카드 포커스를 아래로 이동합니다.",
  },
  {
    id: "openActive",
    label: "카드 열기",
    description: "선택된 카드를 엽니다.",
  },
  {
    id: "toggleSelectActive",
    label: "활성 카드 선택",
    description: "현재 카드의 선택 상태를 전환합니다.",
  },
  {
    id: "toggleSafeMode",
    label: "교실 Safe Mode",
    description: "TV 노출용 간결한 모드를 전환합니다.",
  },
  {
    id: "classModeCollect",
    label: "수집 모드",
    description: "입력 중심 수집 모드로 전환합니다.",
  },
  {
    id: "classModeOrganize",
    label: "정리 모드",
    description: "태그·대량 작업에 집중하는 모드로 전환합니다.",
  },
  {
    id: "classModePresent",
    label: "발표 모드",
    description: "발표/프로젝터 친화 모드로 전환합니다.",
  },
  {
    id: "toggleFullscreen",
    label: "전체화면 토글",
    description: "발표 모드 전체화면을 전환합니다.",
  },
  {
    id: "undo",
    label: "되돌리기",
    description: "최근 작업을 되돌립니다.",
  },
  {
    id: "redo",
    label: "다시 실행",
    description: "되돌린 작업을 다시 실행합니다.",
  },
  {
    id: "applyPinned1",
    label: "고정 뷰 1 적용",
    description: "첫 번째 고정 뷰를 적용합니다.",
  },
  {
    id: "applyPinned2",
    label: "고정 뷰 2 적용",
    description: "두 번째 고정 뷰를 적용합니다.",
  },
  {
    id: "applyPinned3",
    label: "고정 뷰 3 적용",
    description: "세 번째 고정 뷰를 적용합니다.",
  },
  {
    id: "applyPinned4",
    label: "고정 뷰 4 적용",
    description: "네 번째 고정 뷰를 적용합니다.",
  },
  {
    id: "applyPinned5",
    label: "고정 뷰 5 적용",
    description: "다섯 번째 고정 뷰를 적용합니다.",
  },
  {
    id: "togglePinnedView",
    label: "현재 뷰 핀 전환",
    description: "현재 적용된 뷰를 핀/해제합니다.",
  },
  {
    id: "setDefaultView",
    label: "현재 뷰 기본 설정",
    description: "현재 적용된 뷰를 기본 뷰로 지정합니다.",
  },
];

export const KEYMAP_LABELS = new Map(KEYMAP_COMMANDS.map((command) => [command.id, command.label]));

export const REQUIRED_NAVIGATION_COMMANDS = new Set<KeymapCommandId>([
  "navUp",
  "navDown",
  "openActive",
  "toggleSelectActive",
]);

export const DEFAULT_KEYMAP: NormalizedKeymap = {
  togglePalette: ["Mod+K"],
  toggleSort: ["S"],
  toggleSelection: ["X"],
  focusSearch: ["/"],
  navUp: ["ArrowUp", "K"],
  navDown: ["ArrowDown", "J"],
  openActive: ["Enter"],
  toggleSelectActive: ["Space"],
  toggleSafeMode: ["Shift+M"],
  classModeCollect: ["Shift+1"],
  classModeOrganize: ["Shift+2"],
  classModePresent: ["Shift+3"],
  toggleFullscreen: ["F"],
  undo: ["Mod+Z"],
  redo: ["Shift+Mod+Z", "Mod+Y"],
  applyPinned1: ["Alt+1"],
  applyPinned2: ["Alt+2"],
  applyPinned3: ["Alt+3"],
  applyPinned4: ["Alt+4"],
  applyPinned5: ["Alt+5"],
  togglePinnedView: [],
  setDefaultView: [],
};
