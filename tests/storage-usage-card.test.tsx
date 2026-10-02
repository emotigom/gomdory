import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import StorageUsageCard from "@/app/dashboard/_components/StorageUsageCard";

test("StorageUsageCard renders the server loading skeleton", () => {
  const html = renderToStaticMarkup(<StorageUsageCard />);

  assert.ok(html.includes("Storage Usage"), html);
  assert.ok(html.includes("animate-pulse"));
});

test("StorageUsageCard renders the loading status copy", () => {
  const html = renderToStaticMarkup(<StorageUsageCard />);

  assert.ok(html.includes("유료로 사고 싶은 이유를 숫자로 보여줍니다."));
  assert.ok(html.includes("정상"));
});
