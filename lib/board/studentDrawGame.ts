import type { StudentSubmissionSummary } from "@/lib/board/studentSubmissionSummary";

export type StudentDrawParticipantSource = "submission" | "manual";

export type StudentDrawParticipant = {
  id: string;
  name: string;
  subtitle?: string;
  source: StudentDrawParticipantSource;
  submissionCount?: number;
  hasFinalSubmission?: boolean;
  excluded?: boolean;
};

export type StudentDrawHistoryItem = {
  id: string;
  mode: string;
  resultText: string;
  createdAt: string;
  pickedParticipantIds?: string[];
};

export type StudentDrawResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: string };

export type StudentDrawSubmissionInput = {
  id?: string | null;
  authorClientId?: string | null;
  authorLabel?: string | null;
  cardId?: string | null;
  wallTitle?: string | null;
  createdAt?: string | null;
  isFinalArtwork?: boolean | null;
};

export type RoleAssignment = {
  role: string;
  participant: StudentDrawParticipant;
};

const BLANK_NAME_PREFIX = "이름 없는 학생";

function isBlankAuthorLabel(name: string | null | undefined): boolean {
  const trimmed = name?.trim();
  return !trimmed || trimmed === "익명 학생";
}

function normalizeName(name: string | null | undefined, blankIndex: number): string {
  const trimmed = name?.trim();
  if (!trimmed || trimmed === "익명 학생") return `${BLANK_NAME_PREFIX} ${blankIndex}`;
  return trimmed;
}

function stableSubmissionId(input: StudentDrawSubmissionInput, name: string): string {
  const authorClientId = input.authorClientId?.trim();
  if (authorClientId) return `submission:client:${authorClientId.toLocaleLowerCase("ko-KR")}`;

  const authorLabel = input.authorLabel?.trim();
  if (authorLabel && !isBlankAuthorLabel(authorLabel)) {
    return `submission:name:${authorLabel.toLocaleLowerCase("ko-KR")}`;
  }

  const explicitId = input.id?.trim();
  if (explicitId) return `submission:id:${explicitId.toLocaleLowerCase("ko-KR")}`;

  const cardId = input.cardId?.trim();
  if (cardId) return `submission:card:${cardId.toLocaleLowerCase("ko-KR")}`;

  const fallback = `${name}:${input.wallTitle ?? ""}:${input.createdAt ?? ""}`;
  return `submission:fallback:${fallback.trim().toLocaleLowerCase("ko-KR")}`;
}

export function normalizeStudentDrawParticipants(
  submissions: readonly StudentDrawSubmissionInput[],
): StudentDrawParticipant[] {
  const byKey = new Map<string, StudentDrawParticipant>();
  let blankIndex = 0;

  submissions.forEach((submission) => {
    const isBlank = isBlankAuthorLabel(submission.authorLabel);
    const name = normalizeName(submission.authorLabel, isBlank ? (blankIndex += 1) : blankIndex + 1);
    const id = stableSubmissionId(submission, name);
    const current = byKey.get(id);
    if (current) {
      current.submissionCount = (current.submissionCount ?? 1) + 1;
      current.hasFinalSubmission = Boolean(current.hasFinalSubmission || submission.isFinalArtwork);
      return;
    }
    byKey.set(id, {
      id,
      name,
      subtitle: submission.wallTitle ? `${submission.wallTitle} 제출` : "작품 제출자",
      source: "submission",
      submissionCount: 1,
      hasFinalSubmission: Boolean(submission.isFinalArtwork),
    });
  });

  return Array.from(byKey.values()).sort((left, right) =>
    left.name.localeCompare(right.name, "ko-KR"),
  );
}

export function buildStudentDrawParticipantsFromSummary(
  summary: StudentSubmissionSummary,
): StudentDrawParticipant[] {
  if (summary.submittedStudents?.length) {
    return normalizeStudentDrawParticipants(summary.submittedStudents);
  }

  return normalizeStudentDrawParticipants([
    ...summary.recentCards,
    ...summary.finalArtworkCards,
  ].map((card) => ({
    id: isBlankAuthorLabel(card.authorLabel) ? undefined : card.authorLabel,
    authorLabel: card.authorLabel,
    cardId: card.cardId,
    wallTitle: card.wallTitle,
    createdAt: card.createdAt,
    isFinalArtwork: card.isFinalArtwork,
  })));
}

export function mergeStudentDrawParticipants({
  submissionParticipants,
  manualParticipants,
  excludedIds,
}: {
  submissionParticipants: readonly StudentDrawParticipant[];
  manualParticipants: readonly StudentDrawParticipant[];
  excludedIds: ReadonlySet<string>;
}): StudentDrawParticipant[] {
  return [...submissionParticipants, ...manualParticipants].map((participant) => ({
    ...participant,
    excluded: excludedIds.has(participant.id),
  }));
}

export function getEligibleParticipants(
  participants: readonly StudentDrawParticipant[],
  alreadyPickedIds: ReadonlySet<string> = new Set(),
): StudentDrawParticipant[] {
  return participants.filter((participant) => !participant.excluded && !alreadyPickedIds.has(participant.id));
}

export function shuffleParticipants<T>(
  participants: readonly T[],
  rng: () => number = Math.random,
): T[] {
  const next = [...participants];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex] as T, next[index] as T];
  }
  return next;
}

export function pickOneParticipant(
  participants: readonly StudentDrawParticipant[],
  options: { excludeAlreadyPicked?: boolean; alreadyPickedIds?: ReadonlySet<string>; rng?: () => number } = {},
): StudentDrawResult<StudentDrawParticipant> {
  const eligible = getEligibleParticipants(
    participants,
    options.excludeAlreadyPicked ? options.alreadyPickedIds ?? new Set() : new Set(),
  );
  if (eligible.length === 0) return { ok: false, reason: "참가자가 부족해요." };
  return { ok: true, value: shuffleParticipants(eligible, options.rng)[0] as StudentDrawParticipant };
}

export function pickManyParticipants(
  participants: readonly StudentDrawParticipant[],
  count: number,
  rng: () => number = Math.random,
): StudentDrawResult<StudentDrawParticipant[]> {
  const eligible = getEligibleParticipants(participants);
  const safeCount = Math.floor(count);
  if (safeCount <= 0) return { ok: false, reason: "뽑을 인원을 1명 이상으로 정해 주세요." };
  if (eligible.length < safeCount) return { ok: false, reason: "참가자가 부족해요." };
  return { ok: true, value: shuffleParticipants(eligible, rng).slice(0, safeCount) };
}

export function makePresentationOrder(
  participants: readonly StudentDrawParticipant[],
  rng: () => number = Math.random,
): StudentDrawResult<StudentDrawParticipant[]> {
  const eligible = getEligibleParticipants(participants);
  if (eligible.length === 0) return { ok: false, reason: "참가자가 부족해요." };
  return { ok: true, value: shuffleParticipants(eligible, rng) };
}

export function splitIntoGroups(
  participants: readonly StudentDrawParticipant[],
  groupCount: number,
  rng: () => number = Math.random,
): StudentDrawResult<StudentDrawParticipant[][]> {
  const eligible = getEligibleParticipants(participants);
  const safeGroupCount = Math.floor(groupCount);
  if (safeGroupCount <= 0) return { ok: false, reason: "모둠 수를 1개 이상으로 정해 주세요." };
  if (eligible.length === 0) return { ok: false, reason: "참가자가 부족해요." };
  const groups = Array.from({ length: Math.min(safeGroupCount, eligible.length) }, () => [] as StudentDrawParticipant[]);
  shuffleParticipants(eligible, rng).forEach((participant, index) => {
    groups[index % groups.length]?.push(participant);
  });
  return { ok: true, value: groups };
}

export function assignRolesToParticipants(
  participants: readonly StudentDrawParticipant[],
  roles: readonly string[],
  rng: () => number = Math.random,
): StudentDrawResult<RoleAssignment[]> {
  const cleanRoles = roles.map((role) => role.trim()).filter(Boolean);
  const eligible = getEligibleParticipants(participants);
  if (cleanRoles.length === 0) return { ok: false, reason: "역할이나 상품을 한 줄에 하나씩 적어 주세요." };
  if (eligible.length < cleanRoles.length) return { ok: false, reason: "역할/상품 수보다 참가자가 적어요." };
  const picked = shuffleParticipants(eligible, rng).slice(0, cleanRoles.length);
  return {
    ok: true,
    value: cleanRoles.map((role, index) => ({ role, participant: picked[index] as StudentDrawParticipant })),
  };
}

export function formatStudentDrawResult(mode: string, result: unknown): string {
  if (Array.isArray(result)) {
    if (result.every((item) => Array.isArray(item))) {
      return [`[${mode}]`, ...(result as StudentDrawParticipant[][]).map((group, index) => `${index + 1}모둠: ${group.map((participant) => participant.name).join(", ")}`)].join("\n");
    }
    if (result.every((item) => "role" in (item as RoleAssignment))) {
      return [`[${mode}]`, ...(result as RoleAssignment[]).map((item) => `${item.role}: ${item.participant.name}`)].join("\n");
    }
    return [`[${mode}]`, ...(result as StudentDrawParticipant[]).map((participant, index) => `${index + 1}. ${participant.name}`)].join("\n");
  }
  if (result && typeof result === "object" && "name" in result) {
    return `[${mode}]\n${(result as StudentDrawParticipant).name}`;
  }
  return `[${mode}]\n${String(result ?? "")}`;
}
