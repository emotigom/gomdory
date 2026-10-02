import { z } from "zod";

type JsonSchema = Record<string, unknown>;

export const coachActionSchema = z
  .object({
    action: z.enum(["build_site", "ask_more"]),
    ready: z.boolean(),
  })
  .strict();

export type CoachAction = z.infer<typeof coachActionSchema>;

const replaceCommandSchema = z
  .object({
    op: z.literal("replace"),
    find: z.string(),
    replace: z.string(),
    all: z.boolean().optional(),
  })
  .strict();

export const coachPatchProposalSchema = z
  .object({
    message: z.string().optional(),
    htmlPatch: z.union([z.string(), replaceCommandSchema, z.array(replaceCommandSchema)]).optional(),
    cssPatch: z.union([z.string(), replaceCommandSchema, z.array(replaceCommandSchema)]).optional(),
  })
  .strict();

export type CoachPatchProposal = z.infer<typeof coachPatchProposalSchema>;

export const coachFilesResponseSchema = z
  .object({
    type: z.literal("files"),
    message: z.string(),
    files: z.record(z.string(), z.string()),
  })
  .strict();

export type CoachFilesResponse = z.infer<typeof coachFilesResponseSchema>;

export const coachActionJsonSchema = (): JsonSchema => ({
  type: "object",
  additionalProperties: false,
  required: ["action", "ready"],
  properties: {
    action: { enum: ["build_site", "ask_more"] },
    ready: { type: "boolean" },
  },
});

export const coachPatchProposalJsonSchema = (): JsonSchema => ({
  type: "object",
  additionalProperties: false,
  properties: {
    message: { type: "string" },
    htmlPatch: {
      anyOf: [
        { type: "string" },
        {
          type: "object",
          additionalProperties: false,
          required: ["op", "find", "replace"],
          properties: {
            op: { const: "replace" },
            find: { type: "string" },
            replace: { type: "string" },
            all: { type: "boolean" },
          },
        },
        {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["op", "find", "replace"],
            properties: {
              op: { const: "replace" },
              find: { type: "string" },
              replace: { type: "string" },
              all: { type: "boolean" },
            },
          },
        },
      ],
    },
    cssPatch: {
      anyOf: [
        { type: "string" },
        {
          type: "object",
          additionalProperties: false,
          required: ["op", "find", "replace"],
          properties: {
            op: { const: "replace" },
            find: { type: "string" },
            replace: { type: "string" },
            all: { type: "boolean" },
          },
        },
        {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["op", "find", "replace"],
            properties: {
              op: { const: "replace" },
              find: { type: "string" },
              replace: { type: "string" },
              all: { type: "boolean" },
            },
          },
        },
      ],
    },
  },
});

export const decorateIntentSchema = z
  .object({
    kind: z.enum(["insert_img_tag", "set_img_alt", "set_text"]),
    alt: z.string().optional(),
    src: z.string().optional(),
    text: z.string().optional(),
  })
  .strict();

export type DecorateIntent = z.infer<typeof decorateIntentSchema>;

export const decorateIntentJsonSchema = (): JsonSchema => ({
  type: "object",
  additionalProperties: false,
  required: ["kind"],
  properties: {
    kind: { enum: ["insert_img_tag", "set_img_alt", "set_text"] },
    alt: { type: "string" },
    src: { type: "string" },
    text: { type: "string" },
  },
});

export const decoratePlanJsonSchema = (): JsonSchema => ({
  type: "object",
  additionalProperties: false,
  required: ["version", "summary", "ops"],
  properties: {
    version: { const: 1 },
    summary: { type: "string" },
    ops: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["op", "target"],
        properties: {
          op: { enum: ["insert_media", "add_caption", "emphasize_heading", "add_callout_box", "tidy_spacing", "set_surface_background"] },
          target: {
            type: "object",
            additionalProperties: false,
            required: ["kind"],
            properties: {
              kind: { enum: ["slot", "selector"] },
              slot: { enum: ["image_primary", "image_any", "heading_primary", "text_any", "section_any"] },
              selector: { type: "string" },
            },
          },
          media: {
            type: "object",
            additionalProperties: false,
            properties: { kind: { enum: ["cat_placeholder", "generic_placeholder"] } },
          },
          style: {
            type: "object",
            additionalProperties: false,
            properties: {
              prominence: { enum: ["high", "medium"] },
              caption: { type: "boolean" },
              mode: { enum: ["color", "gradient"] },
              color: { type: "string" },
              gradientFrom: { type: "string" },
              gradientTo: { type: "string" },
              textColor: { type: "string" },
            },
          },
          text: { type: "string" },
          tone: { enum: ["cute", "bold", "clean"] },
          level: { enum: ["sm", "md"] },
        },
      },
    },
  },
});

export const filesSchema = (allowedFiles: string[]): JsonSchema => {
  const fileProperties = Object.fromEntries(
    allowedFiles.map((filename) => [filename, { type: "string" }]),
  );

  return {
    type: "object",
    additionalProperties: false,
    required: ["type", "files"],
    properties: {
      type: { const: "files" },
      message: { type: "string" },
      files: {
        type: "object",
        additionalProperties: false,
        properties: fileProperties,
      },
    },
  };
};
