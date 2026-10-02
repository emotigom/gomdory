import assert from "node:assert/strict";
import test from "node:test";

import { resolveWebllmDownloadPolicyFromRequest } from "@/lib/edu/llm/webllmAccessPolicy";

const buildRequest = ({
  pathname,
  joinToken,
}: {
  pathname: string;
  joinToken?: string | null;
}) =>
  new Request("https://www.gomdory.com/api/v1/edu/feature-flags", {
    headers: {
      referer: `https://www.gomdory.com${pathname}`,
      ...(joinToken ? { cookie: `__Host-edu_jt=${joinToken}` } : {}),
    },
  });

test("download policy blocks sample lesson without jt", () => {
  const sampleOne = resolveWebllmDownloadPolicyFromRequest(
    buildRequest({ pathname: "/edu/lesson/1", joinToken: "" }),
  );
  const sampleFour = resolveWebllmDownloadPolicyFromRequest(
    buildRequest({ pathname: "/edu/lesson/4", joinToken: null }),
  );

  assert.equal(sampleOne.downloadAllowed, false);
  assert.equal(sampleFour.downloadAllowed, false);
});

test("download policy allows sample lesson with jt and non-sample paths", () => {
  const sampleWithJoinToken = resolveWebllmDownloadPolicyFromRequest(
    buildRequest({ pathname: "/edu/lesson/1", joinToken: "valid_join_token_1234" }),
  );
  const nonSampleLesson = resolveWebllmDownloadPolicyFromRequest(
    buildRequest({ pathname: "/edu/lesson/5", joinToken: "" }),
  );
  const coachPath = resolveWebllmDownloadPolicyFromRequest(
    buildRequest({ pathname: "/edu/coach", joinToken: "" }),
  );

  assert.equal(sampleWithJoinToken.downloadAllowed, true);
  assert.equal(nonSampleLesson.downloadAllowed, true);
  assert.equal(coachPath.downloadAllowed, true);
});


test("resolveWebllmDownloadPolicyFromRequest allows sample lesson API call with jt cookie", () => {
  const request = new Request("https://www.gomdory.com/api/v1/edu/feature-flags", {
    headers: {
      cookie: "__Host-edu_jt=valid_join_token_1234",
      referer: "https://www.gomdory.com/edu/lesson/1",
    },
  });
  const policy = resolveWebllmDownloadPolicyFromRequest(request);
  assert.equal(policy.pathname, "/edu/lesson/1");
  assert.equal(policy.hasJoinToken, true);
  assert.equal(policy.downloadAllowed, true);
});
