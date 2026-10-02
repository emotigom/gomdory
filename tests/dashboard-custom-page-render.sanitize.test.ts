import assert from "node:assert/strict";
import test from "node:test";

import { resolveCustomPagePrefs } from "@/lib/teacherPrefs/customPageRender";

test("dashboard custom page render applies existing sanitizer for preset payload", () => {
  const resolved = resolveCustomPagePrefs(
    {
      teacherUiPrefs: {
        v: 2,
        dashboardCardRadius: 16,
        dashboardCardShadow: "soft",
        theme: "light",
        backgroundMode: "color",
        backgroundColor: "#ffffff",
        backgroundGradient: "linear-gradient(135deg, #fff 0%, #f6f6f6 100%)",
        backgroundImageUrl: null,
        textColor: "#111111",
        accentColor: "#4f46e5",
        fontFamily: "suit",
        density: "comfortable",
        baseFontSize: 16,
      },
      teacherUiCustomPresetsV2: [
        {
          id: "p_bad001",
          name: "Unsafe preset",
          createdAt: "2025-01-01T00:00:00.000Z",
          updatedAt: "2025-01-01T00:00:00.000Z",
          prefs: {
            v: 2,
            dashboardCardRadius: 20,
            dashboardCardShadow: "soft",
            theme: "light",
            backgroundMode: "image",
            backgroundColor: "#ffffff",
            backgroundGradient: "linear-gradient(10deg, #fff 0%, #eee 100%)",
            backgroundImageUrl: "javascript:alert(1)",
            textColor: "#ffffff",
            accentColor: "#0ea5e9",
            fontFamily: "system",
            density: "spacious",
            baseFontSize: 18,
          },
        },
      ],
    },
    { presetId: "p_bad001" },
  );

  assert.equal(resolved.source, "preset");
  assert.equal(resolved.prefs.backgroundMode, "color");
  assert.equal(resolved.prefs.backgroundImageUrl, null);
  assert.equal(resolved.prefs.textColor, "#1e1b16");
});
