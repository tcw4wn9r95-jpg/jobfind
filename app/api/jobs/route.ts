import { NextRequest, NextResponse } from "next/server";
import { getDb, profileContextAsText } from "@/lib/db";
import { askClaudeJson } from "@/lib/claude";
import { MATCH_SYSTEM } from "@/lib/prompts";
import { fetchJobPage } from "@/lib/jobfetch";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET() {
  const jobs = getDb()
    .prepare("SELECT * FROM jobs ORDER BY updated_at DESC")
    .all();
  return NextResponse.json({ jobs });
}

type MatchResult = {
  title: string;
  company: string;
  location: string;
  score: number;
  verdict: string;
  strengths: string[];
  gaps: string[];
  recommendations: string[];
  keywords: string[];
};

/**
 * Add a job from a URL (fetched + parsed) or pasted description,
 * then run the Claude match analysis against the profile.
 */
export async function POST(req: NextRequest) {
  const { url, description } = await req.json();
  const db = getDb();

  const profileText = profileContextAsText();
  if (profileText.trim().length < 100) {
    return NextResponse.json(
      { error: "Add your CV in Profile first so I can score matches against it." },
      { status: 400 }
    );
  }

  let jobText: string = (description ?? "").trim();
  let pageTitle = "";
  if (!jobText && url) {
    try {
      const page = await fetchJobPage(url);
      jobText = page.text;
      pageTitle = page.title;
    } catch (e: any) {
      return NextResponse.json(
        {
          error: `Couldn't read that link (${e.message}). Some job boards block robots — paste the job description text instead.`,
          needsPaste: true,
        },
        { status: 422 }
      );
    }
  }
  if (!jobText || jobText.length < 100) {
    return NextResponse.json(
      {
        error:
          "That page didn't contain a readable job description (it's probably rendered with JavaScript). Paste the description text instead.",
        needsPaste: true,
      },
      { status: 422 }
    );
  }

  try {
    const analysis = await askClaudeJson<MatchResult>({
      system: MATCH_SYSTEM,
      messages: [
        {
          role: "user",
          content: `${profileText}\n\n=====\n\nJOB POSTING${pageTitle ? ` (page title: ${pageTitle})` : ""}:\n${jobText.slice(0, 30000)}`,
        },
      ],
    });
    const info = db
      .prepare(
        `INSERT INTO jobs (title, company, location, url, description, status, score, analysis)
         VALUES (?, ?, ?, ?, ?, 'lead', ?, ?)`
      )
      .run(
        analysis.title || pageTitle || "Untitled role",
        analysis.company || "",
        analysis.location || "",
        url || "",
        jobText,
        Math.round(analysis.score),
        JSON.stringify(analysis)
      );
    const job = db
      .prepare("SELECT * FROM jobs WHERE id = ?")
      .get(info.lastInsertRowid);
    return NextResponse.json({ job });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
