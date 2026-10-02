import { type AppAction } from "@/lib/ui/actions/registry";

type DashboardBoardRef = {
  id: string;
  title: string;
  pinned: boolean;
};

export type DashboardActionsContext = {
  selectionMode: boolean;
  selectedCount: number;
  selectedPinnedCount: number;
  visibleBoards: DashboardBoardRef[];
  focusSearch: () => void;
  toggleSelectionMode: () => void;
  bulkCopySelectedLinks: () => void;
  bulkUnpinSelected: () => void;
  bulkDeleteSelected: () => void;
  openBoard: (boardId: string) => void;
  renameBoard: (boardId: string) => void;
  copyBoardLink: (boardId: string) => void;
  toggleBoardPin: (boardId: string) => void;
  deleteBoard: (boardId: string) => void;
};

export function getDashboardActions(context: DashboardActionsContext): AppAction<DashboardActionsContext>[] {
  const actions: AppAction<DashboardActionsContext>[] = [
    {
      id: "dashboard-focus-search",
      label: "보드 검색창으로 이동",
      description: "검색 입력창에 포커스를 둡니다.",
      keywords: ["검색", "search", "focus"],
      group: "dashboard",
      requires: ["authenticated", "dashboard"],
      surfaces: ["palette"],
      when: () => true,
      run: (ctx) => ctx.focusSearch(),
    },
    {
      id: "dashboard-toggle-selection",
      label: context.selectionMode ? "선택 모드 종료" : "선택 모드 시작",
      keywords: ["선택", "bulk", "selection"],
      group: "dashboard",
      requires: ["authenticated", "dashboard"],
      surfaces: ["palette"],
      when: () => true,
      run: (ctx) => ctx.toggleSelectionMode(),
    },
    {
      id: "dashboard-copy-selected-links",
      label: "선택 보드 링크 복사",
      keywords: ["선택", "링크", "copy"],
      group: "dashboard",
      requires: ["authenticated", "dashboard"],
      surfaces: ["palette"],
      when: (ctx) => ctx.selectedCount > 0,
      run: (ctx) => ctx.bulkCopySelectedLinks(),
    },
    {
      id: "dashboard-unpin-selected",
      label: "선택 보드 고정 해제",
      keywords: ["선택", "고정", "unpin"],
      group: "dashboard",
      requires: ["authenticated", "dashboard"],
      surfaces: ["palette"],
      when: (ctx) => ctx.selectedCount > 0,
      run: (ctx) => ctx.bulkUnpinSelected(),
    },
    {
      id: "dashboard-delete-selected",
      label: "선택 보드 삭제",
      keywords: ["선택", "삭제", "delete"],
      group: "dashboard",
      dangerous: true,
      requires: ["authenticated", "dashboard", "canSoftDelete"],
      surfaces: ["palette"],
      when: (ctx) => ctx.selectedCount > 0,
      run: (ctx) => ctx.bulkDeleteSelected(),
    },
  ];

  context.visibleBoards.slice(0, 20).forEach((board) => {
    actions.push(
      {
        id: `dashboard-open-${board.id}`,
        label: `${board.title} 열기`,
        keywords: ["열기", "open", board.title],
        group: "board",
        requires: ["authenticated", "dashboard"],
        surfaces: ["palette", "context"],
        when: () => true,
        run: (ctx) => ctx.openBoard(board.id),
      },
      {
        id: `dashboard-rename-${board.id}`,
        label: `${board.title} 이름 변경`,
        keywords: ["rename", "이름 변경", board.title],
        group: "board",
        requires: ["authenticated", "dashboard"],
        surfaces: ["palette", "context"],
        when: () => true,
        run: (ctx) => ctx.renameBoard(board.id),
      },
      {
        id: `dashboard-copy-link-${board.id}`,
        label: `${board.title} 링크 복사`,
        keywords: ["copy", "링크", board.title],
        group: "board",
        requires: ["authenticated", "dashboard"],
        surfaces: ["palette", "context"],
        when: () => true,
        run: (ctx) => ctx.copyBoardLink(board.id),
      },
      {
        id: `dashboard-pin-toggle-${board.id}`,
        label: board.pinned ? `${board.title} 고정 해제` : `${board.title} 고정`,
        keywords: ["pin", "고정", board.title],
        group: "board",
        requires: ["authenticated", "dashboard"],
        surfaces: ["palette"],
        when: () => true,
        run: (ctx) => ctx.toggleBoardPin(board.id),
      },
      {
        id: `dashboard-delete-${board.id}`,
        label: "삭제",
        keywords: ["삭제", board.title],
        group: "board",
        dangerous: true,
        advanced: true,
        requires: ["authenticated", "dashboard", "canSoftDelete", "showAdvancedActions"],
        surfaces: ["context"],
        when: () => true,
        run: (ctx) => ctx.deleteBoard(board.id),
      },
    );
  });

  return actions;
}

export type TeacherBoardActionsContext = {
  activeWallId: string | null;
  activeWallTitle: string | null;
  hasSelectedCard: boolean;
  hasAnyCard: boolean;
  canCopyStudentLink: boolean;
  presentationEnabled: boolean;
  openCompose: (wallId: string) => void;
  openCreateColumn: () => void;
  openRenameActiveColumn: () => void;
  copyTeacherLink: () => void;
  copyStudentLink: () => void;
  toggleCardSelection: () => void;
  moveSelectedCardLeft: () => void;
  moveSelectedCardRight: () => void;
  deleteSelectedCard: () => void;
  togglePresentation: () => void;
  openColumnRenameFromMenu: () => void;
  resetColumnWidth: () => void;
  copyColumnLinkFromMenu: () => void;
  openCardDetailFromMenu: () => void;
  copyCardLinkFromMenu: () => void;
  deleteCardFromMenu: () => void;
};

export function getTeacherBoardActions(context: TeacherBoardActionsContext): AppAction<TeacherBoardActionsContext>[] {
  return [
    {
      id: "board-add-card",
      label: "카드 추가",
      description: context.activeWallTitle ? `${context.activeWallTitle}에 카드 작성 열기` : "카드 작성 열기",
      keywords: ["카드", "추가", "new", "compose"],
      group: "board",
      requires: ["authenticated", "teacher", "teacherBoard"],
      surfaces: ["palette"],
      when: (ctx) => Boolean(ctx.activeWallId),
      run: (ctx) => {
        if (!ctx.activeWallId) return;
        ctx.openCompose(ctx.activeWallId);
      },
    },
    {
      id: "board-add-column",
      label: "컬럼 추가",
      keywords: ["컬럼", "섹션", "추가"],
      group: "board",
      requires: ["authenticated", "teacher", "teacherBoard"],
      surfaces: ["palette"],
      when: () => true,
      run: (ctx) => ctx.openCreateColumn(),
    },
    {
      id: "board-rename-column",
      label: "컬럼 이름 변경",
      description: context.activeWallTitle ?? "활성 컬럼",
      keywords: ["컬럼", "이름", "변경", "rename"],
      group: "column",
      requires: ["authenticated", "teacher", "teacherBoard"],
      surfaces: ["palette", "context"],
      when: (ctx) => Boolean(ctx.activeWallId),
      run: (ctx) => ctx.openRenameActiveColumn(),
    },
    {
      id: "board-copy-teacher-link",
      label: "교사용 보드 링크 복사",
      keywords: ["링크", "복사", "teacher", "board"],
      group: "board",
      requires: ["authenticated", "teacher", "teacherBoard"],
      surfaces: ["palette"],
      when: () => true,
      run: (ctx) => ctx.copyTeacherLink(),
    },
    {
      id: "board-copy-student-link",
      label: "학생/공유 링크 복사",
      keywords: ["링크", "복사", "student", "share"],
      group: "board",
      requires: ["authenticated", "teacher", "teacherBoard"],
      surfaces: ["palette"],
      when: (ctx) => ctx.canCopyStudentLink,
      run: (ctx) => ctx.copyStudentLink(),
    },
    {
      id: "board-toggle-selection",
      label: context.hasSelectedCard ? "카드 선택 해제" : "카드 선택",
      keywords: ["선택", "selection", "card"],
      group: "card",
      requires: ["authenticated", "teacher", "teacherBoard"],
      surfaces: ["palette"],
      when: () => true,
      run: (ctx) => ctx.toggleCardSelection(),
    },
    {
      id: "board-move-selected-left",
      label: "선택 카드 왼쪽 컬럼으로 이동",
      keywords: ["선택", "이동", "왼쪽", "left"],
      group: "card",
      requires: ["authenticated", "teacher", "teacherBoard"],
      surfaces: ["palette"],
      when: (ctx) => ctx.hasSelectedCard,
      run: (ctx) => ctx.moveSelectedCardLeft(),
    },
    {
      id: "board-move-selected-right",
      label: "선택 카드 오른쪽 컬럼으로 이동",
      keywords: ["선택", "이동", "오른쪽", "right"],
      group: "card",
      requires: ["authenticated", "teacher", "teacherBoard"],
      surfaces: ["palette"],
      when: (ctx) => ctx.hasSelectedCard,
      run: (ctx) => ctx.moveSelectedCardRight(),
    },
    {
      id: "board-delete-selected",
      label: "선택 카드 휴지통으로 이동",
      keywords: ["선택", "삭제", "휴지통"],
      group: "card",
      dangerous: true,
      requires: ["authenticated", "teacher", "teacherBoard", "canSoftDelete"],
      surfaces: ["palette"],
      when: (ctx) => ctx.hasSelectedCard,
      run: (ctx) => ctx.deleteSelectedCard(),
    },
    {
      id: "board-presentation-toggle",
      label: context.presentationEnabled ? "전체 접기(프레젠테이션 종료)" : "전체 펼치기(프레젠테이션 시작)",
      keywords: ["전체", "펼치기", "접기", "presentation"],
      group: "board",
      requires: ["authenticated", "teacher", "teacherBoard"],
      surfaces: ["palette"],
      when: () => true,
      run: (ctx) => ctx.togglePresentation(),
    },
    {
      id: "board-reset-column-width",
      label: "너비 리셋",
      keywords: ["컬럼", "너비", "리셋"],
      group: "column",
      advanced: true,
      requires: ["authenticated", "teacher", "teacherBoard", "showAdvancedActions"],
      surfaces: ["context"],
      when: (ctx) => Boolean(ctx.activeWallId),
      run: (ctx) => ctx.resetColumnWidth(),
    },
    {
      id: "board-copy-column-link",
      label: "컬럼 링크 복사",
      keywords: ["컬럼", "링크", "복사"],
      group: "column",
      advanced: true,
      requires: ["authenticated", "teacher", "teacherBoard", "showAdvancedActions"],
      surfaces: ["context"],
      when: (ctx) => Boolean(ctx.activeWallId),
      run: (ctx) => ctx.copyColumnLinkFromMenu(),
    },
    {
      id: "board-open-card-detail",
      label: "열기(상세)",
      keywords: ["카드", "열기", "상세"],
      group: "card",
      advanced: true,
      requires: ["authenticated", "teacher", "teacherBoard", "showAdvancedActions"],
      surfaces: ["context"],
      when: (ctx) => ctx.hasSelectedCard,
      run: (ctx) => ctx.openCardDetailFromMenu(),
    },
    {
      id: "board-copy-card-link",
      label: "링크 복사",
      keywords: ["카드", "링크", "복사"],
      group: "card",
      advanced: true,
      requires: ["authenticated", "teacher", "teacherBoard", "showAdvancedActions"],
      surfaces: ["context"],
      when: (ctx) => ctx.hasSelectedCard,
      run: (ctx) => ctx.copyCardLinkFromMenu(),
    },
    {
      id: "board-delete-card",
      label: "휴지통으로 이동",
      keywords: ["카드", "삭제", "휴지통"],
      group: "card",
      dangerous: true,
      advanced: true,
      requires: ["authenticated", "teacher", "teacherBoard", "canSoftDelete", "showAdvancedActions"],
      surfaces: ["context"],
      when: (ctx) => ctx.hasSelectedCard,
      run: (ctx) => ctx.deleteCardFromMenu(),
    },
  ];
}

export type StudentBoardActionsContext = {
  activeWallId: string | null;
  activeWallTitle: string | null;
  writeLocked: boolean;
  hasSelectedCard: boolean;
  openCompose: (wallId: string) => void;
  copyShareLink: () => void;
  copyColumnLink: () => void;
  openCardDetail: () => void;
  copyCardLink: () => void;
};

export function getStudentBoardActions(context: StudentBoardActionsContext): AppAction<StudentBoardActionsContext>[] {
  void context;
  return [
    {
      id: "student-add-card",
      label: "카드 추가",
      keywords: ["카드", "추가", "작성"],
      group: "board",
      requires: ["student", "studentBoard", "share"],
      surfaces: ["palette"],
      when: (ctx) => Boolean(ctx.activeWallId) && !ctx.writeLocked,
      run: (ctx) => {
        if (!ctx.activeWallId) return;
        ctx.openCompose(ctx.activeWallId);
      },
    },
    {
      id: "student-copy-share-link",
      label: "학생 링크 복사",
      keywords: ["학생", "링크", "복사", "share"],
      group: "board",
      requires: ["student", "studentBoard", "share"],
      surfaces: ["palette"],
      when: () => true,
      run: (ctx) => ctx.copyShareLink(),
    },
    {
      id: "student-copy-column-link",
      label: "컬럼 링크 복사",
      keywords: ["컬럼", "링크", "복사"],
      group: "column",
      surfaces: ["palette", "context"],
      advanced: true,
      requires: ["student", "studentBoard", "share", "showAdvancedActions"],
      when: (ctx) => Boolean(ctx.activeWallId),
      run: (ctx) => ctx.copyColumnLink(),
    },
    {
      id: "student-open-card-detail",
      label: "열기(상세)",
      keywords: ["카드", "열기", "상세"],
      group: "card",
      surfaces: ["context"],
      advanced: true,
      requires: ["student", "studentBoard", "share", "showAdvancedActions"],
      when: (ctx) => ctx.hasSelectedCard,
      run: (ctx) => ctx.openCardDetail(),
    },
    {
      id: "student-copy-card-link",
      label: "링크 복사",
      keywords: ["카드", "링크", "복사"],
      group: "card",
      surfaces: ["context"],
      advanced: true,
      requires: ["student", "studentBoard", "share", "showAdvancedActions"],
      when: (ctx) => ctx.hasSelectedCard,
      run: (ctx) => ctx.copyCardLink(),
    },
  ];
}
