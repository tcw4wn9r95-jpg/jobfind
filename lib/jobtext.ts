/**
 * Browsers can't fetch arbitrary job pages directly (CORS), so we go through
 * r.jina.ai, a free public reader that returns a page's text as Markdown with
 * CORS enabled. Job boards that block robots still fail — callers offer
 * paste-the-description as the fallback.
 */
export async function fetchJobPage(
  url: string
): Promise<{ title: string; text: string }> {
  const res = await fetch(`https://r.jina.ai/${url}`, {
    headers: { Accept: "text/plain" },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    throw new Error(`The reader service returned HTTP ${res.status}`);
  }
  const text = (await res.text()).trim();
  const title = text.match(/^Title:\s*(.+)$/m)?.[1]?.trim() ?? "";
  return { title, text: text.slice(0, 20000) };
}
