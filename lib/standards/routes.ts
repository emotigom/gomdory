import { apiPath, apiV1Path, pagePath, type ApiPath, type PagePath } from "./pathTypes";

const encodeSegment = (value: string | number) => {
  const raw = String(value);
  return raw.startsWith(":") ? raw : encodeURIComponent(raw);
};

const encodePublicSegment = (value: string | number) => encodeURIComponent(String(value));

export const api = {
  v1: (...segments: Array<string | number>): ApiPath =>
    apiPath(apiV1Path(`${segments.map(String).join("/")}`)),
  dashboard: {
    boards: (): ApiPath => apiPath(apiV1Path("dashboard/boards")),
    board: (boardId: string): ApiPath => apiPath(apiV1Path(`dashboard/boards/${boardId}`)),
    boardFiles: (boardId: string): ApiPath => apiPath(apiV1Path(`dashboard/boards/${boardId}/files`)),
    boardExport: (boardId: string): ApiPath => apiPath(apiV1Path(`dashboard/boards/${boardId}/export`)),
    boardWallV2: (boardId: string): ApiPath => apiPath(apiV1Path(`dashboard/boards/${boardId}/wall-v2`)),
    boardWallV2Migrate: (boardId: string): ApiPath =>
      apiPath(apiV1Path(`dashboard/boards/${boardId}/wall-v2/migrate`)),
  },
  billing: {
    plan: (): ApiPath => apiPath(apiV1Path("billing/plan")),
    upgradeRequest: (): ApiPath => apiPath(apiV1Path("billing/upgrade-request")),
    upgradeIntent: (): ApiPath => apiPath(apiV1Path("billing/upgrade-intent")),
    checkout: (): ApiPath => apiPath(apiV1Path("billing/checkout")),
    portal: (): ApiPath => apiPath(apiV1Path("billing/portal")),
    institutionRequest: (): ApiPath => apiPath(apiV1Path("billing/institution/request")),
    redeem: (): ApiPath => apiPath(apiV1Path("billing/redeem")),
    startTrial: (): ApiPath => apiPath(apiV1Path("billing/start-trial")),
    webhook: (): ApiPath => apiPath(apiV1Path("billing/webhook")),
    licenseList: (): ApiPath => apiPath(apiV1Path("billing/license/list")),
    licenseCreate: (): ApiPath => apiPath(apiV1Path("billing/license/create")),
  },
  audit: {
    root: (): ApiPath => apiPath(apiV1Path("audit")),
  },
  coupons: {
    redeem: (): ApiPath => apiPath(apiV1Path("coupons/redeem")),
  },
  files: {
    list: (): ApiPath => apiPath(apiV1Path("files")),
    prepare: (): ApiPath => apiPath(apiV1Path("files/prepare")),
    byId: (fileId: string | number): ApiPath => apiPath(apiV1Path(`files/${fileId}`)),
    view: (fileId: string | number): ApiPath => apiPath(apiV1Path(`files/${fileId}/view`)),
    download: (fileId: string | number): ApiPath => apiPath(apiV1Path(`files/${fileId}/download`)),
    finalize: (fileId: string | number): ApiPath => apiPath(apiV1Path(`files/${fileId}/finalize`)),
  },
  community: {
    comments: {
      hide: (commentId: string | number): ApiPath => apiPath(apiV1Path(`community/comments/${commentId}/hide`)),
      report: (commentId: string | number): ApiPath => apiPath(apiV1Path(`community/comments/${commentId}/report`)),
    },
    files: {
      download: (fileId: string | number): ApiPath => apiPath(apiV1Path(`community/files/${fileId}/download`)),
    },
  },
  cards: {
    attachments: (cardId: string | number, boardFileId: string | number): ApiPath =>
      apiPath(apiV1Path(`cards/${cardId}/attachments/${boardFileId}`)),
  },
  templates: {
    root: (): ApiPath => apiPath(apiV1Path("templates")),
    byId: (templateId: string): ApiPath => apiPath(apiV1Path(`templates/${templateId}`)),
    copy: (templateId: string): ApiPath => apiPath(apiV1Path(`templates/${templateId}/copy`)),
    report: (templateId: string): ApiPath => apiPath(apiV1Path(`templates/${templateId}/report`)),
    publish: (): ApiPath => apiPath(apiV1Path("templates/publish")),
  },
  templateCollections: {
    root: (): ApiPath => apiPath(apiV1Path("template-collections")),
    bySlug: (slug: string): ApiPath => apiPath(apiV1Path(`template-collections/${slug}`)),
  },
  share: {
    present: (code: string | number): ApiPath => apiPath(apiV1Path(`share/${encodeSegment(code)}/present`)),
    feed: (code: string | number): ApiPath => apiPath(apiV1Path(`share/${encodeSegment(code)}/feed`)),
    activityState: (code: string | number): ApiPath => apiPath(apiV1Path(`share/${encodeSegment(code)}/activity-state`)),
    wallCards: (code: string | number, wallId: string | number): ApiPath =>
      apiPath(apiV1Path(`share/${encodeSegment(code)}/walls/${encodeSegment(wallId)}/cards`)),
    files: {
      download: (code: string | number, fileId: string | number): ApiPath =>
        apiPath(apiV1Path(`share/${encodeSegment(code)}/files/${fileId}/download`)),
    },
    cards: {
      move: (code: string | number, cardId: string | number): ApiPath =>
        apiPath(apiV1Path(`share/${encodeSegment(code)}/cards/${cardId}/move`)),
    },
  },
  shareV2: {
    wallSectionCards: (code: string | number, sectionId: string | number): ApiPath =>
      apiPath(`/api/v2/share/${encodeSegment(code)}/wall/sections/${encodeSegment(sectionId)}/cards`),
  },
  boards: {
    shareEnsure: (boardId: string | number): ApiPath => apiPath(apiV1Path(`boards/${boardId}/share/ensure`)),
    shareSettings: (boardId: string | number): ApiPath => apiPath(apiV1Path(`boards/${boardId}/share-settings`)),
    settings: (boardId: string | number): ApiPath => apiPath(apiV1Path(`boards/${boardId}/settings`)),
    live: (boardId: string | number): ApiPath => apiPath(apiV1Path(`boards/${boardId}/live`)),
    questions: (boardId: string | number): ApiPath => apiPath(apiV1Path(`boards/${boardId}/questions`)),
    tagRules: (boardId: string | number): ApiPath => apiPath(apiV1Path(`boards/${boardId}/tag-rules`)),
    audit: (boardId: string | number): ApiPath => apiPath(apiV1Path(`boards/${boardId}/audit`)),
    webStudioSubmissions: (boardId: string | number): ApiPath =>
      apiPath(apiV1Path(`boards/${boardId}/lesson-session/web-studio/submissions`)),
    webStudioSettings: (boardId: string | number): ApiPath =>
      apiPath(apiV1Path(`boards/${boardId}/lesson-session/web-studio/settings`)),
    webStudioSubmissionCard: (boardId: string | number, stateId: string | number): ApiPath =>
      apiPath(apiV1Path(`boards/${boardId}/lesson-session/web-studio/submissions/${stateId}/create-card`)),
    cardsTagsBulk: (boardId: string | number): ApiPath => apiPath(apiV1Path(`boards/${boardId}/cards/tags/bulk`)),
    files: {
      list: (boardId: string | number): ApiPath => apiPath(apiV1Path(`boards/${boardId}/files`)),
      attach: (boardId: string | number): ApiPath => apiPath(apiV1Path(`boards/${boardId}/files/attach`)),
      insert: (boardId: string | number): ApiPath => apiPath(apiV1Path(`boards/${boardId}/files/insert`)),
      insertWithId: (boardId: string | number, fileId: string | number): ApiPath =>
        apiPath(apiV1Path(`boards/${boardId}/files/${fileId}/insert`)),
    },
    byId: (boardId: string | number, ...segments: Array<string | number>): ApiPath =>
      apiPath(apiV1Path(`boards/${boardId}/${segments.map(String).join("/")}`).replace(/\/$/, "")),
  },
  s: {
    requests: (code: string | number): ApiPath => apiPath(apiV1Path(`s/${encodeSegment(code)}/requests`)),
  },
  sessions: {
    byId: (sessionId: string, ...segments: Array<string | number>): ApiPath =>
      apiPath(apiV1Path(`sessions/${sessionId}/${segments.map(String).join("/")}`).replace(/\/$/, "")),
  },
  onboarding: {
    demo: (): ApiPath => apiPath(apiV1Path("onboarding/demo")),
    kickstart: (): ApiPath => apiPath(apiV1Path("onboarding/kickstart")),
  },
  showcase: {
    ensure: (): ApiPath => apiPath(apiV1Path("showcase/ensure")),
    refresh: (token: string | number): ApiPath => apiPath(apiV1Path(`showcase/${encodeSegment(token)}/refresh`)),
    revoke: (token: string | number): ApiPath => apiPath(apiV1Path(`showcase/${encodeSegment(token)}/revoke`)),
    template: (token: string | number): ApiPath => apiPath(apiV1Path(`showcase/${encodeSegment(token)}/template`)),
  },
  exhibits: {
    ensure: (): ApiPath => apiPath(apiV1Path("exhibits/ensure")),
    refresh: (exhibitId: string | number): ApiPath =>
      apiPath(apiV1Path(`exhibits/${encodeSegment(exhibitId)}/refresh`)),
    revoke: (exhibitId: string | number): ApiPath =>
      apiPath(apiV1Path(`exhibits/${encodeSegment(exhibitId)}/revoke`)),
  },
  storage: {
    usage: (): ApiPath => apiPath(apiV1Path("storage/usage")),
    savings: (): ApiPath => apiPath(apiV1Path("storage/savings")),
  },
  dashboardInternal: {
    analyticsEvents: (): ApiPath => apiPath(apiV1Path("dashboard/analytics/events")),
    homeHubViewed: (): ApiPath => apiPath(apiV1Path("dashboard/home-hub-v2/viewed")),
  },
  edu: {
    teacherPublishQuotaReset: (): ApiPath => apiPath(apiV1Path("edu/teacher/publish-quota/reset")),
  },
  labs: {
    practiceCards: (): ApiPath => apiPath(apiV1Path("labs/practice/cards")),
  },
  ops: {
    ping: (): ApiPath => apiPath(apiV1Path("ops/ping")),
    whoami: (): ApiPath => apiPath(apiV1Path("ops/whoami")),
    uiError: (): ApiPath => apiPath(apiV1Path("ops/ui-error")),
    banners: (): ApiPath => apiPath(apiV1Path("ops/banners")),
    bannersActive: (): ApiPath => apiPath(apiV1Path("ops/banners/active")),
    siteContentByKey: (key: string): ApiPath => apiPath(apiV1Path(`ops/site-content/${encodeSegment(key)}`)),
    siteContentRevisions: (key: string, limit?: number): ApiPath => {
      const base = apiV1Path(`ops/site-content/${encodeSegment(key)}/revisions`);
      if (!limit) return apiPath(base);
      return apiPath(`${base}?${new URLSearchParams({ limit: String(limit) }).toString()}`);
    },
    siteContentPublish: (key: string): ApiPath => apiPath(apiV1Path(`ops/site-content/${encodeSegment(key)}/publish`)),
    siteContentRollback: (key: string): ApiPath => apiPath(apiV1Path(`ops/site-content/${encodeSegment(key)}/rollback`)),
    eduSummary: (): ApiPath => apiPath(apiV1Path("ops/edu/summary")),
    trashPurge: (): ApiPath => apiPath(apiV1Path("ops/trash/purge")),
    notFoundAlert: (): ApiPath => apiPath(apiV1Path("ops/not-found/alert")),
    notFoundBrokenLinks: (): ApiPath => apiPath(apiV1Path("ops/not-found/broken-links")),
    notFoundBrokenLinksBundle: (): ApiPath => apiPath(apiV1Path("ops/not-found/broken-links/bundle")),
    notFoundWorkQueue: (): ApiPath => apiPath(apiV1Path("ops/not-found/work-queue")),
    diagRequest: (requestId: string | number, opts?: { limit?: number }): ApiPath => {
      const base = apiV1Path(`ops/diag/request/${encodeSegment(requestId)}`);
      if (!opts?.limit) {
        return apiPath(base);
      }
      const search = new URLSearchParams({ limit: String(opts.limit) });
      return apiPath(`${base}?${search.toString()}`);
    },
  },
  opsAdmin: {
    users: (): ApiPath => apiPath(apiV1Path("ops/admin/users")),
    userSearch: (): ApiPath => apiPath(apiV1Path("ops/users")),
    userEduFlags: (userId: string): ApiPath => apiPath(apiV1Path(`ops/users/${encodeSegment(userId)}/edu-flags`)),
    featureFlags: (): ApiPath => apiPath(apiV1Path("ops/users/feature-flags")),
    featureFlagsUpdate: (): ApiPath => apiPath(apiV1Path("ops/users/feature-flags/update")),
    storage: {
      quotaUpdate: (): ApiPath => apiPath(apiV1Path("ops/admin/storage/quota")),
    },
    edu: {
      publishQuotaReset: (): ApiPath => apiPath(apiV1Path("ops/admin/edu/publish-quota/reset")),
    },
    coupons: {
      create: (): ApiPath => apiPath(apiV1Path("ops/admin/coupons/create")),
      list: (): ApiPath => apiPath(apiV1Path("ops/admin/coupons/list")),
    },
  },
  system: {
    diag: (): ApiPath => apiPath(apiV1Path("system/diag")),
  },
  me: {
    uiPrefs: (): ApiPath => apiPath(apiV1Path("me/ui-prefs")),
    uiPrefsPresets: (): ApiPath => apiPath(apiV1Path("me/ui-prefs/presets")),
  },
} as const;

export const page = {
  home: (): PagePath => pagePath("/"),
  auth: {
    login: (): PagePath => pagePath("/auth/login"),
  },
  dashboard: {
    root: (): PagePath => pagePath("/dashboard"),
    boards: (): PagePath => pagePath("/dashboard/boards"),
    board: (boardId: string): PagePath => pagePath(`/dashboard/boards/${boardId}`),
    boardBoard: (boardId: string): PagePath => pagePath(`/dashboard/boards/${boardId}/board`),
    boardClass: (boardId: string): PagePath => pagePath(`/dashboard/boards/${boardId}/class`),
    boardWalls: (boardId: string): PagePath => pagePath(`/dashboard/boards/${boardId}/walls`),
    boardWall: (boardId: string, wallId: string): PagePath =>
      pagePath(`/dashboard/boards/${boardId}/walls/${wallId}`),
    boardGrid: (boardId: string): PagePath => pagePath(`/dashboard/boards/${boardId}/grid`),
    boardSessions: (boardId: string): PagePath => pagePath(`/dashboard/boards/${boardId}/sessions`),
    boardFiles: (boardId: string): PagePath => pagePath(`/dashboard/boards/${boardId}/files`),
    boardRemote: (boardId: string): PagePath => pagePath(`/dashboard/boards/${boardId}/remote`),
    boardEdit: (boardId: string): PagePath => pagePath(`/dashboard/boards/${boardId}/edit`),
    templates: (): PagePath => pagePath("/dashboard/templates"),
    templatesCommunity: (): PagePath => pagePath("/dashboard/templates/community"),
    billing: (): PagePath => pagePath("/dashboard/billing"),
    billingSuccess: (): PagePath => pagePath("/dashboard/billing/success"),
    billingInstitution: (): PagePath => pagePath("/dashboard/billing/institution"),
    storage: (): PagePath => pagePath("/dashboard/storage"),
    files: (): PagePath => pagePath("/dashboard/files"),
    library: (): PagePath => pagePath("/dashboard/library"),
    gallery: (): PagePath => pagePath("/dashboard/gallery"),
    firstLesson: (): PagePath => pagePath("/dashboard/first-lesson"),
    offline: (): PagePath => pagePath("/dashboard/offline"),
    pro: (): PagePath => pagePath("/dashboard/pro"),
    settings: (): PagePath => pagePath("/dashboard/settings"),
    settingsCustomize: (): PagePath => pagePath("/dashboard/settings/customize"),
    system: (): PagePath => pagePath("/dashboard/system"),
    audit: (): PagePath => pagePath("/dashboard/audit"),
    ops: (): PagePath => pagePath("/dashboard/ops"),
    opsEdu: (): PagePath => pagePath("/dashboard/ops/edu"),
    opsWorkQueue: (): PagePath => pagePath("/dashboard/ops/work-queue"),
    opsUsers: (): PagePath => pagePath("/dashboard/ops/users"),
    opsBilling: (): PagePath => pagePath("/dashboard/ops/billing"),
    opsTemplates: (): PagePath => pagePath("/dashboard/ops/templates"),
    opsCoupons: (): PagePath => pagePath("/dashboard/ops/coupons"),
    opsNotFound: (): PagePath => pagePath("/dashboard/ops/not-found"),
    opsHomepageStyle: (): PagePath => pagePath("/dashboard/ops/homepage-style"),
    opsSiteContent: (): PagePath => pagePath("/dashboard/ops/site-content"),
    opsBanners: (): PagePath => pagePath("/dashboard/ops/banners"),
    import: {
      board: (): PagePath => pagePath("/dashboard/import/board"),
      padlet: (): PagePath => pagePath("/dashboard/import/padlet"),
      recap: (): PagePath => pagePath("/dashboard/import/recap"),
    },
    classes: (): PagePath => pagePath("/dashboard/classes"),
    classDetail: (classId: string): PagePath => pagePath(`/dashboard/classes/${classId}`),
    classGallery: (classId: string): PagePath => pagePath(`/dashboard/classes/${classId}/gallery`),
    classLaunch: (classId: string): PagePath => pagePath(`/dashboard/classes/${classId}/launch`),
  },
  share: {
    root: (): PagePath => pagePath("/s"),
    byCode: (code: string | number): PagePath => pagePath(`/s/${encodePublicSegment(code)}`),
    present: (code: string | number): PagePath => pagePath(`/s/${encodePublicSegment(code)}/present`),
    grid: (code: string | number): PagePath => pagePath(`/s/${encodePublicSegment(code)}/grid`),
    wall: (code: string | number, wallId: string | number): PagePath =>
      pagePath(`/s/${encodePublicSegment(code)}/walls/${wallId}`),
    wallPresent: (code: string | number, wallId: string | number): PagePath =>
      pagePath(`/s/${encodePublicSegment(code)}/walls/${wallId}/present`),
    wallPresentSlides: (code: string | number, wallId: string | number): PagePath =>
      pagePath(`/s/${encodePublicSegment(code)}/walls/${wallId}/present/slides`),
    slides: (code: string | number): PagePath => pagePath(`/s/${encodePublicSegment(code)}/slides`),
    show: (code: string | number): PagePath => pagePath(`/s/${encodePublicSegment(code)}/show`),
    wallMode: (code: string | number): PagePath => pagePath(`/s/${encodePublicSegment(code)}/wall`),
    recap: (code: string | number, sessionId: string | number): PagePath =>
      pagePath(`/s/${encodePublicSegment(code)}/recap/${sessionId}`),
  },
  short: {
    byCode: (code: string | number): PagePath => pagePath(`/${encodePublicSegment(code)}`),
    present: (code: string | number): PagePath => pagePath(`/${encodePublicSegment(code)}/present`),
    slides: (code: string | number): PagePath => pagePath(`/${encodePublicSegment(code)}/slides`),
  },
  invite: {
    accept: (token: string | number): PagePath => pagePath(`/invite/${encodePublicSegment(token)}`),
  },
  token: {
    c: (token: string | number): PagePath => pagePath(`/c/${encodePublicSegment(token)}`),
    e: (token: string | number): PagePath => pagePath(`/e/${encodePublicSegment(token)}`),
    r: (token: string | number): PagePath => pagePath(`/r/${encodePublicSegment(token)}`),
    x: (token: string | number): PagePath => pagePath(`/x/${encodePublicSegment(token)}`),
    k: (code: string | number): PagePath => pagePath(`/k/${encodePublicSegment(code)}`),
  },
} as const;

export const routes = { api, page } as const;

export type ApiRouteBuilder = typeof api;
export type PageRouteBuilder = typeof page;
