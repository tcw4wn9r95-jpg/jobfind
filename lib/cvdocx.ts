import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";

/**
 * Convert the Markdown CV Claude produces (headings, bullets, bold) into a
 * .docx file. Handles the subset of Markdown the CV prompt asks for.
 */
export async function markdownCvToDocx(markdown: string): Promise<Buffer> {
  const paragraphs: Paragraph[] = [];
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      paragraphs.push(new Paragraph({ spacing: { after: 60 } }));
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      paragraphs.push(
        new Paragraph({
          heading:
            level === 1
              ? HeadingLevel.HEADING_1
              : level === 2
                ? HeadingLevel.HEADING_2
                : HeadingLevel.HEADING_3,
          alignment: level === 1 ? AlignmentType.CENTER : AlignmentType.LEFT,
          children: inlineRuns(h[2]),
          spacing: { before: level === 1 ? 0 : 200, after: 100 },
        })
      );
      continue;
    }
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (bullet) {
      paragraphs.push(
        new Paragraph({
          children: inlineRuns(bullet[1]),
          bullet: { level: 0 },
          spacing: { after: 40 },
        })
      );
      continue;
    }
    if (/^(---|\*\*\*|___)\s*$/.test(line)) {
      paragraphs.push(
        new Paragraph({ border: { bottom: { style: "single" as any, size: 6, color: "999999", space: 1 } } })
      );
      continue;
    }
    paragraphs.push(
      new Paragraph({ children: inlineRuns(line), spacing: { after: 60 } })
    );
  }

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: "Calibri", size: 21 } },
        heading1: { run: { font: "Calibri", size: 32, bold: true, color: "1a1a2e" } },
        heading2: {
          run: { font: "Calibri", size: 24, bold: true, color: "3730a3" },
        },
        heading3: { run: { font: "Calibri", size: 22, bold: true, color: "1a1a2e" } },
      },
    },
    sections: [{ children: paragraphs }],
  });
  return Packer.toBuffer(doc);
}

/** Split "text **bold** *italic*" into styled runs. */
function inlineRuns(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);
  for (const part of parts) {
    if (part.startsWith("**") && part.endsWith("**")) {
      runs.push(new TextRun({ text: part.slice(2, -2), bold: true }));
    } else if (part.startsWith("*") && part.endsWith("*")) {
      runs.push(new TextRun({ text: part.slice(1, -1), italics: true }));
    } else {
      runs.push(new TextRun({ text: part }));
    }
  }
  return runs;
}
