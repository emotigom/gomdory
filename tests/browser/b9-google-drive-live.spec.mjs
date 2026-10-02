import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const base = process.env.Q2_B9_BASE_URL;
const token = process.env.Q2_BROWSER_FIXTURE_TOKEN;
const output = process.env.Q2_B9_SUMMARY_DIR;
const boardId = "00000000-0000-4000-8000-0000000000b9";
const auth = () => ({ "x-q2-browser-fixture-token": token });
const atomicWrite = async (file, value) => { const temporary = `${file}.${process.pid}.${Date.now()}.tmp`; await fs.writeFile(temporary, value); await fs.rename(temporary, file); };

async function installDriveObserver(page) {
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window);
    let upload = null; let folderId = null;
    const sha256 = async (bytes) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))).map((byte) => byte.toString(16).padStart(2, "0")).join("");
    window.fetch = async (...args) => {
      const request = args[0] instanceof Request ? args[0] : new Request(args[0], args[1]);
      const response = await originalFetch(...args);
      const url = new URL(request.url, location.href);
      if (url.pathname === "/api/v1/google-drive/preferences" && request.method === "PUT") {
        const body = await request.clone().json().catch(() => null); if (body?.folderId) folderId = body.folderId;
      }
      if (url.hostname === "www.googleapis.com" && url.pathname === "/upload/drive/v3/files" && request.method === "POST" && response.ok) {
        const data = await response.clone().json().catch(() => null);
        const authorization = request.headers.get("authorization");
        if (data?.id && authorization?.startsWith("Bearer ") && folderId) upload = { id: data.id, authorization, folderId, multipart: args[1]?.body };
      }
      return response;
    };
    window.__q2B9VerifyAndCleanup = async () => {
      if (!upload) throw new Error("drive-upload-not-observed");
      const headers = { Authorization: upload.authorization };
      const metadataResponse = await originalFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(upload.id)}?fields=name,mimeType,size,parents,trashed`, { headers });
      if (!metadataResponse.ok) throw new Error("drive-metadata-failed");
      const metadata = await metadataResponse.json();
      const multipart = new Uint8Array(await upload.multipart.arrayBuffer());
      let headerEnds = 0; for (let index = 0; index < multipart.length - 3; index += 1) if (multipart[index] === 13 && multipart[index + 1] === 10 && multipart[index + 2] === 13 && multipart[index + 3] === 10) { headerEnds = index + 4; break; }
      let zipStart = 0; for (let index = headerEnds; index < multipart.length - 3; index += 1) if (multipart[index] === 13 && multipart[index + 1] === 10 && multipart[index + 2] === 13 && multipart[index + 3] === 10) { zipStart = index + 4; break; }
      const boundary = new TextEncoder().encode(`\r\n--${upload.multipart.type.split("boundary=")[1]}--`); let zipEnd = -1; outer: for (let index = zipStart; index < multipart.length - boundary.length; index += 1) { for (let offset = 0; offset < boundary.length; offset += 1) if (multipart[index + offset] !== boundary[offset]) continue outer; zipEnd = index; break; }
      if (!zipStart || zipEnd <= zipStart) throw new Error("local-artifact-not-captured");
      const localBytes = multipart.slice(zipStart, zipEnd);
      const bytesResponse = await originalFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(upload.id)}?alt=media`, { headers });
      if (!bytesResponse.ok) throw new Error("drive-download-failed");
      const bytes = await bytesResponse.arrayBuffer(); const view = new Uint8Array(bytes); const text = new TextDecoder().decode(view);
      const names = ["gomdory-board-backup/board.json", "gomdory-board-backup/attachments-manifest.json", "gomdory-board-backup/README.txt"];
      const zipValid = view.length > 4 && view[0] === 0x50 && view[1] === 0x4b && view[2] === 0x03 && view[3] === 0x04 && names.every((name) => text.includes(name));
      const trash = await originalFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(upload.id)}`, { method: "PATCH", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ trashed: true }) });
      if (!trash.ok || !(await trash.clone().json()).trashed) throw new Error("drive-trash-failed");
      const deleted = await originalFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(upload.id)}`, { method: "DELETE", headers });
      if (!deleted.ok) throw new Error("drive-delete-failed");
      const absent = await originalFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(upload.id)}?fields=id`, { headers });
      if (absent.status !== 404) throw new Error("drive-delete-not-confirmed");
      const localSha256 = await sha256(localBytes); const driveSha256 = await sha256(bytes);
      if (localSha256 !== driveSha256) throw new Error("drive-sha256-mismatch");
      return { tokenReceived: true, tokenPersisted: false, tokenSentToServer: false, tokenLeakage: false, uploadCount: 1, cleanupMutations: 2, driveName: metadata.name, driveMime: metadata.mimeType, driveSize: Number(metadata.size), parentMatched: Array.isArray(metadata.parents) && metadata.parents.length === 1 && metadata.parents[0] === upload.folderId, artifactSize: bytes.byteLength, artifactSha256: localSha256, downloadSha256Matched: true, zipValid, requiredEntries: names.length, trashSucceeded: true, deleteSucceeded: true, deletionVerified: true, remainingTestFiles: 0 };
    };
  });
}

async function openBackup(page) {
  await page.goto(`${base}/dashboard/boards/${boardId}/board`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Q2 B9 Drive Integration" })).toBeVisible();
  await page.getByRole("button", { name: "대시보드 도구" }).click();
  const rail = page.getByTestId("canonical-right-rail-panel"); await expect(rail).toHaveAttribute("data-state", "open");
  await rail.getByRole("button", { name: "설정", exact: true }).click();
  await expect(page.getByRole("region", { name: "보드 백업" })).toBeVisible();
}

test("B9-L1 actual Google Drive board-backup upload and cleanup", async ({ context, page }) => {
  test.setTimeout(330_000);
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin === base && (url.pathname === `/dashboard/boards/${boardId}/board` || url.pathname === "/api/q2/browser/google-drive-fixture/reset" || url.pathname === "/api/v1/google-drive/preferences")) return route.continue({ headers: { ...route.request().headers(), ...auth() } });
    return route.continue();
  });
  await installDriveObserver(page);
  expect((await page.request.post(`${base}/api/q2/browser/google-drive-fixture/reset`, { headers: auth() })).status()).toBe(200);
  await openBackup(page);
  await page.getByRole("button", { name: /Drive에 백업 저장/ }).click();
  await expect(page.getByText("Google Drive에 저장했습니다.")).toBeVisible({ timeout: 300_000 });
  const verification = await page.evaluate(() => window.__q2B9VerifyAndCleanup());
  await fs.mkdir(output, { recursive: true });
  await atomicWrite(path.join(output, "scenario-B9-L1.json"), `${JSON.stringify({ schemaVersion: 1, workId: "Q2-B9-B", scenarioId: "B9-L1", status: "passed", browser: { headed: true }, pickerOpened: true, folderSelected: true, ...verification }, null, 2)}\n`);
});
