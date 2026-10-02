export type ClassMode = "collect" | "organize" | "present";

export const CLASS_MODE_LABELS: Record<ClassMode, string> = {
  collect: "수집",
  organize: "정리",
  present: "발표",
};

export type ClassModeDefaults = {
  inboxOnly?: boolean;
  uiPrefs?: {
    density?: "comfortable" | "compact";
    textClampLines?: 2 | 3 | 4;
    showKeyboardHints?: boolean;
  };
  disableSort?: boolean;
  disableSelection?: boolean;
  keyboardHints?: boolean;
  emphasis?: "input" | "bulk" | "focus";
};

export function getModeDefaults(mode: ClassMode): ClassModeDefaults {
  if (mode === "collect") {
    return {
      inboxOnly: true,
      uiPrefs: {
        density: "comfortable",
        textClampLines: 3,
        showKeyboardHints: true,
      },
      disableSort: true,
      emphasis: "input",
    };
  }

  if (mode === "organize") {
    return {
      uiPrefs: {
        density: "comfortable",
        textClampLines: 3,
        showKeyboardHints: true,
      },
      emphasis: "bulk",
    };
  }

  return {
    inboxOnly: false,
    uiPrefs: {
      density: "comfortable",
      textClampLines: 4,
      showKeyboardHints: true,
    },
    disableSelection: true,
    disableSort: true,
    keyboardHints: true,
    emphasis: "focus",
  };
}
