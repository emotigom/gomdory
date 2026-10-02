import type { ManualFile } from "./studentAppLocalPreview";

export type InspectorSample = {
  key: "validBasicApp" | "missingIndexSample" | "projectSourceSample" | "warningSample";
  label: string;
  files: ManualFile[];
};

export const inspectorSamples: InspectorSample[] = [
  {
    key: "validBasicApp",
    label: "정상 정적 앱 샘플",
    files: [
      {
        name: "index.html",
        path: "index.html",
        contentType: "text/html",
        contentText:
          '<!doctype html><html><head><meta charset="utf-8"><title>샘플 앱</title><link rel="stylesheet" href="styles/app.css"></head><body><img src="assets/icon.svg" alt="icon"><h1>샘플 앱</h1><script src="scripts/app.js"></script></body></html>',
      },
      { name: "app.css", path: "styles/app.css", contentType: "text/css", contentText: "body{font-family:sans-serif}h1{color:#0f766e}" },
      { name: "app.js", path: "scripts/app.js", contentType: "text/javascript", contentText: "document.querySelector('h1')?.setAttribute('data-ready','1');" },
      { name: "icon.svg", path: "assets/icon.svg", contentType: "image/svg+xml", contentText: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#14b8a6"/></svg>' },
    ],
  },
  {
    key: "missingIndexSample",
    label: "index.html 누락 샘플",
    files: [
      { name: "main.js", path: "main.js", contentText: "console.log('no index');" },
      { name: "style.css", path: "style.css", contentText: "body{margin:0}" },
    ],
  },
  {
    key: "projectSourceSample",
    label: "빌드 전 프로젝트 샘플",
    files: [
      { name: "package.json", path: "package.json", contentText: '{"name":"demo-app","scripts":{"dev":"vite"}}' },
      { name: "main.tsx", path: "src/main.tsx", contentText: "import { createRoot } from 'react-dom/client';" },
      { name: "App.tsx", path: "src/App.tsx", contentText: "export default function App(){return <h1>App</h1>}" },
    ],
  },
  {
    key: "warningSample",
    label: "주의 항목 샘플",
    files: [
      {
        name: "index.html",
        path: "index.html",
        contentText:
          '<!doctype html><html><head><script src="https://cdn.example.com/lib.js"></script></head><body><form action="https://example.com/submit" method="post"><input name="x"></form><script>fetch("https://api.example.com/ping");</script></body></html>',
      },
    ],
  },
];

export const inspectorSampleMap = Object.fromEntries(inspectorSamples.map((sample) => [sample.key, sample])) as Record<InspectorSample["key"], InspectorSample>;
