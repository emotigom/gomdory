import { z } from "zod";

export const realtimeCardSchema = z.object({
  id: z.string(),
  wallId: z.string(),
  text: z.string().optional(),
  authorName: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  isHidden: z.boolean().optional(),
  isPinned: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  cardColorToken: z.string().nullable().optional(),
  hasAttachments: z.boolean().optional(),
});

const attachmentsSummarySchema = z.object({
  fileCount: z.number().int().nonnegative(),
  externalCount: z.number().int().nonnegative().optional(),
});

export const realtimeEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("card:created"),
    payload: z.object({ wallId: z.string(), card: realtimeCardSchema, attachments: attachmentsSummarySchema.optional() }),
  }),
  z.object({
    type: z.literal("card:moved"),
    payload: z.object({
      cardId: z.string(),
      fromWallId: z.string(),
      toWallId: z.string(),
      newOrderCursor: z.string().nullable().optional(),
    }),
  }),
  z.object({
    type: z.literal("card:updated"),
    payload: z.object({
      cardId: z.string(),
      wallId: z.string(),
      isHidden: z.boolean().optional(),
      isPinned: z.boolean().optional(),
      isFeatured: z.boolean().optional(),
      cardColorToken: z.string().nullable().optional(),
      updatedAt: z.string().optional(),
      attachments: attachmentsSummarySchema.optional(),
    }),
  }),
  z.object({
    type: z.literal("wall:created"),
    payload: z.object({
      wall: z.object({ id: z.string(), title: z.string(), description: z.string().nullable() }),
      order: z.array(z.string()).optional(),
    }),
  }),
  z.object({
    type: z.literal("wall:reordered"),
    payload: z.object({ order: z.array(z.string()) }),
  }),
  z.object({
    type: z.literal("class:state_changed"),
    payload: z.object({ boardId: z.string(), classState: z.string() }),
  }),
  z.object({
    type: z.literal("notice_updated"),
    payload: z.object({ boardId: z.string(), notice: z.string().nullable() }),
  }),
  z.object({
    type: z.literal("rules_updated"),
    payload: z.object({ boardId: z.string(), rules: z.string().nullable() }),
  }),
]);

export type RealtimeEvent = z.infer<typeof realtimeEventSchema>;

export function encodeRealtimeEvent(event: RealtimeEvent): string {
  return JSON.stringify(event);
}

export function decodeRealtimeEvent(data: unknown): RealtimeEvent | null {
  try {
    const parsed =
      typeof data === "string"
        ? JSON.parse(data) satisfies unknown
        : data;
    return realtimeEventSchema.parse(parsed);
  } catch (error) {
    console.warn("Failed to decode realtime event", error);
    return null;
  }
}

export type JoinMessage = {
  type: "join";
  boardId: string;
  shareCode?: string | null;
  role: "teacher" | "student";
};

export type ClientMessage = JoinMessage;
