export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function brandMark(): string {
  return `<span class="brand-mark" aria-hidden="true">🧠</span>`;
}

export function layout(
  title: string,
  body: string,
  options: { bodyClass?: string; scripts?: readonly string[] } = {},
): string {
  const bodyClass = options.bodyClass ? ` class="${escapeHtml(options.bodyClass)}"` : "";
  const scripts = (options.scripts ?? [])
    .map((src) => `<script src="${escapeHtml(src)}" defer></script>`)
    .join("\n");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
  <link rel="stylesheet" href="/styles.css">
</head>
<body${bodyClass}>
  <main>${body}</main>
${scripts}
</body>
</html>`;
}
