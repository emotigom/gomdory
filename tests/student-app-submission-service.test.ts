import assert from "node:assert/strict";
import test from "node:test";
import { createStudentAppSubmission } from "@/lib/student-apps/createStudentAppSubmission";
import { verifySubmissionStatusCapability } from "@/lib/student-apps/submissionStatusCapability";

const payload = { source: "manual_files", files: [{ name: "index.html", contentType: "text/html", contentText: "<html><body>ok</body></html>" }] };
const bucket = { put: async () => ({} as R2Object), delete: async () => {} } as unknown as R2Bucket;

test("validation failure does not write", async () => {
  let inserted = false;
  const supabase:any = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "b1" }, error: null }) }) }), insert: () => { inserted = true; return { select: () => ({ single: async () => ({ data: null, error: null }) }) }; } }) };
  const res = await createStudentAppSubmission({ bucket, supabase, boardId: "b1", rawPayload: { source: "manual_files", files: [{ name: "bad.txt", contentText: "x" }] } });
  assert.equal(res.ok, false); assert.equal(inserted, false);
});

test("success path includes version metadata and no public url", async () => {
  let previousUpdated = false;
  let insertedOwnership: any = null;
  const chain = (row:any) => ({ eq: () => chain(row), is: () => chain(row), order: () => chain(row), limit: () => chain(row), maybeSingle: async() => ({ data: row, error: null }) });
  const supabase:any = { from: (t:string) => t==="boards"?({select:()=>({eq:()=>({maybeSingle:async()=>({data:{id:"b1"},error:null})})})}): t==="student_app_submissions"?({
    select:()=>chain({id:"prev1",version:1}),
    insert:(values:any)=>{ insertedOwnership = values; return {select:()=>({single:async()=>({data:{id:"s1",board_id:"b1",title:"student-app",status:"submitted",created_at:"2026-05-24T00:00:00.000Z",version:2,is_latest:true,previous_submission_id:"prev1"},error:null})})}; },
    update:(v:any)=>({eq:async()=>{ if(v?.is_latest===false) previousUpdated=true; return {error:null};}}),
    delete:()=>({eq:async()=>({error:null})})
  }):({insert:async()=>({error:null})}) };
  const res:any = await createStudentAppSubmission({ bucket, supabase, boardId: "b1", classSessionId: "cs1", authorClientId: "author_12345", ownership: { version: 1, participantOwnerHash: "a".repeat(64) }, rawPayload: payload });
  assert.equal(res.ok, true); assert.equal(res.submission.version, 2); assert.equal(res.submission.previousSubmissionId, "prev1"); assert.equal(previousUpdated, true);
  assert.equal(JSON.stringify(res).includes("publicUrl"), false);
  assert.equal(insertedOwnership.ownership_version, 1);
  assert.equal(insertedOwnership.owner_participant_hash, "a".repeat(64));
  assert.match(insertedOwnership.status_capability_hash, /^[a-f0-9]{64}$/);
  assert.equal(verifySubmissionStatusCapability(res.submission.statusCapability, insertedOwnership.status_capability_hash), true);
  assert.doesNotMatch(JSON.stringify(insertedOwnership), new RegExp(res.submission.statusCapability));
  assert.equal(JSON.stringify(res).includes("participantOwnerHash"), false);
});

test("legacy submission does not record client-controlled ownership", async () => {
  let inserted: any = null;
  const supabase:any = { from: (table:string) => table === "boards"
    ? { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "b1" }, error: null }) }) }) }
    : table === "student_app_submissions"
      ? {
        insert: (values:any) => { inserted = values; return { select: () => ({ single: async () => ({ data: { id: "s2", board_id: "b1", title: "student-app", status: "submitted", created_at: "2026-05-24T00:00:00.000Z", version: 1, is_latest: true, previous_submission_id: null }, error: null }) }) }; },
        update: () => ({ eq: async () => ({ error: null }) }), delete: () => ({ eq: async () => ({ error: null }) }),
      }
      : { insert: async () => ({ error: null }) } };
  const res:any = await createStudentAppSubmission({ bucket, supabase, boardId: "b1", authorClientId: "browser-controlled-id", rawPayload: payload });
  assert.equal(res.ok, true);
  assert.equal(inserted.ownership_version, null);
  assert.equal(inserted.owner_participant_hash, null);
  assert.equal(inserted.status_capability_hash, null);
  assert.notEqual(inserted.owner_participant_hash, "browser-controlled-id");
});

test("submission service reuses one prepared payload for validation and R2 storage", () => {
  const source = require("node:fs").readFileSync("lib/student-apps/createStudentAppSubmission.ts", "utf8");
  assert.match(source, /prepareStudentStaticAppForStorage\(input\.rawPayload\)/);
  assert.match(source, /files: prepared\.filesForStorage/);
  assert.doesNotMatch(source, /decodeStudentStaticAppPayload\(/);
  assert.doesNotMatch(source, /normalizeStudentAppFiles\(/);
});
