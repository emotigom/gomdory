import { EDU_COLUMNS, EDU_TABLES } from "@/lib/standards/eduDb";

type SupabaseQueryResponse = { data: Record<string, unknown>[] | null; error: { message: string } | null };

export const EDU_PUBLISH_GALLERY_FIXTURE = {
  shareCode: "wyvdv5",
  lessonId: 1,
  inSlug: "publish-1",
  title: "발표 잘하기",
  authorName: "학생",
  createdAt: new Date("2024-03-01T00:00:00.000Z").toISOString(),
  fileList: ["index.html", "thumb.png"],
  publishRpcResult: { data: { ok: true }, error: null },
  rateLimitRpcResult: { data: 1, error: null },
} as const;

export const buildPublishedGalleryRow = () => ({
  [EDU_COLUMNS.viewId]: EDU_PUBLISH_GALLERY_FIXTURE.inSlug,
  title: EDU_PUBLISH_GALLERY_FIXTURE.title,
  [EDU_COLUMNS.authorName]: EDU_PUBLISH_GALLERY_FIXTURE.authorName,
  [EDU_COLUMNS.lessonKey]: "P1",
  [EDU_COLUMNS.createdAt]: EDU_PUBLISH_GALLERY_FIXTURE.createdAt,
  [EDU_COLUMNS.previewUrl]: `https://eduview.gkrry.com/v1/${EDU_PUBLISH_GALLERY_FIXTURE.inSlug}/thumb.png`,
  [EDU_COLUMNS.viewCount]: 3,
  [EDU_COLUMNS.hidden]: false,
  [EDU_COLUMNS.hiddenReason]: null,
});

export const createQuery = (response: SupabaseQueryResponse) => {
  const query = {
    select: () => query,
    range: () => query,
    eq: () => query,
    or: () => query,
    gte: () => query,
    lte: () => query,
    order: () => query,
    not: () => query,
    maybeSingle: async () => ({ data: { [EDU_COLUMNS.shareCode]: EDU_PUBLISH_GALLERY_FIXTURE.shareCode }, error: null }),
    then: (resolve: (value: SupabaseQueryResponse) => void, reject: (reason?: unknown) => void) =>
      Promise.resolve(response).then(resolve, reject),
  };

  return query;
};

export const createEduPublishGalleryAdminStub = (galleryResponse: SupabaseQueryResponse) => {
  const galleryQuery = createQuery(galleryResponse);
  const classQuery = {
    select: () => classQuery,
    eq: () => classQuery,
    maybeSingle: async () => ({ data: { [EDU_COLUMNS.shareCode]: EDU_PUBLISH_GALLERY_FIXTURE.shareCode }, error: null }),
  };

  return {
    from: (table: string) => {
      if (table === EDU_TABLES.gallery) return galleryQuery;
      if (table === EDU_TABLES.classes) return classQuery;
      throw new Error(`Unexpected table in fixture stub: ${table}`);
    },
    rpc: async (fn: string) => {
      if (fn === "increment_api_rate_limit") {
        return EDU_PUBLISH_GALLERY_FIXTURE.rateLimitRpcResult;
      }
      return EDU_PUBLISH_GALLERY_FIXTURE.publishRpcResult;
    },
  };
};

export const createR2HeadListSuccessStub = () => ({
  head: async (key: string) => ({ key }),
  list: async () => ({ objects: EDU_PUBLISH_GALLERY_FIXTURE.fileList.map((key) => ({ key })) }),
});
