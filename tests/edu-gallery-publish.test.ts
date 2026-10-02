import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

import { handleGet } from "@/app/api/v1/edu/projects/list/handler";
import {
  EDU_PUBLISH_GALLERY_FIXTURE,
  buildPublishedGalleryRow,
  createEduPublishGalleryAdminStub,
} from "@/tests/helpers/eduPublishGalleryFixtures";

test("edu gallery list includes published project entries", async () => {
  const publishedProject = buildPublishedGalleryRow();

  const response = await handleGet(
    new NextRequest(new Request(`http://localhost/api/v1/edu/projects/list?shareCode=${EDU_PUBLISH_GALLERY_FIXTURE.shareCode}`)),
    {
      createSupabaseAdminClientFn: () => createEduPublishGalleryAdminStub({ data: [publishedProject], error: null }),
    },
  );

  const payload = (await response.json()) as {
    code?: string;
    message?: string;
    items?: Array<{ slug: string; title: string; thumbUrl?: string | null }>;
  };

  if (response.status !== 200) {
    console.error("[edu-gallery-publish.test] non-200 response", payload);
  }

  assert.equal(response.status, 200);
  assert.equal(payload.items?.length, 1);
  assert.equal(payload.items?.[0]?.slug, EDU_PUBLISH_GALLERY_FIXTURE.inSlug);
  assert.equal(payload.items?.[0]?.title, EDU_PUBLISH_GALLERY_FIXTURE.title);
  assert.ok(payload.items?.[0]?.thumbUrl?.includes(`/v1/${EDU_PUBLISH_GALLERY_FIXTURE.inSlug}/thumb.png`));
});
