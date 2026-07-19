import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const contacts = getDb()
    .prepare(
      `SELECT c.*, j.title AS job_title, j.company AS job_company
       FROM contacts c LEFT JOIN jobs j ON j.id = c.job_id
       ORDER BY c.created_at DESC`
    )
    .all();
  return NextResponse.json({ contacts });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const info = getDb()
    .prepare(
      `INSERT INTO contacts (name, role, company, email, linkedin, notes, job_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      body.name.trim(),
      body.role ?? "",
      body.company ?? "",
      body.email ?? "",
      body.linkedin ?? "",
      body.notes ?? "",
      body.job_id ?? null
    );
  return NextResponse.json({
    contact: getDb()
      .prepare("SELECT * FROM contacts WHERE id = ?")
      .get(info.lastInsertRowid),
  });
}
