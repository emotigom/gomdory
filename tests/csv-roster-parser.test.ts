import assert from "node:assert/strict";
import test from "node:test";

import { parseCsvRosterDryRun } from "@/lib/roster/csvRosterParser";

test("valid Korean CSV", () => {
  const csv = "학급명,역할,표시명,외부ID\n1반,교사,선생님,t\n1반,학생,학생A,s";
  const out = parseCsvRosterDryRun(csv);
  assert.equal(out.rows[0]?.role, "teacher");
  assert.equal(out.rows[1]?.role, "student");
});

test("valid English CSV", () => {
  const csv = "class_name,role,display_label,external_id,email\nA,teacher,Kim,t1,kim@example.com\nA,student,Lee,s1,";
  const out = parseCsvRosterDryRun(csv);
  assert.equal(out.summary.acceptedRows, 2);
});

test("sensitive columns", () => {
  const csv = "class_name,role,display_label,전화번호\nA,student,Nick,010-1111-2222";
  const out = parseCsvRosterDryRun(csv);
  assert.equal(out.errors.some((e) => e.code === "sensitive_column_detected"), true);
});

test("malformed quoted CSV", () => {
  const out = parseCsvRosterDryRun('class_name,role,display_label\n"A,student,Nick');
  assert.equal(out.errors.some((e) => e.code === "malformed_csv"), true);
});

test("duplicate external_id", () => {
  const out = parseCsvRosterDryRun("class_name,role,display_label,external_id\nA,student,N1,same\nA,student,N2,same");
  assert.equal(out.warnings.some((w) => w.code === "duplicate_external_id"), true);
});

test("duplicate display_label in class", () => {
  const out = parseCsvRosterDryRun("class_name,role,display_label\nA,student,N1\nA,teacher,N1");
  assert.equal(out.warnings.some((w) => w.code === "duplicate_display_label_in_class"), true);
});

test("invalid role", () => {
  const out = parseCsvRosterDryRun("class_name,role,display_label\nA,admin,N");
  assert.equal(out.errors.some((e) => e.code === "invalid_role"), true);
});

test("missing required header", () => {
  const out = parseCsvRosterDryRun("class_name,display_label\nA,N");
  assert.equal(out.errors.some((e) => e.code === "missing_required_header"), true);
});

test("max rows exceeded", () => {
  const out = parseCsvRosterDryRun("class_name,role,display_label\nA,teacher,N\nB,student,N2", { maxRows: 1 });
  assert.equal(out.errors.some((e) => e.code === "max_rows_exceeded"), true);
});

test("max cell length exceeded", () => {
  const out = parseCsvRosterDryRun("class_name,role,display_label\nA,teacher,VeryLongName", { maxCellLength: 3 });
  assert.equal(out.errors.some((e) => e.code === "max_cell_length_exceeded"), true);
});
