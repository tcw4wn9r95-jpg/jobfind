import { NextRequest, NextResponse } from "next/server";
import { getDb, touchJob } from "@/lib/db";

export const dynamic = "force-dynamic";

const TYPES = ["note", "meeting", "call", "email", "reply", "interview"];

export async function GET(req: NextRequest) {
  const db = getDb();
  const upcoming = req.nextUrl.searchParams.get("upcoming");
  if (upcoming) {
    const interactions = db
      .prepare(
        `SELECT i.*, c.name AS contact_name, j.title AS job_title, j.company AS job_company
         FROM interactions i
         LEFT JOIN contacts c ON c.id = i.contact_id
         LEFT JOIN jobs j ON j.id = i.job_id
         WHERE i.follow_up_date IS NOT NULL AND i.follow_up_done = 0
         ORDER BY i.follow_up_date`
      )
      .all();
    return NextResponse.json({ interactions });
  }
  const interactions = db
    .prepare(
      `SELECT i.*, c.name AS contact_name, j.title AS job_title, j.company AS job_company
       FROM interactions i
       LEFT JOIN contacts c ON c.id = i.contact_id
       LEFT JOIN jobs j ON j.id = i.job_id
       ORDER BY i.happened_at DESC, i.id DESC LIMIT 100`
    )
    .all();
  return NextResponse.json({ interactions });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.content?.trim()) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }
  const type = TYPES.includes(body.type) ? body.type : "note";
  const info = getDb()
    .prepare(
      `INSERT INTO interactions (job_id, contact_id, type, content, happened_at, follow_up_date)
       VALUES (?, ?, ?, ?, COALESCE(?, datetime('now')), ?)`
    )
    .run(
      body.job_id ?? null,
      body.contact_id ?? null,
      type,
      body.content.trim(),
      body.happened_at || null,
      body.follow_up_date || null
    );
  if (body.job_id) touchJob(Number(body.job_id));
  return NextResponse.json({
    interaction: getDb()
      .prepare("SELECT * FROM interactions WHERE id = ?")
      .get(info.lastInsertRowid),
  });
}

export async function PATCH(req: NextRequest) {
  const { id, follow_up_done } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  getDb()
    .prepare("UPDATE interactions SET follow_up_done = ? WHERE id = ?")
    .run(follow_up_done ? 1 : 0, id);
  return NextResponse.json({ ok: true });
}
