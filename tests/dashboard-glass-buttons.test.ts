import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("dashboard button surfaces use shared glass button helper", () => {
  const topRight = fs.readFileSync("app/dashboard/_components/DashboardTopRightControls.tsx", "utf8");
  const createSection = fs.readFileSync("app/dashboard/CreateBoardSection.tsx", "utf8");
  const telemetry = fs.readFileSync("app/dashboard/_components/AiTelemetryWidget.tsx", "utf8");
  const dashboardUi = fs.readFileSync("app/dashboard/_components/dashboardUi.tsx", "utf8");

  assert.match(topRight, /dashboardGlassButtonClass\(/);
  assert.match(createSection, /dashboardGlassButtonClass\("primary"/);
  assert.match(telemetry, /dashboardGlassButtonClass\(active \? "selected" : "secondary"/);
  assert.match(dashboardUi, /dashboardGlassButtonClass\("icon"/);
});
