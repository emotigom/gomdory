import type { LessonActivityType } from "@/lib/lesson-activities/registry";

export const AI_BINGO_ACTIVITY_TYPE = "ai_bingo" satisfies LessonActivityType;
export const AI_BINGO_CONFIG_VERSION = 1;
export const AI_BINGO_BOARD_SIZE = 3;
export const AI_BINGO_REASON_MAX_LENGTH = 160;

export type AiBingoTile = {
  id: string;
  label: string;
  explanation?: string;
};

export type AiBingoConfig = {
  version: typeof AI_BINGO_CONFIG_VERSION;
  boardSize: typeof AI_BINGO_BOARD_SIZE;
  tilePool: AiBingoTile[];
};

export type AiBingoSelection = {
  tileId: string;
  reason: string;
  selectedAt: string;
};

export type AiBingoState = {
  version: typeof AI_BINGO_CONFIG_VERSION;
  boardSize: typeof AI_BINGO_BOARD_SIZE;
  tileIds: string[];
  selections: Record<string, AiBingoSelection>;
  bingoLines: number[][];
  completed: boolean;
};

export const LESSON_1_AI_BINGO_TILE_POOL: AiBingoTile[] = [
  { id: "voice_recognition", label: "음성 인식", explanation: "사람의 말을 듣고 글자나 명령으로 바꿔요." },
  { id: "face_recognition", label: "얼굴 인식", explanation: "사진이나 카메라에서 얼굴 특징을 찾아요." },
  { id: "translation_app", label: "번역 앱", explanation: "문장의 패턴을 배워 다른 언어로 바꿔요." },
  { id: "video_recommendation", label: "영상 추천", explanation: "내가 본 영상 패턴을 보고 다음 영상을 추천해요." },
  { id: "self_driving", label: "자율주행", explanation: "센서와 카메라 데이터를 보고 도로 상황을 판단해요." },
  { id: "chatbot", label: "챗봇", explanation: "질문과 대화 패턴을 바탕으로 답을 만들어요." },
  { id: "spam_filter", label: "스팸 필터", explanation: "메일의 특징을 보고 스팸인지 구분해요." },
  { id: "medical_diagnosis_ai", label: "의료 진단 AI", explanation: "의료 영상이나 데이터를 보고 이상 징후를 찾아요." },
  { id: "game_ai", label: "게임 AI", explanation: "상황에 따라 캐릭터나 상대의 행동을 정해요." },
];

export function buildLesson1AiBingoConfig(): AiBingoConfig {
  return {
    version: AI_BINGO_CONFIG_VERSION,
    boardSize: AI_BINGO_BOARD_SIZE,
    tilePool: LESSON_1_AI_BINGO_TILE_POOL,
  };
}

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: string) {
  let state = hashSeed(seed) || 1;
  return () => {
    state = Math.imul(state ^ (state >>> 15), 1 | state);
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
}

export function deterministicAiBingoTileIds(config: AiBingoConfig, activityRunId: string, participantKey: string): string[] {
  if (config.tilePool.length === config.boardSize * config.boardSize) {
    return config.tilePool.map((tile) => tile.id);
  }

  const random = seededRandom(`${activityRunId}:${participantKey}:ai-bingo-v${config.version}`);
  const tiles = [...config.tilePool];
  for (let index = tiles.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [tiles[index], tiles[swapIndex]] = [tiles[swapIndex]!, tiles[index]!];
  }
  return tiles.slice(0, config.boardSize * config.boardSize).map((tile) => tile.id);
}

export function buildInitialAiBingoState(config: AiBingoConfig, activityRunId: string, participantKey: string): AiBingoState {
  return {
    version: AI_BINGO_CONFIG_VERSION,
    boardSize: config.boardSize,
    tileIds: deterministicAiBingoTileIds(config, activityRunId, participantKey),
    selections: {},
    bingoLines: [],
    completed: false,
  };
}

export function calculateAiBingoLines(tileIds: string[], selectedTileIds: Iterable<string>, boardSize = AI_BINGO_BOARD_SIZE): number[][] {
  const selected = new Set(selectedTileIds);
  const lines: number[][] = [];
  const lineCount = boardSize * boardSize;
  if (tileIds.length !== lineCount) return lines;

  for (let row = 0; row < boardSize; row += 1) {
    const indexes = Array.from({ length: boardSize }, (_, col) => row * boardSize + col);
    if (indexes.every((index) => selected.has(tileIds[index]!))) lines.push(indexes);
  }

  for (let col = 0; col < boardSize; col += 1) {
    const indexes = Array.from({ length: boardSize }, (_, row) => row * boardSize + col);
    if (indexes.every((index) => selected.has(tileIds[index]!))) lines.push(indexes);
  }

  const diagonalDown = Array.from({ length: boardSize }, (_, index) => index * boardSize + index);
  if (diagonalDown.every((index) => selected.has(tileIds[index]!))) lines.push(diagonalDown);

  const diagonalUp = Array.from({ length: boardSize }, (_, index) => index * boardSize + (boardSize - 1 - index));
  if (diagonalUp.every((index) => selected.has(tileIds[index]!))) lines.push(diagonalUp);

  return lines;
}

export function normalizeAiBingoReason(reason: string): string {
  return reason.replace(/\s+/g, " ").trim();
}

export function isAiBingoConfig(value: unknown): value is AiBingoConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<AiBingoConfig>;
  return candidate.version === AI_BINGO_CONFIG_VERSION
    && candidate.boardSize === AI_BINGO_BOARD_SIZE
    && Array.isArray(candidate.tilePool)
    && candidate.tilePool.every((tile) => tile && typeof tile.id === "string" && typeof tile.label === "string" && (tile.explanation === undefined || typeof tile.explanation === "string"));
}

export function tileExistsInAiBingoConfig(config: AiBingoConfig, tileId: string): boolean {
  return config.tilePool.some((tile) => tile.id === tileId);
}
