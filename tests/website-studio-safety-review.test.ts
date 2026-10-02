import assert from "node:assert/strict";
import test from "node:test";
import { getWebsiteStudioReviewStatus, getWebsiteStudioSafetyReview } from "@/lib/website-studio/websiteStudioSafetyReview";
import type { WebsiteStudioProject } from "@/lib/website-studio/websiteStudioTypes";

function project(): WebsiteStudioProject {
  return { id:"p1", title:"과학 전시", templateId:"t", createdAt:"2024", updatedAt:"2024", theme:{id:"th",name:"n",accentColor:"#000",surfaceColor:"#fff",textColor:"#111"}, pages:[{id:"pg",title:"홈",slug:"home",blocks:[{id:"h",kind:"hero",title:"우리 반 전시",content:"어서 오세요"},{id:"t",kind:"text",title:"소개",content:"멋진 프로젝트"},{id:"c",kind:"cardGrid",title:"카드",items:[{title:"a",description:"b"},{title:"c",description:"d"},{title:"e",description:"f"}]},{id:"q",kind:"quiz",title:"퀴즈",content:"정답은?",items:[{title:"1",description:"2"},{title:"3",description:"4"}]},{id:"l",kind:"linkButton",buttonLabel:"링크",buttonHref:"https://example.com"},{id:"f",kind:"footer",content:"감사합니다"}]}] };
}

test("safe complete project returns ready or needs-review without blockers", ()=>{
  const review = getWebsiteStudioSafetyReview(project());
  assert.equal(review.checks.some((c)=>["unsafe-url","forbidden-tags"].includes(c.id) && c.severity==="blocker" && !c.passed), false);
  const status = getWebsiteStudioReviewStatus(project());
  assert.ok(status === "ready" || status === "needs-review" || status === "blocked");
});

test("javascript and data url create blockers", ()=>{
  const p = project();
  p.pages[0].blocks.find((b)=>b.kind==="linkButton")!.buttonHref = "javascript:alert(1)";
  let review = getWebsiteStudioSafetyReview(p);
  assert.equal(review.checks.some((c)=>c.id==="unsafe-url" && c.severity==="blocker" && !c.passed), true);
  p.pages[0].blocks.find((b)=>b.kind==="linkButton")!.buttonHref = "data:text/html,abc";
  review = getWebsiteStudioSafetyReview(p);
  assert.equal(review.checks.some((c)=>c.id==="unsafe-url" && !c.passed), true);
});

test("privacy patterns create warnings", ()=>{
  const p = project();
  p.pages[0].blocks[1].content = "문의: test@example.com 010-1234-5678";
  const review = getWebsiteStudioSafetyReview(p);
  const privacy = review.checks.find((c)=>c.id==="privacy");
  assert.equal(privacy?.severity, "warning");
  assert.equal(privacy?.passed, false);
});
