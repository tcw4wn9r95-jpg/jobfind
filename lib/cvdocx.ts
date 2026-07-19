import {
  AlignmentType,
  BorderStyle,
  Document,
  LevelFormat,
  Packer,
  Paragraph,
  Tab,
  TabStopType,
  TextRun,
} from "docx";
import { CvData, cvToText, parseCv } from "./cvschema";

// Faithful reproduction of the reference template (CV_Diego_Casares_2026.docx):
// A4, 1.5cm margins, Calibri, navy #1f3a5f accents, small-caps section headings
// with a bottom rule, right-tabbed role/date lines, 220-twip hanging bullets.
// Deliberately ATS-safe: single column, no tables/text boxes/images, standard
// section names, plain • bullets.

const NAVY = "1F3A5F";
const GRAY = "555555";
const BULLET_REF = "cv-bullets";

const base = { font: "Calibri" };

function heading(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { before: 140, after: 60 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: NAVY, space: 2 },
    },
    children: [
      new TextRun({
        ...base,
        text: text.toUpperCase(),
        bold: true,
        smallCaps: true,
        color: NAVY,
        size: 22,
      }),
    ],
  });
}

/** "text with **bold** parts" → runs; all runs get `props`. */
function inlineRuns(text: string, props: Record<string, unknown> = {}): TextRun[] {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((part) =>
      part.startsWith("**") && part.endsWith("**")
        ? new TextRun({ ...base, size: 20, ...props, text: part.slice(2, -2), bold: true })
        : new TextRun({ ...base, size: 20, ...props, text: part })
    );
}

function bullet(children: TextRun[]): Paragraph {
  return new Paragraph({
    numbering: { reference: BULLET_REF, level: 0 },
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 30 },
    children,
  });
}

export function buildTemplateDocx(cv: CvData): Document {
  const children: Paragraph[] = [];

  // Name + contact line, centered
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [
        new TextRun({ ...base, text: cv.name, bold: true, color: NAVY, size: 36 }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [
        new TextRun({ ...base, text: "Email: ", size: 18 }),
        new TextRun({ ...base, text: cv.email, size: 18, color: NAVY, underline: {} }),
        new TextRun({ ...base, text: `  |  Tel: ${cv.phone}  |  LinkedIn: `, size: 18 }),
        new TextRun({ ...base, text: cv.linkedin, size: 18, color: NAVY, underline: {} }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 100 },
      children: inlineRuns(cv.summary),
    })
  );

  if (cv.competencies.length) {
    children.push(heading("Core Competencies"));
    for (const k of cv.competencies) {
      children.push(
        bullet([
          new TextRun({ ...base, text: `${k.label}: `, bold: true, size: 20 }),
          ...inlineRuns(k.text),
        ])
      );
    }
  }

  if (cv.experience.length) {
    children.push(heading("Professional Experience"));
    for (const e of cv.experience) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { before: 140, after: 20 },
          children: [
            new TextRun({ ...base, text: e.company, bold: true, color: NAVY, size: 23 }),
            ...(e.blurb
              ? [new TextRun({ ...base, text: `  — ${e.blurb}`, italics: true, color: GRAY, size: 17 })]
              : []),
          ],
        })
      );
      for (const r of e.roles) {
        children.push(
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { before: 80, after: 20 },
            tabStops: [{ type: TabStopType.RIGHT, position: 9920 }],
            children: [
              new TextRun({ ...base, text: r.title, bold: true, size: 21 }),
              new TextRun({
                ...base,
                children: [new Tab(), [r.location, r.dates].filter(Boolean).join(", ")],
                italics: true,
                size: 19,
              }),
            ],
          })
        );
        for (const b of r.bullets) children.push(bullet(inlineRuns(b)));
      }
    }
  }

  if (cv.education.length) {
    children.push(heading("Education"));
    for (const ed of cv.education) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 40 },
          children: [
            new TextRun({ ...base, text: ed.degree, bold: true, size: 20 }),
            new TextRun({ ...base, text: `  —  ${ed.institution}`, size: 20 }),
            ...(ed.note
              ? [new TextRun({ ...base, text: ` (${ed.note})`, italics: true, size: 20 })]
              : []),
            ...(ed.dates ? [new TextRun({ ...base, text: `  ·  ${ed.dates}`, size: 20 })] : []),
          ],
        })
      );
    }
    for (const n of cv.education_notes) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 40 },
          children: [new TextRun({ ...base, text: n, italics: true, size: 18 })],
        })
      );
    }
  }

  if (cv.certifications.length || cv.languages) {
    children.push(heading("Certifications & Languages"));
    for (const cert of cv.certifications) children.push(bullet(inlineRuns(cert)));
    if (cv.languages) {
      children.push(
        bullet([
          new TextRun({ ...base, text: "Languages: ", bold: true, size: 20 }),
          ...inlineRuns(cv.languages),
        ])
      );
    }
  }

  if (cv.leadership.length) {
    children.push(heading("Leadership & Volunteering"));
    for (const l of cv.leadership) children.push(bullet(inlineRuns(l)));
  }

  if (cv.interests) {
    children.push(
      heading("Personal Interests"),
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 40 },
        children: inlineRuns(cv.interests),
      })
    );
  }

  return new Document({
    styles: {
      default: { document: { run: { font: "Calibri", size: 20 } } },
    },
    numbering: {
      config: [
        {
          reference: BULLET_REF,
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              style: {
                paragraph: { indent: { left: 360, hanging: 220 } },
              },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 850, bottom: 850, left: 850, right: 850 },
          },
        },
        children,
      },
    ],
  });
}

/** Trigger a browser download of a stored CV (JSON template format or legacy Markdown). */
export async function downloadCv(
  content: string,
  company: string,
  version: number,
  format: "docx" | "md"
) {
  const base = `CV-${(company || "company").replace(/[^\w-]+/g, "_")}-v${version}`;
  const cv = parseCv(content);
  let blob: Blob;
  if (format === "docx") {
    const doc = cv ? buildTemplateDocx(cv) : legacyMarkdownDocx(content);
    blob = await Packer.toBlob(doc);
  } else {
    blob = new Blob([cv ? cvToText(cv) : content], { type: "text/markdown" });
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${base}.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Fallback for CV versions saved before the template format existed. */
function legacyMarkdownDocx(markdown: string): Document {
  const paragraphs: Paragraph[] = [];
  for (const rawLine of markdown.replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine.trimEnd();
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    const b = line.match(/^\s*[-*]\s+(.*)$/);
    if (h) {
      paragraphs.push(
        new Paragraph({
          spacing: { before: 160, after: 60 },
          children: [
            new TextRun({
              ...base,
              text: h[2].replace(/\*\*/g, ""),
              bold: true,
              size: h[1].length === 1 ? 32 : 22,
              color: h[1].length === 1 ? "000000" : NAVY,
            }),
          ],
          alignment: h[1].length === 1 ? AlignmentType.CENTER : AlignmentType.LEFT,
        })
      );
    } else if (b) {
      paragraphs.push(
        new Paragraph({
          numbering: { reference: BULLET_REF, level: 0 },
          spacing: { after: 30 },
          children: inlineRuns(b[1]),
        })
      );
    } else if (line.trim()) {
      paragraphs.push(
        new Paragraph({ spacing: { after: 60 }, children: inlineRuns(line) })
      );
    }
  }
  return new Document({
    styles: { default: { document: { run: { font: "Calibri", size: 20 } } } },
    numbering: {
      config: [
        {
          reference: BULLET_REF,
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              style: { paragraph: { indent: { left: 360, hanging: 220 } } },
            },
          ],
        },
      ],
    },
    sections: [{ children: paragraphs }],
  });
}
