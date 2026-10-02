const RELATIVE_HTML_ATTR_URL_RE = /\b(src|href)=(['"])([^'"\s][^'"]*)\2/gi;

function shouldSkipRewrite(url: string, deploymentPrefix: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.startsWith("http://") ||
    lower.startsWith("https://") ||
    lower.startsWith("//") ||
    lower.startsWith("data:") ||
    lower.startsWith("blob:") ||
    lower.startsWith("mailto:") ||
    lower.startsWith("tel:") ||
    lower.startsWith("javascript:") ||
    lower.startsWith("#") ||
    lower.startsWith("/") ||
    lower.startsWith(deploymentPrefix.toLowerCase())
  );
}

export function rewritePublishedStudentAppHtmlAssetUrls(html: string, deploymentId: string): string {
  const encodedDeploymentId = encodeURIComponent(deploymentId);
  const deploymentPrefix = `/apps/${encodedDeploymentId}/`;

  return html.replace(RELATIVE_HTML_ATTR_URL_RE, (full, attr: string, quote: string, originalUrl: string) => {
    const url = originalUrl.trim();
    if (!url || shouldSkipRewrite(url, deploymentPrefix)) return full;

    const normalized = url.replace(/^\.\/+/, "");
    if (!normalized) return full;

    return `${attr}=${quote}${deploymentPrefix}${normalized}${quote}`;
  });
}
