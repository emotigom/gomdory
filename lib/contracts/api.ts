import { z } from "zod";

import { routes } from "../standards/routes";
import { defineRoute, routePath } from "./defineRoute";

const okResponse = z.object({ ok: z.literal(true) }).passthrough();
const errorResponse = z.object({ ok: z.literal(false) }).passthrough();
const okOrError = z.union([okResponse, errorResponse]);
const emptyRequest = z.object({}).optional();

const paramsOnly = (shape: Record<string, z.ZodTypeAny>) =>
  z.object({ params: z.object(shape) });

const paramsWithBody = (shape: Record<string, z.ZodTypeAny>, body: z.ZodTypeAny) =>
  z.object({ params: z.object(shape), body });

const paramsWithQuery = (shape: Record<string, z.ZodTypeAny>, query: z.ZodTypeAny) =>
  z.object({ params: z.object(shape), query: query.optional() });

export const api = {
  audit: {
    list: defineRoute({
      method: "GET",
      path: routePath(routes.api.audit.root(), routes.api.audit.root),
      request: emptyRequest,
      response: okOrError,
      errors: ["unauthorized", "query_failed"],
    }),
  },
  billing: {
    plan: defineRoute({
      method: "GET",
      path: routePath(routes.api.billing.plan(), routes.api.billing.plan),
      request: emptyRequest,
      response: z.union([
        z.object({ ok: z.literal(true), plan: z.unknown(), requestId: z.string().optional() }).passthrough(),
        errorResponse,
      ]),
      errors: ["unauthorized", "plan_lookup_failed"],
    }),
    upgradeRequest: defineRoute({
      method: "POST",
      path: routePath(routes.api.billing.upgradeRequest(), routes.api.billing.upgradeRequest),
      request: z.object({ body: z.record(z.unknown()).optional() }).optional(),
      response: okOrError,
      errors: ["unauthorized", "invalid_payload", "upgrade_request_failed"],
    }),
    upgradeIntent: defineRoute({
      method: "POST",
      path: routePath(routes.api.billing.upgradeIntent(), routes.api.billing.upgradeIntent),
      request: z.object({ body: z.record(z.unknown()).optional() }).optional(),
      response: okOrError,
      errors: ["unauthorized", "invalid_payload", "upgrade_intent_failed"],
    }),
    checkout: defineRoute({
      method: "POST",
      path: routePath(routes.api.billing.checkout(), routes.api.billing.checkout),
      request: z.object({ body: z.record(z.unknown()).optional() }).optional(),
      response: okOrError,
      errors: ["unauthorized", "billing_disabled", "checkout_failed"],
    }),
    portal: defineRoute({
      method: "POST",
      path: routePath(routes.api.billing.portal(), routes.api.billing.portal),
      request: emptyRequest,
      response: okOrError,
      errors: ["unauthorized", "billing_disabled", "portal_failed"],
    }),
    institutionRequest: defineRoute({
      method: "POST",
      path: routePath(routes.api.billing.institutionRequest(), routes.api.billing.institutionRequest),
      request: z.object({ body: z.record(z.unknown()) }),
      response: okOrError,
      errors: ["unauthorized", "invalid_payload", "institution_request_failed"],
    }),
    redeem: defineRoute({
      method: "POST",
      path: routePath(routes.api.billing.redeem(), routes.api.billing.redeem),
      request: z.object({ body: z.record(z.unknown()) }),
      response: okOrError,
      errors: ["unauthorized", "invalid_payload", "redeem_failed"],
    }),
    startTrial: defineRoute({
      method: "POST",
      path: routePath(routes.api.billing.startTrial(), routes.api.billing.startTrial),
      request: emptyRequest,
      response: okOrError,
      errors: ["unauthorized", "trial_start_failed"],
    }),
    webhook: defineRoute({
      method: "POST",
      path: routePath(routes.api.billing.webhook(), routes.api.billing.webhook),
      request: emptyRequest,
      response: z.any(),
      responseType: "response",
      errors: ["billing_disabled", "signature_invalid", "webhook_failed"],
    }),
    licenseList: defineRoute({
      method: "GET",
      path: routePath(routes.api.billing.licenseList(), routes.api.billing.licenseList),
      request: emptyRequest,
      response: okOrError,
      errors: ["unauthorized", "license_list_failed"],
    }),
    licenseCreate: defineRoute({
      method: "POST",
      path: routePath(routes.api.billing.licenseCreate(), routes.api.billing.licenseCreate),
      request: z.object({ body: z.record(z.unknown()) }),
      response: okOrError,
      errors: ["unauthorized", "invalid_payload", "license_create_failed"],
    }),
  },
  coupons: {
    redeem: defineRoute({
      method: "POST",
      path: routePath(routes.api.coupons.redeem(), routes.api.coupons.redeem),
      request: z.object({
        body: z.object({
          code: z.string(),
        }),
      }),
      response: z.union([
        z
          .object({
            ok: z.literal(true),
            effectType: z.string(),
            effectValue: z.number(),
            newQuotaBytes: z.number().nullable(),
            requestId: z.string().optional(),
          })
          .passthrough(),
        errorResponse,
      ]),
      errors: ["unauthorized", "invalid_body", "coupon_invalid", "internal_error"],
    }),
  },
  onboarding: {
    demo: defineRoute({
      method: "POST",
      path: routePath(routes.api.onboarding.demo(), routes.api.onboarding.demo),
      request: emptyRequest,
      response: okOrError,
      errors: [
        "supabase_env_missing",
        "unauthorized",
        "board_create_failed",
        "demo_board_seed_failed",
        "share_failed",
        "session_failed",
      ],
    }),
  },
  templates: {
    publish: defineRoute({
      method: "POST",
      path: routePath(routes.api.templates.publish(), routes.api.templates.publish),
      request: z.object({
        body: z.object({
          boardId: z.string(),
          title: z.string(),
          description: z.string().nullable().optional(),
          tags: z.array(z.string()).optional(),
          coverFileId: z.string().nullable().optional(),
          gradeBand: z.enum(["elem", "middle", "mixed"]).optional(),
          subject: z.string().optional(),
          visibility: z.enum(["public", "unlisted", "hidden"]).optional(),
          access: z.enum(["free", "pro"]).optional(),
        }),
      }),
      response: z.union([
        z.object({ ok: z.literal(true), templateId: z.string(), requestId: z.string().optional() }).passthrough(),
        errorResponse,
      ]),
      errors: [
        "unauthorized",
        "invalid_board_id",
        "invalid_title",
        "invalid_cover",
        "forbidden",
        "template_export_failed",
        "template_publish_failed",
      ],
    }),
  },
  dashboard: {
    boards: {
      list: defineRoute({
        method: "GET",
        path: routePath(routes.api.dashboard.boards(), routes.api.dashboard.boards),
        request: z
          .object({
            query: z
              .object({
                lite: z.union([z.literal("1"), z.literal("0")]).optional(),
              })
              .optional(),
          })
          .optional(),
        response: okOrError,
        errors: ["service_unavailable", "unauthenticated", "internal_error"],
      }),
      create: defineRoute({
        method: "POST",
        path: routePath(routes.api.dashboard.boards(), routes.api.dashboard.boards),
        request: z.object({
          body: z
            .object({
              title: z.string().optional(),
              description: z.string().optional(),
              boardViewType: z.string().optional(),
            })
            .passthrough(),
        }),
        response: okOrError,
        errors: ["service_unavailable", "unauthorized", "invalid_payload", "board_create_failed"],
      }),
    },
    studentApps: {
      store: defineRoute({
        method: "POST",
        pathTemplate: routes.api.v1("dashboard", "student-apps", "store"),
        buildPath: () => routes.api.v1("dashboard", "student-apps", "store"),
        request: z.object({
          body: z.object({
            boardId: z.string(),
            source: z.literal("manual_files"),
          }).passthrough(),
        }),
        response: z.union([
          z.object({
            ok: z.literal(true),
            deployment: z.object({
              id: z.string(),
              boardId: z.string(),
              cardId: z.string().nullable(),
              status: z.string(),
              title: z.string(),
              slug: z.string(),
              version: z.number(),
              fileCount: z.number(),
              totalSizeBytes: z.number(),
              entryFile: z.string(),
              createdAt: z.string(),
              storedAt: z.string(),
            }),
          }),
          errorResponse,
        ]),
        errors: ["unauthorized", "payload_too_large", "invalid_body", "board_id_required", "invalid_source", "forbidden_board", "storage_unavailable", "storage_schema_unavailable", "internal_error"],
      }),
      session: {
        get: defineRoute({
          method: "GET",
          pathTemplate: routes.api.v1("dashboard", "student-apps", "session"),
          buildPath: () => routes.api.v1("dashboard", "student-apps", "session"),
          request: z.object({ query: z.object({ boardId: z.string() }) }),
          response: okOrError,
          errors: ["unauthorized", "board_id_required", "board_not_found", "forbidden_board", "internal_error"],
        }),
        post: defineRoute({
          method: "POST",
          pathTemplate: routes.api.v1("dashboard", "student-apps", "session"),
          buildPath: () => routes.api.v1("dashboard", "student-apps", "session"),
          request: z.object({
            body: z.object({
              boardId: z.string(),
              action: z.enum(["start", "end", "autoStart"]),
            }),
          }),
          response: okOrError,
          errors: ["unauthorized", "board_id_required", "invalid_action", "board_not_found", "forbidden_board", "internal_error"],
        }),
      },
      submissions: {
        detail: defineRoute({
          method: "GET",
          pathTemplate: routes.api.v1("dashboard", "student-apps", "submissions", "detail"),
          buildPath: () => routes.api.v1("dashboard", "student-apps", "submissions", "detail"),
          request: z.object({ query: z.object({ boardId: z.string(), submissionId: z.string() }) }),
          response: z.union([
            z.object({
              ok: z.literal(true),
              submission: z.object({
                id: z.string(),
                title: z.string(),
                status: z.string(),
                submittedByName: z.string().nullable(),
                summary: z.unknown(),
                createdAt: z.string(),
              }),
              files: z.array(z.object({
                name: z.string(),
                path: z.string(),
                contentType: z.string(),
                sizeBytes: z.number(),
                contentText: z.string().optional(),
                contentBase64: z.string().optional(),
              })),
            }),
            errorResponse,
          ]),
          errors: ["unauthorized", "invalid_request", "storage_unavailable", "forbidden_board", "not_found", "submission_too_large", "internal_error"],
        }),
        review: defineRoute({
          method: "POST",
          pathTemplate: routes.api.v1("dashboard", "student-apps", "submissions", "review"),
          buildPath: () => routes.api.v1("dashboard", "student-apps", "submissions", "review"),
          request: z.object({
            body: z.object({
              boardId: z.string(),
              submissionId: z.string(),
              action: z.enum(["needs_fix", "accepted", "archived", "reopen"]),
              teacherNote: z.string().nullable().optional(),
            }),
          }),
          response: z.union([
            z.object({
              ok: z.literal(true),
              submission: z.object({
                id: z.string(),
                status: z.string(),
                teacherNote: z.string().nullable(),
                reviewedAt: z.string().nullable(),
                archivedAt: z.string().nullable(),
              }),
            }),
            errorResponse,
          ]),
          errors: ["unauthorized", "invalid_request", "invalid_action", "forbidden_board", "not_found", "latest_submission_required", "internal_error"],
        }),
      },
    },
  },
  files: {
    list: defineRoute({
      method: "GET",
      path: routePath(routes.api.files.list(), routes.api.files.list),
      request: z
        .object({
          query: z
            .object({
              q: z.string().optional(),
              tag: z.string().optional(),
              boardId: z.string().optional(),
              type: z.string().optional(),
              cursor: z.string().optional(),
              limit: z.number().optional(),
              sort: z.string().optional(),
            })
            .optional(),
        })
        .optional(),
      response: okOrError,
      errors: ["unauthorized", "files_unavailable"],
    }),
    update: defineRoute({
      method: "PATCH",
      path: routePath(routes.api.files.list(), routes.api.files.list),
      request: z.object({
        body: z.object({
          fileId: z.string(),
          title: z.string().nullable().optional(),
          tags: z.array(z.string()).optional(),
        }),
      }),
      response: okOrError,
      errors: ["unauthorized", "invalid_payload", "invalid_tags", "files_update_failed"],
    }),
    remove: defineRoute({
      method: "DELETE",
      path: routePath(routes.api.files.list(), routes.api.files.list),
      request: z.object({ body: z.object({ fileId: z.string() }) }),
      response: okOrError,
      errors: ["unauthorized", "invalid_payload", "not_found", "files_delete_failed"],
    }),
    view: defineRoute({
      method: "GET",
      path: routePath(
        routes.api.files.view(":fileId"),
        (fileId: unknown) => routes.api.files.view(String(fileId)),
        ["fileId"],
      ),
      request: paramsOnly({ fileId: z.string() }),
      response: z.any(),
      responseType: "response",
      errors: ["unauthorized", "not_found", "file_unavailable", "view_failed"],
    }),
    tagsSuggest: defineRoute({
      method: "GET",
      path: routePath(
        routes.api.v1("files", "tags", "suggest"),
        () => routes.api.v1("files", "tags", "suggest"),
      ),
      request: emptyRequest,
      response: okOrError,
      errors: ["unauthorized", "suggest_failed"],
    }),
    tagsUpdate: defineRoute({
      method: "POST",
      path: routePath(
        routes.api.v1("files", ":fileId", "tags"),
        (fileId: unknown) => routes.api.v1("files", String(fileId), "tags"),
        ["fileId"],
      ),
      request: paramsWithBody(
        { fileId: z.string() },
        z.object({
          add: z.array(z.string()).optional(),
          remove: z.array(z.string()).optional(),
        }),
      ),
      response: okOrError,
      errors: ["unauthorized", "invalid_payload", "invalid_tags", "tag_update_failed"],
    }),
  },
  ops: {
    whoami: defineRoute({
      method: "GET",
      path: routePath(routes.api.ops.whoami(), routes.api.ops.whoami),
      request: emptyRequest,
      response: z.union([
        z
          .object({
            ok: z.literal(true),
            userId: z.string(),
            email: z.string().nullable().optional(),
            isOpsAdmin: z.boolean(),
            requestId: z.string().optional(),
          })
          .passthrough(),
        errorResponse,
      ]),
      errors: ["unauthorized"],
    }),
    diagRequest: defineRoute({
      method: "GET",
      path: routePath(
        routes.api.ops.diagRequest(":requestId"),
        (requestId: unknown) => routes.api.ops.diagRequest(String(requestId)),
        ["requestId"],
      ),
      request: paramsWithQuery(
        { requestId: z.string() },
        z.object({ limit: z.string().optional() }).optional(),
      ),
      response: okOrError,
      errors: [
        "invalid_request_id",
        "unauthorized",
        "forbidden",
        "ops_events_failed",
        "audit_events_failed",
        "internal_error",
      ],
    }),
    notFoundAlert: defineRoute({
      method: "GET",
      path: routePath(routes.api.ops.notFoundAlert(), routes.api.ops.notFoundAlert),
      request: emptyRequest,
      response: z.union([
        z
          .object({
            ok: z.literal(true),
            summary: z.unknown(),
            requestId: z.string().optional(),
          })
          .passthrough(),
        errorResponse,
      ]),
      errors: ["unauthorized", "forbidden"],
    }),
    notFoundBrokenLinks: defineRoute({
      method: "GET",
      path: routePath(routes.api.ops.notFoundBrokenLinks(), routes.api.ops.notFoundBrokenLinks),
      request: z
        .object({
          query: z
            .object({
              format: z.string().optional(),
              hours: z.string().optional(),
              limit: z.string().optional(),
            })
            .optional(),
        })
        .optional(),
      response: z.any(),
      responseType: "response",
      errors: ["unauthorized", "forbidden"],
    }),
    notFoundBrokenLinksBundle: defineRoute({
      method: "GET",
      path: routePath(routes.api.ops.notFoundBrokenLinksBundle(), routes.api.ops.notFoundBrokenLinksBundle),
      request: z
        .object({
          query: z
            .object({
              format: z.string().optional(),
              hours: z.string().optional(),
              limit: z.string().optional(),
              pairs: z.string().optional(),
            })
            .optional(),
        })
        .optional(),
      response: z.any(),
      responseType: "response",
      errors: ["unauthorized", "forbidden"],
    }),
    notFoundWorkQueue: defineRoute({
      method: "GET",
      path: routePath(routes.api.ops.notFoundWorkQueue(), routes.api.ops.notFoundWorkQueue),
      request: z
        .object({
          query: z
            .object({
              format: z.string().optional(),
              hours: z.string().optional(),
              limit: z.string().optional(),
              pairs: z.string().optional(),
              recentMinutes: z.string().optional(),
              baselineHours: z.string().optional(),
              pair: z.union([z.string(), z.array(z.string())]).optional(),
            })
            .optional(),
        })
        .optional(),
      response: z.any(),
      responseType: "response",
      errors: ["unauthorized", "forbidden"],
    }),
  },
  opsAdmin: {
    users: defineRoute({
      method: "GET",
      path: routePath(routes.api.opsAdmin.users(), routes.api.opsAdmin.users),
      request: z
        .object({
          query: z.object({ page: z.string().optional() }).optional(),
        })
        .optional(),
      response: okOrError,
      errors: ["unauthorized", "not_found", "users_list_failed", "entitlements_failed", "quota_failed", "usage_failed"],
    }),
    storage: {
      quotaUpdate: defineRoute({
        method: "POST",
        path: routePath(routes.api.opsAdmin.storage.quotaUpdate(), routes.api.opsAdmin.storage.quotaUpdate),
        request: z.object({
          body: z.object({
            ownerId: z.string(),
            quotaBytes: z.number(),
          }),
        }),
        response: z.union([
          z
            .object({
              ok: z.literal(true),
              ownerId: z.string(),
              quotaBytes: z.number(),
              requestId: z.string().optional(),
            })
            .passthrough(),
          errorResponse,
        ]),
        errors: ["unauthorized", "forbidden", "invalid_body", "quota_upsert_failed"],
      }),
    },
    coupons: {
      create: defineRoute({
        method: "POST",
        path: routePath(routes.api.opsAdmin.coupons.create(), routes.api.opsAdmin.coupons.create),
        request: z.object({
          body: z.object({
            code: z.string(),
            expiresAt: z.string().nullable().optional(),
            maxUses: z.number(),
            effectType: z.enum(["quota_bonus_bytes", "discount_won", "discount_percent"]),
            effectValue: z.number(),
            note: z.string().nullable().optional(),
          }),
        }),
        response: z.union([
          z
            .object({
              ok: z.literal(true),
              id: z.string(),
              codeDisplay: z.string(),
              expiresAt: z.string().nullable(),
              maxUses: z.number(),
              uses: z.number(),
              effectType: z.string(),
              effectValue: z.number(),
              createdAt: z.string(),
              requestId: z.string().optional(),
            })
            .passthrough(),
          errorResponse,
        ]),
        errors: ["unauthorized", "invalid_body", "coupon_duplicate", "internal_error"],
      }),
      list: defineRoute({
        method: "GET",
        path: routePath(routes.api.opsAdmin.coupons.list(), routes.api.opsAdmin.coupons.list),
        request: emptyRequest,
        response: z.union([
          z
            .object({
              ok: z.literal(true),
              coupons: z
                .array(
                  z.object({
                    id: z.string(),
                    codeDisplay: z.string(),
                    expiresAt: z.string().nullable(),
                    maxUses: z.number(),
                    uses: z.number(),
                    effectType: z.string(),
                    effectValue: z.number(),
                    createdAt: z.string(),
                  }),
                )
                .optional(),
              requestId: z.string().optional(),
            })
            .passthrough(),
          errorResponse,
        ]),
        errors: ["unauthorized", "internal_error"],
      }),
    },
  },
  share: {
    filesDownload: defineRoute({
      method: "GET",
      path: routePath(
        routes.api.v1("share", ":code", "files", ":fileId", "download"),
        (code: unknown, fileId: unknown) => routes.api.share.files.download(String(code), String(fileId)),
        ["code", "fileId"],
      ),
      request: paramsOnly({ code: z.string(), fileId: z.string() }),
      response: z.any(),
      responseType: "response",
      errors: ["not_found", "forbidden"],
    }),
  },
  showcases: {
    rotateToken: defineRoute({
      method: "POST",
      path: routePath(
        routes.api.v1("showcases", ":showcaseId", "rotate-token"),
        (showcaseId: unknown) => routes.api.v1("showcases", String(showcaseId), "rotate-token"),
        ["showcaseId"],
      ),
      request: paramsOnly({ showcaseId: z.string() }),
      response: okOrError,
      errors: [
        "unauthorized",
        "invalid_showcase_id",
        "forbidden_host",
        "not_found",
        "forbidden",
        "rotate_failed",
      ],
    }),
    revoke: defineRoute({
      method: "POST",
      path: routePath(
        routes.api.v1("showcases", ":showcaseId", "revoke"),
        (showcaseId: unknown) => routes.api.v1("showcases", String(showcaseId), "revoke"),
        ["showcaseId"],
      ),
      request: paramsOnly({ showcaseId: z.string() }),
      response: okOrError,
      errors: [
        "unauthorized",
        "invalid_showcase_id",
        "forbidden_host",
        "not_found",
        "forbidden",
        "revoke_failed",
      ],
    }),
  },
  boards: {
    liveGet: defineRoute({
      method: "GET",
      path: routePath(
        routes.api.boards.live(":boardId"),
        (boardId: unknown) => routes.api.boards.live(String(boardId)),
        ["boardId"],
      ),
      request: paramsOnly({ boardId: z.string() }),
      response: okOrError,
      errors: ["invalid_board_id", "unauthorized", "forbidden", "snapshot_failed"],
    }),
    livePost: defineRoute({
      method: "POST",
      path: routePath(
        routes.api.boards.live(":boardId"),
        (boardId: unknown) => routes.api.boards.live(String(boardId)),
        ["boardId"],
      ),
      request: paramsWithBody({ boardId: z.string() }, z.record(z.unknown())),
      response: okOrError,
      errors: ["invalid_board_id", "unauthorized", "forbidden", "invalid_payload"],
    }),
    shareEnsure: defineRoute({
      method: "POST",
      path: routePath(
        routes.api.boards.shareEnsure(":boardId"),
        (boardId: unknown) => routes.api.boards.shareEnsure(String(boardId)),
        ["boardId"],
      ),
      request: paramsOnly({ boardId: z.string() }),
      response: okOrError,
      errors: ["unauthorized", "board_not_found", "forbidden"],
    }),
    auditGet: defineRoute({
      method: "GET",
      path: routePath(
        routes.api.boards.audit(":boardId"),
        (boardId: unknown) => routes.api.boards.audit(String(boardId)),
        ["boardId"],
      ),
      request: paramsOnly({ boardId: z.string() }),
      response: okOrError,
      errors: ["invalid_board_id", "unauthorized", "forbidden", "audit_fetch_failed"],
    }),
    cardsTagsBulk: defineRoute({
      method: "POST",
      path: routePath(
        routes.api.boards.cardsTagsBulk(":boardId"),
        (boardId: unknown) => routes.api.boards.cardsTagsBulk(String(boardId)),
        ["boardId"],
      ),
      request: paramsWithBody({ boardId: z.string() }, z.record(z.unknown())),
      response: okOrError,
      errors: ["invalid_board_id", "unauthorized", "forbidden", "invalid_payload", "bulk_update_failed"],
    }),
    hudSettings: defineRoute({
      method: "PATCH",
      path: routePath(
        routes.api.v1("boards", ":boardId", "hud", "settings"),
        (boardId: unknown) => routes.api.boards.byId(String(boardId), "hud", "settings"),
        ["boardId"],
      ),
      request: paramsWithBody(
        { boardId: z.string() },
        z.object({
          approvalMode: z.enum(["auto", "teacher_approve"]).optional(),
          announcement: z.string().nullable().optional(),
          lockStudentInput: z.boolean().optional(),
        }),
      ),
      response: okOrError,
      errors: ["invalid_board_id", "unauthorized", "forbidden", "invalid_payload"],
    }),
    showcaseEnsure: defineRoute({
      method: "POST",
      path: routePath(
        routes.api.v1("boards", ":boardId", "showcase", "ensure"),
        (boardId: unknown) => routes.api.boards.byId(String(boardId), "showcase", "ensure"),
        ["boardId"],
      ),
      request: paramsOnly({ boardId: z.string() }),
      response: okOrError,
      errors: ["unauthorized", "forbidden", "not_found"],
    }),
    triageList: defineRoute({
      method: "GET",
      path: routePath(
        routes.api.v1("boards", ":boardId", "triage"),
        (boardId: unknown) => routes.api.boards.byId(String(boardId), "triage"),
        ["boardId"],
      ),
      request: paramsWithQuery(
        { boardId: z.string() },
        z.object({
          limit: z.number().optional(),
        }),
      ),
      response: okOrError,
      errors: ["invalid_board_id", "unauthorized", "forbidden", "failed"],
    }),
    triageAction: defineRoute({
      method: "POST",
      path: routePath(
        routes.api.v1("boards", ":boardId", "triage", ":id"),
        (boardId: unknown, id: unknown) => routes.api.boards.byId(String(boardId), "triage", String(id)),
        ["boardId", "id"],
      ),
      request: paramsWithBody(
        { boardId: z.string(), id: z.string() },
        z.object({
          status: z.string().optional(),
          pinned: z.boolean().optional(),
        }),
      ),
      response: okOrError,
      errors: ["invalid_board_id", "unauthorized", "forbidden", "invalid_payload", "failed"],
    }),
  },
  s: {
    requests: {
      list: defineRoute({
        method: "GET",
        pathTemplate: routes.api.v1("s", ":code", "requests"),
      buildPath: (code: unknown) => routes.api.s.requests(String(code)),
        params: ["code"],
        request: paramsWithQuery(
          { code: z.string() },
          z.object({
            mine: z.union([z.literal("1"), z.literal("0")]).optional(),
            summary: z.union([z.literal("1"), z.literal("0")]).optional(),
            anonId: z.string().optional(),
          }),
        ),
        response: okOrError,
        errors: ["invalid_share_code"],
      }),
      create: defineRoute({
        method: "POST",
        pathTemplate: routes.api.v1("s", ":code", "requests"),
      buildPath: (code: unknown) => routes.api.s.requests(String(code)),
        params: ["code"],
        request: paramsWithBody(
          { code: z.string() },
          z.object({
            id: z.string().optional(),
            type: z.enum(["question", "help", "pulse", "poll"]),
            text: z.string().optional(),
            meta: z.record(z.unknown()).optional(),
            anonId: z.string().optional(),
          }),
        ),
        response: okOrError,
        errors: [
          "invalid_share_code",
          "invalid_type",
          "not_found",
          "rate_limited",
          "invalid_text",
          "server_error",
        ],
      }),
    },
  },
  lessonRun: {
    start: defineRoute({
      method: "POST",
      pathTemplate: routes.api.v1("lesson-run", "start"),
      buildPath: () => routes.api.v1("lesson-run", "start"),
      request: z.object({
        body: z.object({
          boardId: z.string(),
          requestedPreset: z.string().optional(),
          durationMinutes: z.number().optional(),
          options: z.record(z.unknown()).nullable().optional(),
          idempotencyKey: z.string().optional(),
          clientRequestId: z.string().optional(),
        }),
      }),
      response: okOrError,
      errors: ["json_required", "board_id_required", "auth_required", "board_not_found", "permission_denied", "feature_disabled", "validation_failed", "conflict_multiple_open_sessions", "internal_error"],
    }),
    end: defineRoute({
      method: "POST",
      pathTemplate: routes.api.v1("lesson-run", "end"),
      buildPath: () => routes.api.v1("lesson-run", "end"),
      request: z.object({
        body: z.object({
          boardId: z.string(),
          idempotencyKey: z.string().optional(),
          clientRequestId: z.string().optional(),
        }),
      }),
      response: okOrError,
      errors: ["json_required", "board_id_required", "auth_required", "board_not_found", "permission_denied", "feature_disabled", "internal_error"],
    }),
  },
  studentApps: {
    submit: defineRoute({
      method: "POST",
      pathTemplate: routes.api.v1("student-apps", "submit"),
      buildPath: () => routes.api.v1("student-apps", "submit"),
      request: z.object({
        body: z.object({
          boardId: z.string(),
          source: z.literal("manual_files"),
          files: z.array(z.unknown()),
          shareCode: z.string().optional(),
          accessCode: z.string().optional(),
          studentSessionToken: z.string().optional(),
          guestToken: z.string().optional(),
        }).passthrough(),
      }),
      response: z.union([
        z.object({
          ok: z.literal(true),
          submission: z.object({
            id: z.string(),
            statusCapability: z.string().regex(/^[A-Za-z0-9_-]{43,}$/).optional(),
          }).passthrough(),
        }).passthrough(),
        errorResponse,
      ]),
      errors: ["invalid_origin", "payload_too_large", "invalid_body", "board_id_required", "invalid_source", "invalid_files", "access_required", "board_not_found", "submissions_disabled", "invalid_board_access", "session_closed", "rate_limited", "storage_unavailable", "internal_error"],
    }),
    submissionStatus: defineRoute({
      method: "POST",
      pathTemplate: routes.api.v1("student-apps", "submissions", "status"),
      buildPath: () => routes.api.v1("student-apps", "submissions", "status"),
      request: z.object({
        body: z.object({
          boardId: z.string(),
          submissions: z.array(z.object({
            submissionId: z.string().uuid(),
            statusCapability: z.string().regex(/^[A-Za-z0-9_-]{43,128}$/),
          })).max(20),
          studentSessionToken: z.string().optional(),
          guestToken: z.string().optional(),
        }),
      }),
      response: z.union([
        z.object({
          ok: z.literal(true),
          submissions: z.array(z.object({
            id: z.string(),
            title: z.string().nullable(),
            status: z.string().nullable(),
            teacherNote: z.string().nullable(),
            reviewedAt: z.string().nullable(),
            archivedAt: z.string().nullable(),
            createdAt: z.string().nullable(),
            version: z.number().nullable(),
            isLatest: z.boolean().nullable(),
          })),
        }),
        errorResponse,
      ]),
      errors: ["invalid_body", "board_id_required", "invalid_submissions", "too_many_submissions", "rate_limited", "internal_error"],
    }),
    gallery: {
      list: defineRoute({
        method: "POST",
        pathTemplate: routes.api.v1("student-apps", "gallery", "list"),
        buildPath: () => routes.api.v1("student-apps", "gallery", "list"),
        request: z.object({
          body: z.object({
            boardId: z.string(),
            shareCode: z.string().optional(),
            accessCode: z.string().optional(),
            studentSessionToken: z.string().optional(),
            guestToken: z.string().optional(),
          }),
        }),
        response: okOrError,
        errors: ["invalid_body", "board_id_required", "access_required", "board_not_found", "invalid_board_access", "internal_error"],
      }),
    },
  },
  registryBackfill: {
    cardsAttachment: defineRoute({
      method: "POST",
      pathTemplate: routes.api.v1("cards", ":cardId", "attachments", ":boardFileId"),
      buildPath: (cardId: unknown, boardFileId: unknown) =>
        routes.api.v1("cards", String(cardId), "attachments", String(boardFileId)),
      params: ["cardId", "boardFileId"],
      request: paramsWithBody({ cardId: z.string(), boardFileId: z.string() }, z.record(z.unknown()).optional()),
      response: okOrError,
      errors: ["invalid_payload"],
    }),
    communityCommentHide: defineRoute({
      method: "POST",
      pathTemplate: routes.api.v1("community", "comments", ":commentId", "hide"),
      buildPath: (commentId: unknown) => routes.api.v1("community", "comments", String(commentId), "hide"),
      params: ["commentId"],
      request: paramsOnly({ commentId: z.string() }),
      response: okOrError,
      errors: ["forbidden"],
    }),
    communityCommentReport: defineRoute({
      method: "POST",
      pathTemplate: routes.api.v1("community", "comments", ":commentId", "report"),
      buildPath: (commentId: unknown) => routes.api.v1("community", "comments", String(commentId), "report"),
      params: ["commentId"],
      request: paramsWithBody({ commentId: z.string() }, z.record(z.unknown()).optional()),
      response: okOrError,
      errors: ["invalid_payload"],
    }),
    communityFileDownload: defineRoute({
      method: "GET",
      pathTemplate: routes.api.v1("community", "files", ":fileId", "download"),
      buildPath: (fileId: unknown) => routes.api.v1("community", "files", String(fileId), "download"),
      params: ["fileId"],
      request: paramsOnly({ fileId: z.string() }),
      response: z.any(),
      responseType: "response",
      errors: ["not_found"],
    }),
    dashboardAnalyticsEvents: defineRoute({
      method: "POST",
      pathTemplate: routes.api.v1("dashboard", "analytics", "events"),
      buildPath: () => routes.api.v1("dashboard", "analytics", "events"),
      request: z.object({ body: z.record(z.unknown()).optional() }).optional(),
      response: okOrError,
      errors: ["invalid_payload"],
    }),
    dashboardHomeHubViewed: defineRoute({
      method: "POST",
      pathTemplate: routes.api.v1("dashboard", "home-hub-v2", "viewed"),
      buildPath: () => routes.api.v1("dashboard", "home-hub-v2", "viewed"),
      request: z.object({ body: z.record(z.unknown()).optional() }).optional(),
      response: okOrError,
      errors: ["invalid_payload"],
    }),
    debugOpenAiPing: defineRoute({
      method: "GET",
      pathTemplate: routes.api.v1("debug", "openai-ping"),
      buildPath: () => routes.api.v1("debug", "openai-ping"),
      request: z
        .object({
          query: z
            .object({
              mode: z.enum(["backend_only", "upstream", "legacy_direct"]).optional(),
            })
            .optional(),
        })
        .optional(),
      response: z.union([
        z
          .object({
            ok: z.literal(true),
            backend: z.enum(["reachable", "not_requested"]),
            upstream: z.enum(["not_requested", "reachable"]),
          })
          .strict(),
        z.object({ ok: z.literal(false), code: z.string() }).strict(),
      ]),
      errors: ["not_found", "unauthorized", "forbidden", "invalid_mode", "provider_unavailable", "upstream_unavailable", "upstream_failed"],
    }),
    eduTeacherPublishQuotaReset: defineRoute({
      method: "POST",
      pathTemplate: routes.api.v1("edu", "teacher", "publish-quota", "reset"),
      buildPath: () => routes.api.v1("edu", "teacher", "publish-quota", "reset"),
      request: emptyRequest,
      response: okOrError,
      errors: ["forbidden"],
    }),
    labsPracticeCards: defineRoute({
      method: "GET",
      pathTemplate: routes.api.v1("labs", "practice", "cards"),
      buildPath: () => routes.api.v1("labs", "practice", "cards"),
      request: emptyRequest,
      response: okOrError,
      errors: ["forbidden"],
    }),
    meUiPrefsPresets: defineRoute({
      method: "GET",
      pathTemplate: routes.api.v1("me", "ui-prefs", "presets"),
      buildPath: () => routes.api.v1("me", "ui-prefs", "presets"),
      request: emptyRequest,
      response: okOrError,
      errors: ["unauthorized"],
    }),
    opsAdminEduPublishQuotaReset: defineRoute({
      method: "POST",
      pathTemplate: routes.api.v1("ops", "admin", "edu", "publish-quota", "reset"),
      buildPath: () => routes.api.v1("ops", "admin", "edu", "publish-quota", "reset"),
      request: emptyRequest,
      response: okOrError,
      errors: ["forbidden"],
    }),
    opsBanners: defineRoute({
      method: "GET",
      pathTemplate: routes.api.v1("ops", "banners"),
      buildPath: () => routes.api.v1("ops", "banners"),
      request: emptyRequest,
      response: okOrError,
      errors: ["forbidden"],
    }),
    opsSiteContentByKey: defineRoute({
      method: "GET",
      pathTemplate: routes.api.v1("ops", "site-content", ":key"),
      buildPath: (key: unknown) => routes.api.v1("ops", "site-content", String(key)),
      params: ["key"],
      request: paramsOnly({ key: z.string() }),
      response: okOrError,
      errors: ["forbidden"],
    }),
    opsSiteContentPublish: defineRoute({
      method: "POST",
      pathTemplate: routes.api.v1("ops", "site-content", ":key", "publish"),
      buildPath: (key: unknown) => routes.api.v1("ops", "site-content", String(key), "publish"),
      params: ["key"],
      request: paramsOnly({ key: z.string() }),
      response: okOrError,
      errors: ["forbidden"],
    }),
    opsSiteContentRevisions: defineRoute({
      method: "GET",
      pathTemplate: routes.api.v1("ops", "site-content", ":key", "revisions"),
      buildPath: (key: unknown) => routes.api.v1("ops", "site-content", String(key), "revisions"),
      params: ["key"],
      request: paramsWithQuery({ key: z.string() }, z.object({ limit: z.string().optional() }).optional()),
      response: okOrError,
      errors: ["forbidden"],
    }),
    opsSiteContentRollback: defineRoute({
      method: "POST",
      pathTemplate: routes.api.v1("ops", "site-content", ":key", "rollback"),
      buildPath: (key: unknown) => routes.api.v1("ops", "site-content", String(key), "rollback"),
      params: ["key"],
      request: paramsWithBody({ key: z.string() }, z.record(z.unknown()).optional()),
      response: okOrError,
      errors: ["forbidden"],
    }),
    opsTrashPurge: defineRoute({
      method: "POST",
      pathTemplate: routes.api.v1("ops", "trash", "purge"),
      buildPath: () => routes.api.v1("ops", "trash", "purge"),
      request: emptyRequest,
      response: okOrError,
      errors: ["forbidden"],
    }),
    shareCardMove: defineRoute({
      method: "POST",
      pathTemplate: routes.api.v1("share", ":code", "cards", ":cardId", "move"),
      buildPath: (code: unknown, cardId: unknown) => routes.api.v1("share", String(code), "cards", String(cardId), "move"),
      params: ["code", "cardId"],
      request: paramsWithBody({ code: z.string(), cardId: z.string() }, z.record(z.unknown()).optional()),
      response: okOrError,
      errors: ["forbidden"],
    }),
  },
} as const;
