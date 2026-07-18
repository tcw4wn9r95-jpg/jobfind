import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

// Save answers to follow-up questions
export async function POST(req: NextRequest) {
  const { answers } = (await req.json()) as {
    answers: { id: number; answer: string }[];
  };
  if (!Array.isArray(answers)) {
    return NextResponse.json({ error: "answers[] required" }, { status: 400 });
  }
  const db = getDb();
  const update = db.prepare(
    "UPDATE profile_questions SET answer = ? WHERE id = ?"
  );
  for (const { id, answer } of answers) update.run(answer ?? "", id);
  return NextResponse.json({ ok: true });
}
