export const stringMappings = new Map([
  ["/", { callee: "routes.page.home", args: [] }],
  ["/auth/login", { callee: "routes.page.auth.login", args: [] }],
  ["/dashboard", { callee: "routes.page.dashboard.root", args: [] }],
  ["/dashboard/boards", { callee: "routes.page.dashboard.boards", args: [] }],
  ["/dashboard/templates", { callee: "routes.page.dashboard.templates", args: [] }],
  ["/dashboard/templates/community", { callee: "routes.page.dashboard.templatesCommunity", args: [] }],
  ["/dashboard/billing", { callee: "routes.page.dashboard.billing", args: [] }],
  ["/dashboard/billing/success", { callee: "routes.page.dashboard.billingSuccess", args: [] }],
  ["/dashboard/billing/institution", { callee: "routes.page.dashboard.billingInstitution", args: [] }],
  ["/dashboard/storage", { callee: "routes.page.dashboard.storage", args: [] }],
  ["/dashboard/files", { callee: "routes.page.dashboard.files", args: [] }],
  ["/dashboard/gallery", { callee: "routes.page.dashboard.gallery", args: [] }],
  ["/dashboard/first-lesson", { callee: "routes.page.dashboard.firstLesson", args: [] }],
  ["/dashboard/pro", { callee: "routes.page.dashboard.pro", args: [] }],
  ["/dashboard/system", { callee: "routes.page.dashboard.system", args: [] }],
  ["/dashboard/ops", { callee: "routes.page.dashboard.ops", args: [] }],
  ["/dashboard/ops/billing", { callee: "routes.page.dashboard.opsBilling", args: [] }],
  ["/dashboard/ops/templates", { callee: "routes.page.dashboard.opsTemplates", args: [] }],
  ["/dashboard/import/board", { callee: "routes.page.dashboard.import.board", args: [] }],
  ["/dashboard/import/padlet", { callee: "routes.page.dashboard.import.padlet", args: [] }],
  ["/dashboard/import/recap", { callee: "routes.page.dashboard.import.recap", args: [] }],
  ["/dashboard/classes", { callee: "routes.page.dashboard.classes", args: [] }],
  ["/s", { callee: "routes.page.share.root", args: [] }],
]);

export const templateMappings = [
  {
    head: "/dashboard/boards/",
    tails: [""],
    callee: "routes.page.dashboard.board",
  },
  {
    head: "/dashboard/boards/",
    tails: ["/class"],
    callee: "routes.page.dashboard.boardClass",
  },
  {
    head: "/dashboard/boards/",
    tails: ["/walls"],
    callee: "routes.page.dashboard.boardWalls",
  },
  {
    head: "/dashboard/boards/",
    tails: ["/walls/", ""],
    callee: "routes.page.dashboard.boardWall",
  },
  {
    head: "/dashboard/boards/",
    tails: ["/grid"],
    callee: "routes.page.dashboard.boardGrid",
  },
  {
    head: "/dashboard/boards/",
    tails: ["/sessions"],
    callee: "routes.page.dashboard.boardSessions",
  },
  {
    head: "/dashboard/boards/",
    tails: ["/files"],
    callee: "routes.page.dashboard.boardFiles",
  },
  {
    head: "/dashboard/boards/",
    tails: ["/remote"],
    callee: "routes.page.dashboard.boardRemote",
  },
  {
    head: "/dashboard/classes/",
    tails: [""],
    callee: "routes.page.dashboard.classDetail",
  },
  {
    head: "/dashboard/classes/",
    tails: ["/gallery"],
    callee: "routes.page.dashboard.classGallery",
  },
  {
    head: "/dashboard/classes/",
    tails: ["/launch"],
    callee: "routes.page.dashboard.classLaunch",
  },
  {
    head: "/s/",
    tails: [""],
    callee: "routes.page.share.byCode",
  },
  {
    head: "/s/",
    tails: ["/present"],
    callee: "routes.page.share.present",
  },
  {
    head: "/s/",
    tails: ["/grid"],
    callee: "routes.page.share.grid",
  },
  {
    head: "/s/",
    tails: ["/walls/", ""],
    callee: "routes.page.share.wall",
  },
  {
    head: "/s/",
    tails: ["/walls/", "/present"],
    callee: "routes.page.share.wallPresent",
  },
  {
    head: "/s/",
    tails: ["/walls/", "/present/slides"],
    callee: "routes.page.share.wallPresentSlides",
  },
  {
    head: "/s/",
    tails: ["/slides"],
    callee: "routes.page.share.slides",
  },
  {
    head: "/s/",
    tails: ["/show"],
    callee: "routes.page.share.show",
  },
  {
    head: "/s/",
    tails: ["/wall"],
    callee: "routes.page.share.wallMode",
  },
  {
    head: "/s/",
    tails: ["/recap/", ""],
    callee: "routes.page.share.recap",
  },
  {
    head: "/invite/",
    tails: [""],
    callee: "routes.page.invite.accept",
  },
  {
    head: "/c/",
    tails: [""],
    callee: "routes.page.token.c",
  },
  {
    head: "/e/",
    tails: [""],
    callee: "routes.page.token.e",
  },
  {
    head: "/r/",
    tails: [""],
    callee: "routes.page.token.r",
  },
  {
    head: "/x/",
    tails: [""],
    callee: "routes.page.token.x",
  },
  {
    head: "/k/",
    tails: [""],
    callee: "routes.page.token.k",
  },
  {
    head: "/",
    tails: [""],
    callee: "routes.page.short.byCode",
  },
  {
    head: "/",
    tails: ["/present"],
    callee: "routes.page.short.present",
  },
  {
    head: "/",
    tails: ["/slides"],
    callee: "routes.page.short.slides",
  },
];
