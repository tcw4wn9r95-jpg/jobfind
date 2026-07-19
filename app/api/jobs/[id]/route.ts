import { NextRequest, NextResponse } from "next/server";
import { getDb, JOB_STATUSES } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = getDb();
  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(params.id);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const cvs = db
    .prepare("SELECT * FROM tailored_cvs WHERE job_id = ? ORDER BY version DESC")
    .all(params.id);
  const messages = db
    .prepare("SELECT * FROM chat_messages WHERE job_id = ? ORDER BY id")
    .all(params.id);
  const interactions = db
    .prepare(
      `SELECT i.*, c.name AS contact_name FROM interactions i
       LEFT JOIN contacts c ON c.id = i.contact_id
       WHERE i.job_id = ? ORDER BY i.happened_at DESC, i.id DESC`
    )
    .all(params.id);
  const contacts = db
    .prepare("SELECT * FROM contacts WHERE job_id = ? ORDER BY id")
    .all(params.id);
  return NextResponse.json({ job, cvs, messages, interactions, contacts });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const db = getDb();
  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(params.id) as any;
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const fields: string[] = [];
  const values: unknown[] = [];
  for (const key of ["title", "company", "location", "notes", "next_follow_up", "url"]) {
    if (key in body) {
      fields.push(`${key} = ?`);
      values.push(body[key] ?? "");
    }
  }
  if ("status" in body) {
    if (!JOB_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    fields.push("status = ?");
    values.push(body.status);
    if (body.status === "applied" && !job.applied_at) {
      fields.push("applied_at = datetime('now')");
    }
  }
  if (!fields.length) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }
  fields.push("updated_at = datetime('now')");
  db.prepare(`UPDATE jobs SET ${fields.join(", ")} WHERE id = ?`).run(
    ...values,
    params.id
  );
  return NextResponse.json({
    job: db.prepare("SELECT * FROM jobs WHERE id = ?").get(params.id),
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  getDb().prepare("DELETE FROM jobs WHERE id = ?").run(params.id);
  return NextResponse.json({ ok: true });
}
