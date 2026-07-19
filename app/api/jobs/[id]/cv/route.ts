import { NextRequest, NextResponse } from "next/server";
import { getDb, profileContextAsText, touchJob } from "@/lib/db";
import { askClaude } from "@/lib/claude";
import { CV_GENERATION_SYSTEM } from "@/lib/prompts";
import { driveConfigured, uploadCvToDrive } from "@/lib/drive";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

/** Generate a tailored CV for this job (a new version each time). */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = getDb();
  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(params.id) as any;
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const content = await askClaude({
      system: CV_GENERATION_SYSTEM,
      maxTokens: 8000,
      messages: [
        {
          role: "user",
          content: `${profileContextAsText()}\n\n=====\n\nTARGET JOB (${job.title} at ${job.company}):\n${job.description.slice(0, 30000)}\n\nMATCH ANALYSIS (use the keywords/recommendations to guide emphasis — truthfully):\n${job.analysis ?? "n/a"}`,
        },
      ],
    });
    const cleaned = content.replace(/^```(?:markdown|md)?\n?|```\s*$/g, "").trim();
    const { maxV } = db
      .prepare(
        "SELECT COALESCE(MAX(version), 0) AS maxV FROM tailored_cvs WHERE job_id = ?"
      )
      .get(params.id) as { maxV: number };
    const info = db
      .prepare(
        "INSERT INTO tailored_cvs (job_id, version, content) VALUES (?, ?, ?)"
      )
      .run(params.id, maxV + 1, cleaned);
    touchJob(Number(params.id));

    const cv = db
      .prepare("SELECT * FROM tailored_cvs WHERE id = ?")
      .get(info.lastInsertRowid) as any;

    // Best-effort Drive upload when configured; the CV is saved locally regardless
    let driveError: string | null = null;
    if (driveConfigured()) {
      try {
        const { fileId, link } = await uploadCvToDrive(
          `CV — ${job.title || "role"} @ ${job.company || "company"} (v${cv.version})`,
          cleaned
        );
        db.prepare(
          "UPDATE tailored_cvs SET drive_file_id = ?, drive_link = ? WHERE id = ?"
        ).run(fileId, link, cv.id);
        cv.drive_file_id = fileId;
        cv.drive_link = link;
      } catch (e: any) {
        driveError = e.message;
      }
    }
    return NextResponse.json({ cv, driveError });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
