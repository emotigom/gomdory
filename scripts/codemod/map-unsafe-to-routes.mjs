export const stringMappings = new Map([
  ["/api/v1/billing/plan", { callee: "routes.api.billing.plan", args: [] }],
  ["/api/v1/billing/upgrade-request", { callee: "routes.api.billing.upgradeRequest", args: [] }],
  ["/api/v1/billing/checkout", { callee: "routes.api.billing.checkout", args: [] }],
  ["/api/v1/billing/portal", { callee: "routes.api.billing.portal", args: [] }],
  ["/api/v1/onboarding/demo", { callee: "routes.api.onboarding.demo", args: [] }],
  ["/api/v1/onboarding/kickstart", { callee: "routes.api.onboarding.kickstart", args: [] }],
  ["/api/v1/files/prepare", { callee: "routes.api.files.prepare", args: [] }],
  ["/api/v1/ops/ping", { callee: "routes.api.ops.ping", args: [] }],
  ["/api/v1/storage/usage", { callee: "routes.api.storage.usage", args: [] }],
  ["/api/v1/system/diag", { callee: "routes.api.system.diag", args: [] }],
  ["/api/v1/template-collections", { callee: "routes.api.templateCollections.root", args: [] }],
  ["/api/v1/templates/publish", { callee: "routes.api.templates.publish", args: [] }],
  ["/api/v1/showcase/ensure", { callee: "routes.api.showcase.ensure", args: [] }],
  ["/api/v1/exhibits/ensure", { callee: "routes.api.exhibits.ensure", args: [] }],
]);

export const templateMappings = [
  {
    head: "/api/v1/template-collections/",
    tails: [""],
    callee: "routes.api.templateCollections.bySlug",
  },
  {
    head: "/api/v1/templates/",
    tails: [""],
    callee: "routes.api.templates.byId",
  },
  {
    head: "/api/v1/templates/",
    tails: ["/copy"],
    callee: "routes.api.templates.copy",
  },
  {
    head: "/api/v1/templates/",
    tails: ["/report"],
    callee: "routes.api.templates.report",
  },
  {
    head: "/api/v1/files/",
    tails: ["/view"],
    callee: "routes.api.files.view",
  },
  {
    head: "/api/v1/files/",
    tails: ["/download"],
    callee: "routes.api.files.download",
  },
  {
    head: "/api/v1/boards/",
    tails: ["/share/ensure"],
    callee: "routes.api.boards.shareEnsure",
  },
  {
    head: "/api/v1/boards/",
    tails: ["/share-settings"],
    callee: "routes.api.boards.shareSettings",
  },
  {
    head: "/api/v1/boards/",
    tails: ["/live"],
    callee: "routes.api.boards.live",
  },
  {
    head: "/api/v1/s/",
    tails: ["/requests"],
    callee: "routes.api.s.requests",
  },
  {
    head: "/api/v1/share/",
    tails: ["/files/", "/download"],
    callee: "routes.api.share.files.download",
  },
  {
    head: "/api/v1/share/",
    tails: ["/feed"],
    callee: "routes.api.share.feed",
  },
  {
    head: "/api/v1/share/",
    tails: ["/present"],
    callee: "routes.api.share.present",
  },
  {
    head: "/api/v1/showcase/",
    tails: ["/refresh"],
    callee: "routes.api.showcase.refresh",
  },
  {
    head: "/api/v1/showcase/",
    tails: ["/revoke"],
    callee: "routes.api.showcase.revoke",
  },
  {
    head: "/api/v1/showcase/",
    tails: ["/template"],
    callee: "routes.api.showcase.template",
  },
  {
    head: "/api/v1/exhibits/",
    tails: ["/refresh"],
    callee: "routes.api.exhibits.refresh",
  },
  {
    head: "/api/v1/exhibits/",
    tails: ["/revoke"],
    callee: "routes.api.exhibits.revoke",
  },
];
