import assert from "node:assert/strict";
import test from "node:test";
import { getWebsiteStudioExportSnapshot } from "@/lib/website-studio/websiteStudioSafetyReview";
import type { WebsiteStudioProject } from "@/lib/website-studio/websiteStudioTypes";

const p: WebsiteStudioProject = { id:"p", title:"t", templateId:"x", createdAt:"1", updatedAt:"1", theme:{id:"i",name:"n",accentColor:"#1",surfaceColor:"#2",textColor:"#3"}, pages:[{id:"pg",title:"home",slug:"home",blocks:[{id:"b1",kind:"hero",title:"<script>",content:"hello"},{id:"b2",kind:"footer",content:"끝"}]}] };

test("snapshot deterministic and sanitized", ()=>{
  const a = getWebsiteStudioExportSnapshot(p);
  const b = getWebsiteStudioExportSnapshot(p);
  assert.equal(a.document, b.document);
  assert.equal(a.html.includes("<script"), false);
  assert.equal(a.document.includes("onclick="), false);
  assert.equal(a.document.includes("onerror="), false);
});
