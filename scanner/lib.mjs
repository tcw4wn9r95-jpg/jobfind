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

const ACRONYMS = { us: "US", usa: "USA", uk: "UK", eu: "EU", uae: "UAE", apac: "APAC", nyc: "NYC", sf: "SF" };
const NEIGHBOR_LABEL = (c) =>
  c
    .trim()
    .split(/\s+/)
    .map((w) => ACRONYMS[w.toLowerCase()] ?? w.replace(/\b\w/, (ch) => ch.toUpperCase()))
    .join(" ");

const EU_WIDE_MARKERS = [
  "eu-wide", "eu wide", "within the eu", "across the eu", "anywhere in europe",
  "remote europe", "remote (eu)", "remote - eu", "remote, eu", "europe-wide",
  "european union", "emea", "eea", "schengen", "benelux",
];
const WORLDWIDE_MARKERS = [
  "worldwide", "anywhere", "global", "any location", "unrestricted", "location agnostic",
];

// Explicit non-EU markers — checked ONLY against the structured location
// FIELD (ATS-populated, e.g. "Remote (US)"), never the free-text snippet.
// A job's description almost always mentions countries that have nothing to
// do with this role's eligibility (a "Global Transformation Team" name, "the
// world's largest networks", references to other offices) — matching those
// produced false positives. Snippet-based restriction detection is handled
// separately by RESTRICTION_PATTERNS, which requires specific residency
// phrasing instead of a bare word match.
const NON_EU_MARKERS = [
  "united states", "usa", "u.s.a", "u.s.", "us only", "us-based", "us citizens",
  "(us)", "- us)", " us)", "us timezone", "us time zone", "pst/est", "est/pst",
  "united kingdom", "uk only", "uk-based", "(uk)",
  "canada", "australia", "new zealand",
  "india", "latam", "latin america", "brazil", "mexico", "argentina", "colombia", "chile",
  "apac", "asia pacific", "singapore", "japan", "china", "hong kong", "philippines",
  "vietnam", "indonesia", "south africa", "nigeria", "middle east", "uae", "israel",
  // Job boards frequently write "Remote, <City>" with no country name at all
  // (confirmed in production: a GitLab posting listed "Remote, Bangalore" and
  // fell through to "uncertain" instead of being excluded). Major non-EU hub
  // cities close that gap; EU cities are deliberately absent — the neighbor/
  // eu tiers already handle those.
  "bangalore", "bengaluru", "mumbai", "delhi", "new delhi", "hyderabad", "pune",
  "chennai", "gurugram", "gurgaon", "noida",
  "beijing", "shanghai", "shenzhen", "guangzhou", "hong kong",
  "tokyo", "osaka", "seoul",
  "toronto", "vancouver", "montreal",
  "san francisco", "new york", "seattle", "austin", "chicago", "boston", "los angeles",
  "sao paulo", "são paulo", "mexico city", "buenos aires",
  "london", "manchester", "edinburgh",
  "sydney", "melbourne", "brisbane", "auckland",
  "lagos", "nairobi", "cairo", "dubai", "tel aviv", "johannesburg",
  "manila", "jakarta", "ho chi minh", "bangkok",
  "thailand", "north america",
];

// Short, ambiguous country/city codes ("US", "UK", "NYC", "SF") that are
// only safe to match as a whole word, not a substring — plain .includes()
// would false-positive on "focus"/"campus"/"status" etc. Field-only, same
// as NON_EU_MARKERS above. Confirmed necessary in production: "Remote, US",
// "US Remote" and "SF, SEA, NYC, Remote" all fell through to "uncertain"
// because the longer-phrase list only matched formats like "us-based" or
// "(us)", never a bare "US" field — which turned out to be the single most
// common real-world pattern.
const NON_EU_SHORT_CODES = ["us", "usa", "uk", "nyc", "sf"];
function findShortCode(haystack, codes) {
  for (const c of codes) {
    if (new RegExp(`\\b${c}\\b`, "i").test(haystack)) return c;
  }
  return null;
}

// Phrases that name a residency/work-authorization requirement explicitly.
// The captured place is then checked against home/commutable/EU-wide.
const RESTRICTION_PATTERNS = [
  /(?:must|need to)\s+be\s+(?:based|located|residing|a resident)\s+in\s+([a-z][a-z .]{2,40})/i,
  /(?:candidates?|applicants?)\s+must\s+(?:be\s+)?(?:based|located|reside)\s+in\s+([a-z][a-z .]{2,40})/i,
  /authoriz(?:ed|ation)\s+to\s+work\s+in\s+(?:the\s+)?([a-z][a-z .]{2,40})/i,
  /open\s+only\s+to\s+(?:candidates|residents)\s+(?:based\s+|located\s+)?in\s+([a-z][a-z .]{2,40})/i,
];

function findMarker(haystack, markers) {
  return markers.find((m) => haystack.includes(m)) ?? null;
}

// Country names that, if the ONLY location signal on an otherwise-remote
// posting, get a clearer "verify" label than the generic one — e.g.
// "Remote, Germany" becomes "Remote — Germany" rather than "region
// unclear". This is display-only; it never grants the neighbor tier
// (see classifyLocation step 3/4) because a country-scoped remote role
// commonly requires actual residency there for payroll/tax, not just
// proximity, so it's still just as unverified as any other bare remote.
const NAMED_COUNTRIES_FOR_LABEL = [
  "luxembourg", "belgium", "france", "germany", "netherlands", "spain", "italy",
  "austria", "poland", "portugal", "ireland", "switzerland", "sweden", "denmark", "finland",
];

// The restriction regexes' capture groups are deliberately loose (so they
// catch "India", "the United States", "South Africa" alike); this trims a
// raw capture down to just the place name for display, e.g. "india for
// this position" -> "India". Only affects the label shown to the user —
// the eligibility check above uses the untrimmed capture.
const PLACE_STOPWORDS = new Set([
  "for", "and", "to", "on", "with", "the", "a", "an", "this", "that",
  "position", "role", "job", "team", "only", "unless", "work", "our", "from",
]);
function trimPlace(raw) {
  const words = [];
  for (const w of raw.trim().split(/\s+/)) {
    const clean = w.replace(/[.,;:]+$/, "");
    if (PLACE_STOPWORDS.has(clean.toLowerCase()) || words.length >= 3) break;
    words.push(clean);
  }
  return words.join(" ") || raw.trim();
}

/**
 * Classify a lead's geographic fit for a candidate based in `prefs.home`
 * who can also reach `prefs.commutable_areas` — actual towns within daily
 * commuting range, NOT whole countries. Luxembourg's real commuter belt is
 * a handful of border towns (Thionville, Trier, Arlon…); an on-site role in
 * Paris, Munich or Cologne is in the "right" country but hundreds of
 * kilometres away and not commutable "for everyday" — treating the whole
 * country as commutable was the bug. Returns a tier used both for hard
 * filtering (scoreLead) and for a human-readable chip in the UI, so the
 * reasoning is visible, not just the exclusion.
 */
export function classifyLocation(lead, prefs = {}) {
  const home = (prefs.home ?? "").toLowerCase();
  const commutableAreas = (prefs.commutable_areas ?? []).map((c) => c.toLowerCase());
  const field = (lead.location ?? "").toLowerCase();
  const snippet = (lead.snippet ?? "").toLowerCase();

  // 1. Structured field says an explicit non-EU location — authoritative.
  const nonEu = findMarker(field, NON_EU_MARKERS) || findShortCode(field, NON_EU_SHORT_CODES);
  if (nonEu) {
    return { tier: "restricted", fit: 0, label: `${NEIGHBOR_LABEL(nonEu.replace(/[()]/g, ""))} only` };
  }
  // 2. A specific residency/work-authorization phrase in the description —
  //    precise grammatical patterns only, so generic mentions of a country
  //    elsewhere in the text (a team name, a stat, another office) can't
  //    trigger this by accident.
  for (const pattern of RESTRICTION_PATTERNS) {
    const m = snippet.match(pattern);
    if (!m) continue;
    const place = m[1].trim().toLowerCase();
    const ok =
      (home && place.includes(home)) ||
      commutableAreas.some((c) => place.includes(c)) ||
      EU_WIDE_MARKERS.some((e) => place.includes(e));
    if (!ok) {
      return { tier: "restricted", fit: 0, label: `${NEIGHBOR_LABEL(trimPlace(m[1]))} only` };
    }
  }

  // 3. Home / commutable town — field ONLY, same reasoning as step 4 below.
  //    A snippet fallback here caused real false positives: a Stripe role
  //    actually based in "NYC-Privy" was tagged "Perl (commutable)" because
  //    its description mentioned the Perl programming language, and a
  //    Berlin role was tagged "Konz (commutable)" because its German text
  //    said "Konzepte" (concepts) — "konz" is just a common word stem, not
  //    a low-false-positive proper noun as assumed. Whole-country mentions
  //    are deliberately NOT matched here either — see step 4/5.
  if (home && field.includes(home)) {
    return { tier: "home", fit: 1, label: NEIGHBOR_LABEL(prefs.home) };
  }
  const town = findMarker(field, commutableAreas);
  if (town) {
    return { tier: "neighbor", fit: 0.85, label: `${NEIGHBOR_LABEL(town)} (commutable)` };
  }

  // 4. EU-wide / worldwide remote — trust ONLY the structured location
  //    field for this. Snippet boilerplate ("global network", "EMEA sales
  //    team", "the world's largest…") describes the COMPANY, not this
  //    role's eligibility, and produced false positives: a hybrid NYC/SF
  //    role was tagged "worldwide" purely because its snippet mentioned a
  //    "Global Transformation Team".
  if (prefs.eu_wide_remote_ok !== false && findMarker(field, EU_WIDE_MARKERS)) {
    return { tier: "eu", fit: 0.75, label: "Remote — EU-wide" };
  }
  if (prefs.worldwide_remote_ok !== false && findMarker(field, WORLDWIDE_MARKERS)) {
    return { tier: "worldwide", fit: 0.7, label: "Remote — worldwide" };
  }
  // 5. Bare "remote", possibly with a country name attached (e.g. "Remote,
  //    Germany"). A country-scoped remote role usually still requires
  //    actual residency in that country for payroll/tax — being 30 minutes
  //    from the border doesn't satisfy that — so this stays "uncertain",
  //    just with a clearer label naming what to verify.
  if (field.includes("remote")) {
    const country = findMarker(field, NAMED_COUNTRIES_FOR_LABEL);
    return country
      ? { tier: "uncertain", fit: 0.35, label: `Remote — ${NEIGHBOR_LABEL(country)}, verify it covers Luxembourg` }
      : { tier: "uncertain", fit: 0.35, label: "Remote — region unclear, verify" };
  }
  return { tier: "other", fit: 0, label: lead.location || "Location unclear" };
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
 * Heuristic 0–100 score: 35 title fit, 20 keyword hits, 35 location fit,
 * 10 recency. Hard exclusions (wrong seniority, stale, explicit
 * non-EU/non-Luxembourg restriction, or — unless strict_location is
 * disabled — an unmatched location with no remote/EU signal at all)
 * return -1.
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

  const loc = classifyLocation(lead, config.location_preferences ?? {});
  if (loc.tier === "restricted") return -1;
  if (config.strict_location !== false && loc.tier === "other") return -1;

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

  let recency = 0.5;
  if (lead.posted_at) {
    const age = (Date.now() - Date.parse(lead.posted_at)) / 86400000;
    recency = age <= 7 ? 1 : age <= 14 ? 0.7 : 0.3;
  }

  return Math.round(35 * titleFit + 20 * kwFit + 35 * loc.fit + 10 * recency);
}

/** Score, filter, dedupe against seen ids, sort, cap. Attaches the
 *  location tier/label so the UI can show why a lead was included. */
export function selectLeads(rawLeads, config, seenIds) {
  const seen = new Set(seenIds);
  const byUrl = new Map();
  for (const lead of rawLeads) {
    if (!lead.url || !lead.title) continue;
    if (seen.has(lead.id) || byUrl.has(lead.url)) continue;
    const score = scoreLead(lead, config);
    if (score < (config.min_score ?? 35)) continue;
    const loc = classifyLocation(lead, config.location_preferences ?? {});
    byUrl.set(lead.url, {
      ...lead,
      score,
      location_tier: loc.tier,
      location_note: loc.label,
    });
  }
  return [...byUrl.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, config.max_leads ?? 20);
}
