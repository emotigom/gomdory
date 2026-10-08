import type { SharedBoardViewModel, SharedCardAttachment } from "@/lib/boards/toSharedViewModel";
import type { ShareBoard } from "@/lib/data/share";
import type { CardColorToken } from "@/lib/types/cards";
import { routes } from "@/lib/standards/routes";

export const Q2_B10_FIXTURE_MODE = "multi-user-polling-v1";
export const Q2_B10_BOARD_ID = "00000000-0000-4000-8000-0000000000ba";
export const Q2_B10_OWNER_ID = "00000000-0000-4000-8000-0000000000bb";
export const Q2_B10_SHARE_CODE = "q2b10a";
export const Q2_B10_WALL_A_ID = "00000000-0000-4000-8000-0000000000bc";
export const Q2_B10_WALL_B_ID = "00000000-0000-4000-8000-0000000000bd";
export const Q2_B11_WALL_C_ID = "00000000-0000-4000-8000-0000000000be";
export const Q2_B11_WALL_D_ID = "00000000-0000-4000-8000-0000000000bf";
export const Q2_B11_WALL_E_ID = "00000000-0000-4000-8000-0000000000c0";
export const Q2_B10_RESET_PATH = "/api/q2/browser/multi-user-polling-fixture/reset";
export const Q2_B10_SNAPSHOT_PATH = "/api/q2/browser/multi-user-polling-fixture/snapshot";
export const Q2_B10_STATE_PATH = "/api/q2/browser/multi-user-polling-fixture/state";
export const Q2_B11_VISUAL_RESET_PATH = "/api/q2/browser/b11-design-accessibility-fixture/reset";
export const Q2_B11_VISUAL_WALLPAPER_URL =
  "/lesson-kits/html/lesson-13-ai-photo-card-starter/assets/stage-ceremony-textless.png";

type FixtureWall = {
  id: string;
  title: string;
  description: string;
  uiColorToken: string | null;
};

type Card = {
  id: string;
  wallId: string;
  position: number;
  authorClientId: string | null;
  authorType: "teacher" | "student";
  authorName: string;
  text: string;
  createdAt: string;
  isHidden: boolean;
  hiddenAt: string | null;
  cardColorToken: CardColorToken | null;
  attachments: SharedCardAttachment[];
};

type FixtureUpload = {
  cardId: string;
  clientId: string;
  filename: string;
  contentType: string;
};

type Store = {
  cards: Card[];
  stateVersion: number;
  storeGeneration: number;
  resetCount: number;
  mutationCount: number;
  creates: number;
  hides: number;
  unhides: number;
  polls: Record<string, number>;
  visualStress: boolean;
  classState: "live" | "ended";
  uploadSequence: number;
  initiatedFiles: Map<string, FixtureUpload>;
  finalizedUploads: number;
};

const STORE = Symbol.for("gomdory.q2.b10.multi-user-polling-store");

const BASE_WALLS: FixtureWall[] = [
  {
    id: Q2_B10_WALL_A_ID,
    title: "동시 작성",
    description: "Q2-B10 fixture wall A",
    uiColorToken: null,
  },
  {
    id: Q2_B10_WALL_B_ID,
    title: "교사 확인",
    description: "Q2-B10 fixture wall B",
    uiColorToken: null,
  },
];

const VISUAL_STRESS_WALLS: FixtureWall[] = [
  {
    id: Q2_B10_WALL_A_ID,
    title: "아이디어 정리",
    description: "수업 중 떠오른 생각과 질문을 모아요.",
    uiColorToken: "sky",
  },
  {
    id: Q2_B10_WALL_B_ID,
    title: "참고 사이트",
    description: "수업 중 다시 볼 링크와 도구를 모아요.",
    uiColorToken: "green",
  },
  {
    id: Q2_B11_WALL_C_ID,
    title: "수업 자료",
    description: "파일과 활동 자료를 한곳에서 확인해요.",
    uiColorToken: "yellow",
  },
  {
    id: Q2_B11_WALL_D_ID,
    title: "지난 링크",
    description: "이전 차시에서 사용한 링크를 보관해요.",
    uiColorToken: "purple",
  },
  {
    id: Q2_B11_WALL_E_ID,
    title: "방명록",
    description: "짧은 소감과 응원을 남겨요.",
    uiColorToken: "pink",
  },
];

const visualAttachment = (
  id: string,
  type: SharedCardAttachment["type"],
  label: string,
  url: string,
  contentType?: string,
): SharedCardAttachment => ({
  id,
  type,
  label,
  url,
  contentType: contentType ?? null,
});

function visualStressCards(): Card[] {
  const at = "2026-10-03T00:00:00.000Z";
  const seed = (
    serial: number,
    wallId: string,
    position: number,
    text: string,
    options?: {
      authorType?: "teacher" | "student";
      authorName?: string;
      color?: CardColorToken | null;
      attachments?: SharedCardAttachment[];
    },
  ): Card => ({
    id: `00000000-0000-4000-8000-${String(1000 + serial).padStart(12, "0")}`,
    wallId,
    position,
    authorClientId: options?.authorType === "student" ? `b11-seed-${serial}` : null,
    authorType: options?.authorType ?? "teacher",
    authorName: options?.authorName ?? (options?.authorType === "student" ? "학생" : "선생님"),
    text,
    createdAt: at,
    isHidden: false,
    hiddenAt: null,
    cardColorToken: options?.color ?? null,
    attachments: options?.attachments ?? [],
  });

  return [
    seed(1, Q2_B10_WALL_A_ID, 0, "AI로 해결해 보고 싶은 학교생활 문제를 한 문장으로 적어 보세요.", { color: "sky" }),
    seed(2, Q2_B10_WALL_A_ID, 1, "질문: 이미지 생성 AI가 같은 프롬프트에서도 다른 그림을 만드는 이유는 무엇일까요?", { authorType: "student", color: "yellow" }),
    seed(3, Q2_B10_WALL_A_ID, 2, "긴 한국어 예시입니다. 교실 뒤에서도 읽을 수 있는 줄간격과 카드 폭, 메뉴 위치를 함께 확인하기 위한 시각 검증 문장입니다.", { color: "green" }),
    seed(4, Q2_B10_WALL_B_ID, 0, "웹 제작 참고 링크\nhttps://developer.mozilla.org/ko/", {
      color: "purple",
      attachments: [visualAttachment("b11-ext-1", "external", "MDN Web Docs", "https://developer.mozilla.org/ko/")],
    }),
    seed(5, Q2_B10_WALL_B_ID, 1, "Chrome Music Lab Song Maker\nhttps://musiclab.chromeexperiments.com/Song-Maker/", {
      authorType: "student",
      color: "pink",
      attachments: [visualAttachment("b11-ext-2", "external", "Song Maker", "https://musiclab.chromeexperiments.com/Song-Maker/")],
    }),
    seed(6, Q2_B10_WALL_B_ID, 2, "띄어쓰기없는긴문자열레이아웃검증ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", { color: "orange" }),
    seed(7, Q2_B11_WALL_C_ID, 0, "11-12차시 AI 이미지 생성 발표 자료", {
      color: "yellow",
      attachments: [visualAttachment("b11-file-1", "file", "AI-image-generation-11-12.pdf", routes.api.share.files.download(Q2_B10_SHARE_CODE, "b11-file-1"), "application/pdf")],
    }),
    seed(8, Q2_B11_WALL_C_ID, 1, "13-14차시 AI 포토 카드 스타터", {
      color: "sky",
      attachments: [visualAttachment("b11-file-2", "file", "ai-photo-card-starter.zip", routes.api.share.files.download(Q2_B10_SHARE_CODE, "b11-file-2"), "application/zip")],
    }),
    seed(9, Q2_B11_WALL_C_ID, 2, "노트북에 설치하는 코드 편집기와 실행 순서를 확인해요.\n1. 파일 열기\n2. 수정하기\n3. 브라우저에서 확인하기", { color: "green" }),
    seed(10, Q2_B11_WALL_D_ID, 0, "지난 교재\nhttps://gomdory.com/learn/ai-image-generation-11-12", {
      attachments: [visualAttachment("b11-ext-3", "external", "지난 교재", "https://gomdory.com/learn/ai-image-generation-11-12")],
    }),
    seed(11, Q2_B11_WALL_D_ID, 1, "TensorFlow Playground\nhttps://playground.tensorflow.org/", { color: "purple" }),
    seed(12, Q2_B11_WALL_D_ID, 2, "Quick, Draw!\nhttps://quickdraw.withgoogle.com/", { authorType: "student", color: "sky" }),
    seed(13, Q2_B11_WALL_D_ID, 3, "Teachable Machine\nhttps://teachablemachine.withgoogle.com/", { color: "orange" }),
    seed(14, Q2_B11_WALL_E_ID, 0, "오늘 수업 재밌었어요! 다음 시간에는 음악 AI도 해보고 싶어요.", { authorType: "student", color: "pink" }),
    seed(15, Q2_B11_WALL_E_ID, 1, "선생님 화이팅!! 🌱", { authorType: "student", color: "green" }),
    seed(16, Q2_B11_WALL_E_ID, 2, "친구 작품을 보고 아이디어를 하나 더 얻었습니다.", { authorType: "student", color: "yellow" }),
  ];
}

function registry() {
  const scope = globalThis as typeof globalThis & { [STORE]?: Store };
  return scope;
}

function create(previous?: Store, visualStress = false): Store {
  return {
    cards: visualStress ? visualStressCards() : [],
    stateVersion: (previous?.stateVersion ?? 0) + 1,
    storeGeneration: (previous?.storeGeneration ?? 0) + 1,
    resetCount: (previous?.resetCount ?? 0) + 1,
    mutationCount: 0,
    creates: 0,
    hides: 0,
    unhides: 0,
    polls: {},
    visualStress,
    classState: "live",
    uploadSequence: 0,
    initiatedFiles: new Map(),
    finalizedUploads: 0,
  };
}

export function resetQ2B10Fixture() {
  const next = create(registry()[STORE], false);
  registry()[STORE] = next;
  return next;
}

export function resetQ2B11VisualStressFixture() {
  const next = create(registry()[STORE], true);
  registry()[STORE] = next;
  return next;
}

export function q2B10Store() {
  return registry()[STORE] ?? resetQ2B10Fixture();
}

function wallsForStore(store: Store): FixtureWall[] {
  return store.visualStress ? VISUAL_STRESS_WALLS : BASE_WALLS;
}

function view(store = q2B10Store()): SharedBoardViewModel {
  const columns = wallsForStore(store).map((wall) => {
    const cards = store.cards
      .filter((card) => card.wallId === wall.id && !card.isHidden)
      .sort((a, b) => a.position - b.position)
      .map((card) => ({
        id: card.id,
        wallId: card.wallId,
        position: card.position,
        text: card.text,
        authorType: card.authorType,
        authorName: card.authorName,
        authorClientId: card.authorClientId,
        createdAt: card.createdAt,
        isPinned: false,
        isFeatured: false,
        cardColorToken: card.cardColorToken,
        attachments: card.attachments,
      }));

    return {
      id: wall.id,
      title: wall.title,
      description: wall.description,
      uiColorToken: wall.uiColorToken,
      studentWriteEnabled: true,
      cards,
      featuredCards: [],
      pinnedCards: [],
      totalCount: cards.length,
    };
  });

  return { columns };
}

export function q2B10StudentFixture(clientLabel?: string) {
  const store = q2B10Store();
  if (clientLabel) store.polls[clientLabel] = (store.polls[clientLabel] ?? 0) + 1;

  const board: ShareBoard = {
    id: Q2_B10_BOARD_ID,
    owner_id: Q2_B10_OWNER_ID,
    title: store.visualStress ? "AI 수업 공유 보드 · 시각 검증" : "Q2 B10 다중 사용자 테스트 보드",
    description: store.visualStress ? "실제 수업 밀도를 닮은 Q2-B11 로컬 시각 검증 fixture" : null,
    board_view_type: "wall",
    wall_v2_enabled: false,
    share_code: Q2_B10_SHARE_CODE,
    share_enabled: true,
    share_updated_at: "2026-07-21T00:00:00.000Z",
    share_write_enabled: true,
    share_write_updated_at: "2026-07-21T00:00:00.000Z",
    class_state: store.classState,
    class_notice: null,
    class_updated_at: "2026-07-21T00:00:00.000Z",
    rules_text: null,
    rules_updated_at: "2026-07-21T00:00:00.000Z",
    tools_enabled: [],
    tools_updated_at: "2026-07-21T00:00:00.000Z",
    ui_minimap_mode: "hover",
    ui_theme_config: store.visualStress ? "calm" : null,
  };

  return {
    board,
    viewModel: view(store),
    stateVersion: store.stateVersion,
    wallpaperUrl: store.visualStress ? Q2_B11_VISUAL_WALLPAPER_URL : null,
    visualStress: store.visualStress,
  };
}

export function q2B10WriteGuard() {
  const store = q2B10Store();
  if (store.classState === "ended") {
    return { ok: false as const, code: "CLASS_ENDED", message: "class_ended", status: 403 };
  }
  return { ok: true as const };
}

export function setQ2B10ClassState(classState: "live" | "ended") {
  const store = q2B10Store();
  if (store.classState === classState) return { classState, stateVersion: store.stateVersion };
  store.classState = classState;
  store.mutationCount += 1;
  store.stateVersion += 1;
  return { classState, stateVersion: store.stateVersion };
}

export function createQ2B10Card(input: { text: string; authorClientId: string }) {
  const store = q2B10Store();
  const text = input.text.trim();
  if (!text) return null;
  const existing = store.cards.find(
    (card) => card.authorClientId === input.authorClientId && card.text === text,
  );
  if (existing) return existing;

  const card: Card = {
    id: `00000000-0000-4000-8000-${String(store.cards.length + 100).padStart(12, "0")}`,
    wallId: Q2_B10_WALL_A_ID,
    position: store.cards.filter((item) => item.wallId === Q2_B10_WALL_A_ID).length,
    authorClientId: input.authorClientId,
    authorType: "student",
    authorName: "학생",
    text,
    createdAt: new Date().toISOString(),
    isHidden: false,
    hiddenAt: null,
    cardColorToken: null,
    attachments: [],
  };
  store.cards.push(card);
  store.creates += 1;
  store.mutationCount += 1;
  store.stateVersion += 1;
  return card;
}

export function createQ2B10UploadIntent(input: {
  cardId: string;
  clientId: string;
  filename: string;
  contentType: string;
}) {
  const store = q2B10Store();
  const card = store.cards.find((item) => item.id === input.cardId);
  if (!card || card.authorType !== "student" || card.authorClientId !== input.clientId) return null;
  store.uploadSequence += 1;
  const fileId = `q2-b10-file-${store.uploadSequence}`;
  store.initiatedFiles.set(fileId, {
    cardId: input.cardId,
    clientId: input.clientId,
    filename: input.filename,
    contentType: input.contentType,
  });
  return {
    fileId,
    uploadUrl: `/api/q2/browser/student-card-fixture/upload/${fileId}`,
    deduped: false,
  };
}

export function finalizeQ2B10Upload(fileId: string, clientId: string) {
  const store = q2B10Store();
  const upload = store.initiatedFiles.get(fileId);
  if (!upload || upload.clientId !== clientId) return false;
  const card = store.cards.find((item) => item.id === upload.cardId);
  if (!card || card.authorClientId !== clientId) return false;
  if (!card.attachments.some((attachment) => attachment.id === fileId)) {
    card.attachments.push({
      id: fileId,
      type: "file",
      label: upload.filename,
      url: routes.api.share.files.download(Q2_B10_SHARE_CODE, fileId),
      contentType: upload.contentType,
    });
    store.finalizedUploads += 1;
    store.mutationCount += 1;
    store.stateVersion += 1;
  }
  return true;
}

export function deleteQ2B10Upload(fileId: string, clientId: string) {
  const store = q2B10Store();
  const upload = store.initiatedFiles.get(fileId);
  if (!upload || upload.clientId !== clientId) return false;
  store.initiatedFiles.delete(fileId);
  const card = store.cards.find((item) => item.id === upload.cardId);
  if (card) {
    card.attachments = card.attachments.filter((attachment) => attachment.id !== fileId);
  }
  return true;
}

export function setQ2B10Visibility(cardId: string, hidden: boolean) {
  const store = q2B10Store();
  const card = store.cards.find((item) => item.id === cardId);
  if (!card) return null;
  card.isHidden = hidden;
  card.hiddenAt = hidden ? new Date().toISOString() : null;
  store[hidden ? "hides" : "unhides"] += 1;
  store.mutationCount += 1;
  store.stateVersion += 1;
  return { card, stateVersion: store.stateVersion };
}

function teacherAttachment(attachment: SharedCardAttachment) {
  const kind =
    attachment.type === "external"
      ? "url"
      : attachment.contentType?.startsWith("image/")
        ? "image"
        : attachment.contentType?.includes("pdf")
          ? "document"
          : "file";
  return {
    id: attachment.id,
    attachmentId: attachment.id,
    fileId: attachment.type === "file" ? attachment.id : null,
    boardFileId: attachment.type === "file" ? attachment.id : null,
    kind,
    label: attachment.label,
    url: attachment.url,
    contentType: attachment.contentType ?? null,
    size: null,
  } as const;
}

export function q2B10TeacherWalls() {
  const store = q2B10Store();
  return wallsForStore(store).map((wall) => ({
    wall: {
      id: wall.id,
      title: wall.title,
      description: wall.description,
    },
    cards: store.cards
      .filter((card) => card.wallId === wall.id)
      .sort((a, b) => a.position - b.position)
      .map((card) => ({
        id: card.id,
        wall_id: card.wallId,
        owner_id: Q2_B10_OWNER_ID,
        author_type: card.authorType,
        author_name: card.authorName,
        author_client_id: card.authorClientId,
        text: card.text,
        is_hidden: card.isHidden,
        hidden_at: card.hiddenAt,
        is_featured: false,
        featured_at: null,
        card_color_token: card.cardColorToken,
        position: card.position,
        deleted_at: null,
        tags: [],
        attachments: card.attachments.map(teacherAttachment),
      })),
  }));
}

export function q2B10Snapshot() {
  const store = q2B10Store();
  return {
    cardCount: store.cards.length,
    visibleCardCount: store.cards.filter((card) => !card.isHidden).length,
    hiddenCardCount: store.cards.filter((card) => card.isHidden).length,
    stateVersion: store.stateVersion,
    mutationCount: store.mutationCount,
    createCount: store.creates,
    hideCount: store.hides,
    unhideCount: store.unhides,
    pollCounts: store.polls,
    visualStress: store.visualStress,
    wallCount: wallsForStore(store).length,
    classState: store.classState,
    attachmentCount: store.cards.reduce((count, card) => count + card.attachments.length, 0),
    initiatedUploadCount: store.initiatedFiles.size,
    finalizedUploadCount: store.finalizedUploads,
  };
}

export function isQ2B10Authorized(value: string | null) {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.Q2_BROWSER_FIXTURE_MODE === Q2_B10_FIXTURE_MODE &&
    value === "1"
  );
}
