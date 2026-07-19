import { NextRequest, NextResponse } from "next/server";
import { getDb, profileContextAsText, touchJob } from "@/lib/db";
import { askClaude } from "@/lib/claude";
import { CHAT_SYSTEM_PREFIX } from "@/lib/prompts";
import { driveConfigured, uploadCvToDrive } from "@/lib/drive";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

/**
 * Per-job Claude chat. If Claude replies with a ```cv fenced block, that block
 * is saved as a new tailored CV version (and synced to Drive when configured).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { message } = await req.json();
  if (!message?.trim()) {
    return NextResponse.json({ error: "Empty message" }, { status: 400 });
  }
  const db = getDb();
  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(params.id) as any;
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const latestCv = db
    .prepare(
      "SELECT * FROM tailored_cvs WHERE job_id = ? ORDER BY version DESC LIMIT 1"
    )
    .get(params.id) as any;
  const history = db
    .prepare(
      "SELECT role, content FROM chat_messages WHERE job_id = ? ORDER BY id DESC LIMIT 30"
    )
    .all(params.id)
    .reverse() as { role: "user" | "assistant"; content: string }[];

  const system = `${CHAT_SYSTEM_PREFIX}

CANDIDATE PROFILE:
${profileContextAsText().slice(0, 25000)}

JOB: ${job.title} at ${job.company} (status: ${job.status}, match score: ${job.score ?? "n/a"})
JOB DESCRIPTION:
${job.description.slice(0, 15000)}

MATCH ANALYSIS: ${job.analysis ?? "not analysed yet"}

${latestCv ? `CURRENT TAILORED CV (v${latestCv.version}):\n${latestCv.content}` : "No tailored CV generated yet."}`;

  db.prepare(
    "INSERT INTO chat_messages (job_id, role, content) VALUES (?, 'user', ?)"
  ).run(params.id, message);

  try {
    const reply = await askClaude({
      system,
      maxTokens: 8000,
      messages: [...history, { role: "user", content: message }],
    });
    db.prepare(
      "INSERT INTO chat_messages (job_id, role, content) VALUES (?, 'assistant', ?)"
    ).run(params.id, reply);
    touchJob(Number(params.id));

    // Persist any revised CV Claude produced
    let newCv: any = null;
    let driveError: string | null = null;
    const cvMatch = reply.match(/```cv\n([\s\S]*?)```/);
    if (cvMatch && cvMatch[1].trim().length > 100) {
      const content = cvMatch[1].trim();
      const { maxV } = db
        .prepare(
          "SELECT COALESCE(MAX(version), 0) AS maxV FROM tailored_cvs WHERE job_id = ?"
        )
        .get(params.id) as { maxV: number };
      const info = db
        .prepare(
          "INSERT INTO tailored_cvs (job_id, version, content) VALUES (?, ?, ?)"
        )
        .run(params.id, maxV + 1, content);
      newCv = db
        .prepare("SELECT * FROM tailored_cvs WHERE id = ?")
        .get(info.lastInsertRowid);
      if (driveConfigured()) {
        try {
          const { fileId, link } = await uploadCvToDrive(
            `CV — ${job.title || "role"} @ ${job.company || "company"} (v${newCv.version})`,
            content
          );
          db.prepare(
            "UPDATE tailored_cvs SET drive_file_id = ?, drive_link = ? WHERE id = ?"
          ).run(fileId, link, newCv.id);
          newCv.drive_file_id = fileId;
          newCv.drive_link = link;
        } catch (e: any) {
          driveError = e.message;
        }
      }
    }
    return NextResponse.json({ reply, newCv, driveError });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
