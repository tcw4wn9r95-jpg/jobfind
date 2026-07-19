import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { askClaudeJson } from "@/lib/claude";
import { PROFILE_INTAKE_SYSTEM } from "@/lib/prompts";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const profile = db.prepare("SELECT * FROM profile WHERE id = 1").get();
  const questions = db
    .prepare("SELECT * FROM profile_questions ORDER BY id")
    .all();
  return NextResponse.json({ profile, questions });
}

type IntakeResult = {
  summary: string;
  structured: Record<string, unknown>;
  questions: string[];
};

// Save/replace the CV and have Claude analyse it + generate follow-up questions
export async function POST(req: NextRequest) {
  const { cv } = await req.json();
  if (!cv || typeof cv !== "string" || cv.trim().length < 50) {
    return NextResponse.json(
      { error: "Please provide your CV text (at least a few lines)." },
      { status: 400 }
    );
  }
  try {
    const result = await askClaudeJson<IntakeResult>({
      system: PROFILE_INTAKE_SYSTEM,
      messages: [{ role: "user", content: cv.slice(0, 60000) }],
    });
    const db = getDb();
    db.prepare(
      "UPDATE profile SET raw_cv = ?, summary = ?, structured = ?, updated_at = datetime('now') WHERE id = 1"
    ).run(cv, result.summary ?? "", JSON.stringify(result.structured ?? {}));
    // Replace unanswered questions; keep answered ones as part of the profile
    db.prepare(
      "DELETE FROM profile_questions WHERE answer IS NULL OR answer = ''"
    ).run();
    const insert = db.prepare(
      "INSERT INTO profile_questions (question) VALUES (?)"
    );
    for (const q of result.questions ?? []) insert.run(q);
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
