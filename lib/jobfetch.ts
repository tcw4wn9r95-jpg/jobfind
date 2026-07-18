import * as cheerio from "cheerio";

/**
 * Fetch a job posting URL and extract readable text. Many job boards are
 * JS-rendered or bot-blocked; callers should offer paste-the-description as a
 * fallback when this returns little content or throws.
 */
export async function fetchJobPage(
  url: string
): Promise<{ title: string; text: string }> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    throw new Error(`The page returned HTTP ${res.status}`);
  }
  const html = await res.text();
  const $ = cheerio.load(html);

  // JSON-LD JobPosting is the most reliable source when present
  let ldText = "";
  let ldTitle = "";
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).text());
      const items = Array.isArray(data) ? data : [data, ...(data["@graph"] ?? [])];
      for (const item of items) {
        if (item && item["@type"] === "JobPosting") {
          ldTitle = item.title ?? "";
          const desc = cheerio.load(item.description ?? "").text();
          const org =
            typeof item.hiringOrganization === "object"
              ? item.hiringOrganization?.name
              : item.hiringOrganization;
          ldText = [
            item.title && `Title: ${item.title}`,
            org && `Company: ${org}`,
            item.jobLocation &&
              `Location: ${JSON.stringify(item.jobLocation).slice(0, 300)}`,
            desc,
          ]
            .filter(Boolean)
            .join("\n");
        }
      }
    } catch {
      /* malformed JSON-LD is common; ignore */
    }
  });

  $("script, style, nav, header, footer, noscript, svg, iframe").remove();
  const bodyText = $("body")
    .text()
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const text = (ldText.length > 200 ? ldText : bodyText).slice(0, 20000);
  const title = ldTitle || $("title").first().text().trim();
  return { title, text };
}
