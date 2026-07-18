import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { markdownCvToDocx } from "@/lib/cvdocx";

export const dynamic = "force-dynamic";

/** Download a stored CV version as .docx (default) or .md */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; cvId: string } }
) {
  const db = getDb();
  const cv = db
    .prepare("SELECT * FROM tailored_cvs WHERE id = ? AND job_id = ?")
    .get(params.cvId, params.id) as any;
  if (!cv) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(params.id) as any;

  const format = req.nextUrl.searchParams.get("format") ?? "docx";
  const base = `CV-${(job.company || "company").replace(/[^\w-]+/g, "_")}-v${cv.version}`;

  if (format === "md") {
    return new NextResponse(cv.content, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${base}.md"`,
      },
    });
  }
  const buffer = await markdownCvToDocx(cv.content);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${base}.docx"`,
    },
  });
}
