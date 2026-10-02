export type KeyboardShortcutHelpItem = {
  id: string;
  key: string;
  description: string;
};

const SHORTCUT_HELP_ITEMS: KeyboardShortcutHelpItem[] = [
  { id: "open-palette", key: "⌘K / Ctrl+K", description: "명령 팔레트 열기" },
  { id: "close-overlay", key: "ESC", description: "팔레트/오버레이 닫기" },
  { id: "navigate-items", key: "↑↓", description: "항목 이동" },
  { id: "run-item", key: "Enter", description: "선택 항목 실행" },
  { id: "context-menu", key: "우클릭 / 롱프레스", description: "컨텍스트 메뉴 열기" },
  { id: "wheel-column-first", key: "휠", description: "컬럼 우선 스크롤" },
];

export function getKeyboardShortcutHelpItems(): KeyboardShortcutHelpItem[] {
  const seen = new Set<string>();
  return SHORTCUT_HELP_ITEMS.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
}
