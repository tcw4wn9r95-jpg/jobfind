import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { uploadCvToDrive } from "@/lib/drive";

export const dynamic = "force-dynamic";

/** Upload (or re-upload) a stored CV version to Google Drive. */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string; cvId: string } }
) {
  const db = getDb();
  const cv = db
    .prepare("SELECT * FROM tailored_cvs WHERE id = ? AND job_id = ?")
    .get(params.cvId, params.id) as any;
  if (!cv) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(params.id) as any;
  try {
    const { fileId, link } = await uploadCvToDrive(
      `CV — ${job.title || "role"} @ ${job.company || "company"} (v${cv.version})`,
      cv.content
    );
    db.prepare(
      "UPDATE tailored_cvs SET drive_file_id = ?, drive_link = ? WHERE id = ?"
    ).run(fileId, link, cv.id);
    return NextResponse.json({ fileId, link });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
