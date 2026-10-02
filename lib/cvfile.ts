// Read the text out of an uploaded CV, entirely in the browser.
//
// The file never leaves the device: .docx is unzipped and walked locally,
// PDF is parsed by pdf.js (loaded on demand, so it costs nothing until
// someone actually uploads a PDF). Whatever comes out lands in an editable
// textarea, so a bad extraction is visible and fixable — and every failure
// message points at the paste fallback.

export const CV_FILE_ACCEPT =
  ".docx,.pdf,.txt,.md,.markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain";

const MAX_BYTES = 10 * 1024 * 1024;
const MIN_CHARS = 50;

export class CvFileError extends Error {}

export type CvFileResult = {
  text: string;
  /** Short human summary for the UI, e.g. "2 pages". */
  detail: string;
};

export async function extractCvText(file: File): Promise<CvFileResult> {
  if (file.size > MAX_BYTES) {
    throw new CvFileError("That file is over 10 MB — too big to be a CV.");
  }
  const name = file.name.toLowerCase();
  const type = file.type;

  let result: CvFileResult;
  if (name.endsWith(".docx") || type.includes("wordprocessingml")) {
    result = await readDocx(file);
  } else if (name.endsWith(".pdf") || type === "application/pdf") {
    result = await readPdf(file);
  } else if (name.endsWith(".doc")) {
    throw new CvFileError(
      "Old .doc files can't be read here. Save it as .docx or PDF and upload that."
    );
  } else if (/\.(txt|md|markdown)$/.test(name) || type.startsWith("text/")) {
    result = { text: await file.text(), detail: "text file" };
  } else {
    throw new CvFileError("That file type isn't supported — use .docx, .pdf or .txt.");
  }

  const text = tidy(result.text);
  if (text.length < MIN_CHARS) {
    throw new CvFileError(
      name.endsWith(".pdf")
        ? "That PDF has no readable text — it's probably a scanned image."
        : "I couldn't find any readable text in that file."
    );
  }
  return { ...result, text };
}

/** Collapse the whitespace noise extraction leaves behind. */
function tidy(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t ]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// --- .docx ------------------------------------------------------------------

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

async function readDocx(file: File): Promise<CvFileResult> {
  const { default: JSZip } = await import("jszip");
  let zip;
  try {
    zip = await JSZip.loadAsync(await file.arrayBuffer());
  } catch {
    throw new CvFileError("That doesn't look like a valid .docx file.");
  }

  const body = zip.file("word/document.xml");
  if (!body) throw new CvFileError("That doesn't look like a valid .docx file.");

  // Hyperlink targets live in a separate relationships part. A LinkedIn link
  // is frequently ONLY there — the visible text just says "LinkedIn" — so
  // without this the profile URL would silently disappear.
  const rels = await relationshipTargets(zip, "word/_rels/document.xml.rels");
  const parts: string[] = [];

  // Contact details often sit in the page header rather than the body.
  const headers = Object.keys(zip.files)
    .filter((n) => /^word\/header\d*\.xml$/.test(n))
    .sort();
  for (const h of headers) {
    const headerRels = await relationshipTargets(zip, h.replace("word/", "word/_rels/") + ".rels");
    const text = docxText(await zip.file(h)!.async("string"), headerRels);
    if (text.trim()) parts.push(text);
  }
  parts.push(docxText(await body.async("string"), rels));

  return { text: parts.join("\n"), detail: "Word document" };
}

async function relationshipTargets(
  zip: { file(name: string): { async(t: "string"): Promise<string> } | null },
  path: string
): Promise<Record<string, string>> {
  const entry = zip.file(path);
  if (!entry) return {};
  const doc = new DOMParser().parseFromString(await entry.async("string"), "application/xml");
  const out: Record<string, string> = {};
  for (const rel of Array.from(doc.getElementsByTagName("Relationship"))) {
    const id = rel.getAttribute("Id");
    const target = rel.getAttribute("Target");
    if (id && target && rel.getAttribute("TargetMode") === "External") out[id] = target;
  }
  return out;
}

function docxText(xml: string, links: Record<string, string>): string {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) return "";
  const lines: string[] = [];

  const walk = (node: Element, out: string[]) => {
    for (const child of Array.from(node.children)) {
      const tag = child.localName;
      // Word stores text boxes twice (Choice + Fallback); read only one copy.
      if (tag === "Fallback") continue;
      if (tag === "t") out.push(child.textContent ?? "");
      else if (tag === "tab") out.push("\t");
      else if (tag === "br" || tag === "cr") out.push("\n");
      else if (tag === "hyperlink") {
        const inner: string[] = [];
        walk(child, inner);
        const visible = inner.join("");
        out.push(visible);
        const id = child.getAttributeNS(R_NS, "id");
        const target = id ? links[id] : undefined;
        if (target) {
          const shown = target.replace(/^mailto:/i, "");
          // Only add what the reader couldn't already see.
          if (!visible.includes(shown) && !visible.includes(shown.replace(/^https?:\/\//, ""))) {
            out.push(` ${shown}`);
          }
        }
      } else walk(child, out);
    }
  };

  for (const p of Array.from(doc.getElementsByTagNameNS(W_NS, "p"))) {
    // Skip a paragraph nested in a Fallback copy of a text box.
    let skip = false;
    for (let a: Element | null = p.parentElement; a; a = a.parentElement) {
      if (a.localName === "Fallback") skip = true;
    }
    if (skip) continue;
    const out: string[] = [];
    walk(p, out);
    lines.push(out.join(""));
  }
  return lines.join("\n");
}

// --- PDF --------------------------------------------------------------------

async function readPdf(file: File): Promise<CvFileResult> {
  // The legacy build runs on older mobile browsers that lack newer JS APIs.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Served as a static file (see scripts/copy-pdf-worker.mjs), not bundled.
  pdfjs.GlobalWorkerOptions.workerSrc = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/pdf.worker.min.js`;

  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  let pdf;
  try {
    pdf = await task.promise;
  } catch (e: any) {
    if (e?.name === "PasswordException") {
      throw new CvFileError("That PDF is password-protected. Remove the password or paste the text.");
    }
    throw new CvFileError("That doesn't look like a valid PDF.");
  }

  const pages: string[] = [];
  const urls: string[] = [];
  try {
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      let text = "";
      for (const item of content.items as any[]) {
        if (typeof item.str !== "string") continue;
        text += item.str;
        text += item.hasEOL ? "\n" : "";
      }
      pages.push(text);
      // As with .docx, a "LinkedIn" label usually hides the real URL in a
      // link annotation rather than in the text.
      for (const a of (await page.getAnnotations()) as any[]) {
        if (a.subtype === "Link" && typeof a.url === "string") urls.push(a.url);
      }
    }
  } finally {
    // Frees the worker; without it each upload would leave one running.
    await task.destroy();
  }

  let text = pages.join("\n\n");
  const hidden = Array.from(new Set(urls)).filter(
    (u) => !text.includes(u.replace(/^(https?:\/\/|mailto:)/i, ""))
  );
  if (hidden.length) text += "\n\n" + hidden.map((u) => u.replace(/^mailto:/i, "")).join("\n");
  return { text, detail: `${pdf.numPages} page${pdf.numPages === 1 ? "" : "s"}` };
}
