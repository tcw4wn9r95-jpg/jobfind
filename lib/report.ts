// Short, shareable match reports.
//
// There is no server, so a shared report cannot live behind a URL the app
// looks up — the whole report travels INSIDE the link, in the fragment
// (after the #). Fragments are never sent to the host, so publishing a
// report to GitHub Pages uploads nothing: the recipient's browser decodes
// the payload locally. The trade-off is the one every capability-URL has —
// whoever holds the link can read the report — which the share UI states
// plainly.
//
// Wire format is a positional array so the link stays short:
//   [1, score, title, company, location, verdict, strengths, gaps, actions,
//    person, created]
// gzip-compressed where the browser supports it, then base64url.

export type MatchReport = {
  /** Who the report is about. Empty for the owner's own match. */
  person: string;
  title: string;
  company: string;
  location: string;
  score: number;
  verdict: string;
  strengths: string[];
  gaps: string[];
  actions: string[];
  /** YYYY-MM-DD, so a stale report is obvious. */
  created: string;
};

const WIRE_VERSION = 1;

/** Keep links short enough to paste into a message. */
const MAX_ITEMS = 3;
const MAX_ITEM_CHARS = 220;
const MAX_VERDICT_CHARS = 400;

function trim(s: unknown, max: number): string {
  const text = String(s ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  // Cut at a word boundary rather than mid-word.
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return (space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd() + "…";
}

function trimList(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  return items
    .slice(0, MAX_ITEMS)
    .map((i) => trim(i, MAX_ITEM_CHARS))
    .filter(Boolean);
}

/**
 * Build the short report from a stored match analysis. Only the summary
 * travels — never the CV, the full job description or the chat history.
 */
export function buildReport(input: {
  person?: string;
  title?: string;
  company?: string;
  location?: string;
  score?: number | null;
  analysis: any;
  created?: string;
}): MatchReport {
  const a = input.analysis ?? {};
  return {
    person: trim(input.person, 80),
    title: trim(input.title || a.title, 120) || "Untitled role",
    company: trim(input.company || a.company, 120),
    location: trim(input.location || a.location, 120),
    score: Math.max(0, Math.min(100, Math.round(Number(input.score ?? a.score ?? 0)) || 0)),
    verdict: trim(a.verdict, MAX_VERDICT_CHARS),
    strengths: trimList(a.strengths),
    gaps: trimList(a.gaps),
    actions: trimList(a.recommendations),
    created: input.created || new Date().toISOString().slice(0, 10),
  };
}

/** Plain-text version, for pasting into a message or email. */
export function reportToText(r: MatchReport, link?: string): string {
  const lines: string[] = [];
  const who = r.person ? `${r.person} — ` : "";
  lines.push(`${who}${r.title}${r.company ? ` at ${r.company}` : ""}`);
  if (r.location) lines.push(r.location);
  lines.push("");
  lines.push(`Match score: ${r.score}/100`);
  if (r.verdict) lines.push(r.verdict);
  const section = (title: string, items: string[], marker: string) => {
    if (!items.length) return;
    lines.push("", title);
    for (const i of items) lines.push(`${marker} ${i}`);
  };
  section(r.person ? "Why they fit" : "Why I fit", r.strengths, "+");
  section("Gaps to address", r.gaps, "!");
  section("Next steps", r.actions, "→");
  lines.push("", `Match report · ${r.created}`);
  if (link) lines.push(link);
  return lines.join("\n");
}

// --- link encoding ----------------------------------------------------------

function toWire(r: MatchReport): unknown[] {
  return [
    WIRE_VERSION,
    r.score,
    r.title,
    r.company,
    r.location,
    r.verdict,
    r.strengths,
    r.gaps,
    r.actions,
    r.person,
    r.created,
  ];
}

function fromWire(wire: unknown): MatchReport | null {
  if (!Array.isArray(wire) || wire[0] !== WIRE_VERSION) return null;
  const [, score, title, company, location, verdict, strengths, gaps, actions, person, created] =
    wire;
  if (typeof title !== "string") return null;
  const list = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);
  return {
    score: Number(score) || 0,
    title,
    company: String(company ?? ""),
    location: String(location ?? ""),
    verdict: String(verdict ?? ""),
    strengths: list(strengths),
    gaps: list(gaps),
    actions: list(actions),
    person: String(person ?? ""),
    created: String(created ?? ""),
  };
}

function b64urlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(text: string): Uint8Array {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function gzip(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === "undefined") return null;
  try {
    const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream("gzip"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null;
  }
}

async function gunzip(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof DecompressionStream === "undefined") return null;
  try {
    const stream = new Blob([bytes as BlobPart])
      .stream()
      .pipeThrough(new DecompressionStream("gzip"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * Encode a report into a URL-fragment token. Prefixed "z" when gzipped and
 * "p" when stored plain, so an old link stays readable if compression
 * support changes under it.
 */
export async function encodeReport(r: MatchReport): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(toWire(r)));
  const packed = await gzip(json);
  return packed ? `z${b64urlEncode(packed)}` : `p${b64urlEncode(json)}`;
}

export async function decodeReport(token: string): Promise<MatchReport | null> {
  const trimmed = (token ?? "").replace(/^#/, "").trim();
  if (trimmed.length < 2) return null;
  try {
    const bytes = b64urlDecode(trimmed.slice(1));
    const json =
      trimmed[0] === "z" ? await gunzip(bytes) : trimmed[0] === "p" ? bytes : null;
    if (!json) return null;
    return fromWire(JSON.parse(new TextDecoder().decode(json)));
  } catch {
    return null;
  }
}

/** Absolute link to the standalone report page, payload in the fragment. */
export function reportUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}${base}/report/#${token}`;
}
