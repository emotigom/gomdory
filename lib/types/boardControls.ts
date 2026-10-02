export type BoardControlLocks = {
  question: boolean;
  help: boolean;
  pulse: boolean;
};

export type BoardControlHud = {
  showRoster: boolean;
  showPulse: boolean;
  showPinned: boolean;
};

export type BoardReplyTemplate = {
  id: string;
  label: string;
  text: string;
};

export type BoardControls = {
  boardId: string;
  updatedAt: string;
  announcement: string | null;
  locks: BoardControlLocks;
  hud: BoardControlHud;
  replyTemplates: BoardReplyTemplate[];
  pinnedQuestionIds: string[];
  hiddenActionIds: string[];
  resolvedHelpIds: string[];
  version: number;
};

export type BoardControlsPublic = {
  announcement: string | null;
  updatedAt: string;
  locks: BoardControlLocks;
  hud: BoardControlHud;
};
