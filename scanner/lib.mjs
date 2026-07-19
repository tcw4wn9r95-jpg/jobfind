// Pure logic for the lead scanner: normalizing, scoring, deduping.
// No network access here — fetchers live in scan.mjs — so all of this is
// unit-testable with fixtures.

/** Stable short id from a URL (djb2). */
export function leadId(url) {
  let h = 5381;
  for (let i = 0; i < url.length; i++) h = ((h << 5) + h + url.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

export function stripHtml(s) {
  return (
    (s ?? "")
      // decode entities first — some boards double-encode their HTML
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&nbsp;/g, " ")
      .replace(/&#\d+;/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/** Normalize a raw job into the lead shape the app consumes. */
export function makeLead({ title, company, location, url, postedAt, description, source }) {
  return {
    id: leadId(url),
    title: (title ?? "").trim(),
    company: (company ?? "").trim(),
    location: (location ?? "").trim(),
    url,
    posted_at: postedAt ? new Date(postedAt).toISOString().slice(0, 10) : null,
    snippet: stripHtml(description).slice(0, 600),
    source,
  };
}

function tokens(s) {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9&+ ]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1)
  );
}

/**
 * Heuristic 0–100 score. 40 title fit, 30 keyword hits, 20 location fit,
 * 10 recency; hard exclusions return -1.
 */
export function scoreLead(lead, config) {
  const title = lead.title.toLowerCase();
  if (!title) return -1;
  for (const bad of config.exclude_title_words ?? []) {
    if (title.includes(bad.toLowerCase())) return -1;
  }
  if (config.max_age_days && lead.posted_at) {
    const age = (Date.now() - Date.parse(lead.posted_at)) / 86400000;
    if (age > config.max_age_days) return -1;
  }

  // Title: best word-overlap with any target title
  const titleTokens = tokens(title);
  let titleFit = 0;
  for (const target of config.target_titles ?? []) {
    const t = tokens(target.toLowerCase());
    let hit = 0;
    for (const w of t) if (titleTokens.has(w)) hit++;
    titleFit = Math.max(titleFit, hit / t.size);
  }

  // Keywords in title + snippet (capped so stuffing long posts doesn't win)
  const haystack = `${title} ${lead.snippet}`.toLowerCase();
  let kw = 0;
  for (const k of config.keywords ?? []) {
    if (haystack.includes(k.toLowerCase())) kw++;
  }
  const kwFit = Math.min(kw / 4, 1);

  // The location FIELD is the real signal; a mention buried in the
  // description ("...across EMEA...") only earns half credit — otherwise
  // on-site roles anywhere score as if they were EU/remote.
  const locField = lead.location.toLowerCase();
  const locSnippet = lead.snippet.toLowerCase();
  const locs = (config.locations ?? []).map((l) => l.toLowerCase());
  const locFit = locs.some((l) => locField.includes(l))
    ? 1
    : locs.some((l) => locSnippet.includes(l))
      ? 0.5
      : 0;

  let recency = 0.5;
  if (lead.posted_at) {
    const age = (Date.now() - Date.parse(lead.posted_at)) / 86400000;
    recency = age <= 7 ? 1 : age <= 14 ? 0.7 : 0.3;
  }

  return Math.round(40 * titleFit + 30 * kwFit + 20 * locFit + 10 * recency);
}

/** Score, filter, dedupe against seen ids, sort, cap. */
export function selectLeads(rawLeads, config, seenIds) {
  const seen = new Set(seenIds);
  const byUrl = new Map();
  for (const lead of rawLeads) {
    if (!lead.url || !lead.title) continue;
    if (seen.has(lead.id) || byUrl.has(lead.url)) continue;
    const score = scoreLead(lead, config);
    if (score < (config.min_score ?? 35)) continue;
    byUrl.set(lead.url, { ...lead, score });
  }
  return [...byUrl.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, config.max_leads ?? 20);
}
