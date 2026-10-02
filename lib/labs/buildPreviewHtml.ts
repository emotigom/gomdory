function escapeClosingScriptTag(value: string): string {
  return value.replace(/<\/script/gi, "<\\/script");
}

export function buildPreviewHtml(input: { html: string; css: string; js: string }): string {
  const html = input.html ?? "";
  const css = input.css ?? "";
  const js = escapeClosingScriptTag(input.js ?? "");

  return [
    "<!doctype html>",
    '<html lang="ko">',
    "<head>",
    '  <meta charset="utf-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
    "  <style>",
    css,
    "  </style>",
    "</head>",
    "<body>",
    html,
    "  <script>",
    js,
    "  </script>",
    "</body>",
    "</html>",
  ].join("\n");
}

