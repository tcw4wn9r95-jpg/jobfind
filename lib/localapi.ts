// Local, in-browser implementation of what used to be the server API.
// Same paths, same request/response shapes — components didn't have to change.

import { askClaude, askClaudeJson } from "./ai";
import { fetchJobPage } from "./jobtext";
import {
  Db,
  Interaction,
  Job,
  loadDb,
  mutate,
  nextId,
  now,
} from "./localdb";
import {
  CHAT_SYSTEM_PREFIX,
  CV_GENERATION_SYSTEM,
  MATCH_SYSTEM,
  PROFILE_INTAKE_SYSTEM,
} from "./prompts";

export class ApiError extends Error {
  data: Record<string, unknown>;
  constructor(message: string, data: Record<string, unknown> = {}) {
    super(message);
    this.data = data;
  }
}

const JOB_STATUSES = ["lead", "applied", "replied", "interview", "offer", "rejected"];
const INTERACTION_TYPES = ["note", "meeting", "call", "email", "reply", "interview"];

function profileContextAsText(db: Db): string {
  let text = `CANDIDATE CV (as provided by the candidate):\n${db.profile.raw_cv}`;
  const qa = db.questions.filter((q) => q.answer?.trim());
  if (qa.length) {
    text += `\n\nADDITIONAL DETAILS (from follow-up questions the candidate answered):\n`;
    for (const q of qa) text += `Q: ${q.question}\nA: ${q.answer}\n`;
  }
  return text;
}

function jobOr404(db: Db, id: number): Job {
  const job = db.jobs.find((j) => j.id === id);
  if (!job) throw new ApiError("Not found");
  return job;
}

function jobDetail(db: Db, id: number) {
  const job = jobOr404(db, id);
  const contactName = (i: Interaction) =>
    db.contacts.find((c) => c.id === i.contact_id)?.name ?? null;
  return {
    job,
    cvs: db.cvs
      .filter((c) => c.job_id === id)
      .sort((a, b) => b.version - a.version),
    messages: db.messages.filter((m) => m.job_id === id),
    interactions: db.interactions
      .filter((i) => i.job_id === id)
      .sort((a, b) => (a.happened_at < b.happened_at ? 1 : -1))
      .map((i) => ({ ...i, contact_name: contactName(i) })),
    contacts: db.contacts.filter((c) => c.job_id === id),
  };
}

function interactionJoined(db: Db, i: Interaction) {
  const job = db.jobs.find((j) => j.id === i.job_id);
  return {
    ...i,
    contact_name: db.contacts.find((c) => c.id === i.contact_id)?.name ?? null,
    job_title: job?.title ?? null,
    job_company: job?.company ?? null,
  };
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

async function addJob(body: { url?: string; description?: string }) {
  const db = loadDb();
  const profileText = profileContextAsText(db);
  if (profileText.trim().length < 100) {
    throw new ApiError("Add your CV in Profile first so I can score matches against it.");
  }
  let jobText = (body.description ?? "").trim();
  let pageTitle = "";
  if (!jobText && body.url) {
    try {
      const page = await fetchJobPage(body.url);
      jobText = page.text;
      pageTitle = page.title;
    } catch (e: any) {
      throw new ApiError(
        `Couldn't read that link (${e.message}). Some job boards block readers — paste the job description text instead.`,
        { needsPaste: true }
      );
    }
  }
  if (!jobText || jobText.length < 100) {
    throw new ApiError(
      "That page didn't contain a readable job description. Paste the description text instead.",
      { needsPaste: true }
    );
  }
  const analysis = await askClaudeJson<MatchResult>({
    system: MATCH_SYSTEM,
    messages: [
      {
        role: "user",
        content: `${profileText}\n\n=====\n\nJOB POSTING${pageTitle ? ` (page title: ${pageTitle})` : ""}:\n${jobText.slice(0, 30000)}`,
      },
    ],
  });
  return mutate((db) => {
    const job: Job = {
      id: nextId(db),
      title: analysis.title || pageTitle || "Untitled role",
      company: analysis.company || "",
      location: analysis.location || "",
      url: body.url || "",
      description: jobText,
      status: "lead",
      score: Math.round(analysis.score),
      analysis: JSON.stringify(analysis),
      notes: "",
      next_follow_up: null,
      applied_at: null,
      created_at: now(),
      updated_at: now(),
    };
    db.jobs.push(job);
    return { job };
  });
}

async function analyseProfile(cv: string) {
  if (!cv || cv.trim().length < 50) {
    throw new ApiError("Please provide your CV text (at least a few lines).");
  }
  const result = await askClaudeJson<{
    summary: string;
    structured: Record<string, unknown>;
    questions: string[];
  }>({
    system: PROFILE_INTAKE_SYSTEM,
    messages: [{ role: "user", content: cv.slice(0, 60000) }],
  });
  mutate((db) => {
    db.profile = {
      raw_cv: cv,
      summary: result.summary ?? "",
      structured: JSON.stringify(result.structured ?? {}),
      updated_at: now(),
    };
    db.questions = db.questions.filter((q) => q.answer?.trim());
    for (const q of result.questions ?? []) {
      db.questions.push({ id: nextId(db), question: q, answer: null, created_at: now() });
    }
  });
  return { ok: true, ...result };
}

async function generateCv(jobId: number) {
  const db = loadDb();
  const job = jobOr404(db, jobId);
  const content = await askClaude({
    system: CV_GENERATION_SYSTEM,
    maxTokens: 8000,
    messages: [
      {
        role: "user",
        content: `${profileContextAsText(db)}\n\n=====\n\nTARGET JOB (${job.title} at ${job.company}):\n${job.description.slice(0, 30000)}\n\nMATCH ANALYSIS (use the keywords/recommendations to guide emphasis — truthfully):\n${job.analysis ?? "n/a"}`,
      },
    ],
  });
  const cleaned = content.replace(/^```(?:markdown|md)?\n?|```\s*$/g, "").trim();
  return mutate((db) => {
    const maxV = Math.max(0, ...db.cvs.filter((c) => c.job_id === jobId).map((c) => c.version));
    const cv = { id: nextId(db), job_id: jobId, version: maxV + 1, content: cleaned, created_at: now() };
    db.cvs.push(cv);
    jobOr404(db, jobId).updated_at = now();
    return { cv };
  });
}

async function chat(jobId: number, message: string) {
  if (!message?.trim()) throw new ApiError("Empty message");
  const db = loadDb();
  const job = jobOr404(db, jobId);
  const latestCv = db.cvs
    .filter((c) => c.job_id === jobId)
    .sort((a, b) => b.version - a.version)[0];
  const history = db.messages
    .filter((m) => m.job_id === jobId)
    .slice(-30)
    .map((m) => ({ role: m.role, content: m.content }));

  const system = `${CHAT_SYSTEM_PREFIX}

CANDIDATE PROFILE:
${profileContextAsText(db).slice(0, 25000)}

JOB: ${job.title} at ${job.company} (status: ${job.status}, match score: ${job.score ?? "n/a"})
JOB DESCRIPTION:
${job.description.slice(0, 15000)}

MATCH ANALYSIS: ${job.analysis ?? "not analysed yet"}

${latestCv ? `CURRENT TAILORED CV (v${latestCv.version}):\n${latestCv.content}` : "No tailored CV generated yet."}`;

  mutate((db) => {
    db.messages.push({ id: nextId(db), job_id: jobId, role: "user", content: message, created_at: now() });
  });

  const reply = await askClaude({
    system,
    maxTokens: 8000,
    messages: [...history, { role: "user", content: message }],
  });

  return mutate((db) => {
    db.messages.push({ id: nextId(db), job_id: jobId, role: "assistant", content: reply, created_at: now() });
    jobOr404(db, jobId).updated_at = now();
    let newCv = null;
    const cvMatch = reply.match(/```cv\n([\s\S]*?)```/);
    if (cvMatch && cvMatch[1].trim().length > 100) {
      const maxV = Math.max(0, ...db.cvs.filter((c) => c.job_id === jobId).map((c) => c.version));
      newCv = { id: nextId(db), job_id: jobId, version: maxV + 1, content: cvMatch[1].trim(), created_at: now() };
      db.cvs.push(newCv);
    }
    return { reply, newCv };
  });
}

/** Route table. Paths intentionally match the original server API. */
export async function localApi(
  url: string,
  init?: { method?: string; body?: any }
): Promise<any> {
  const method = init?.method ?? "GET";
  const body = init?.body ?? {};
  const [path, query] = url.split("?");
  const parts = path.replace(/^\/api\//, "").split("/").filter(Boolean);

  if (parts[0] === "profile") {
    if (parts[1] === "answers" && method === "POST") {
      mutate((db) => {
        for (const { id, answer } of body.answers ?? []) {
          const q = db.questions.find((q) => q.id === id);
          if (q) q.answer = answer ?? "";
        }
      });
      return { ok: true };
    }
    if (method === "POST") return analyseProfile(body.cv);
    const db = loadDb();
    return { profile: db.profile, questions: db.questions };
  }

  if (parts[0] === "jobs") {
    if (parts.length === 1) {
      if (method === "POST") return addJob(body);
      const db = loadDb();
      return { jobs: [...db.jobs].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1)) };
    }
    const id = Number(parts[1]);
    if (parts.length === 2) {
      if (method === "PATCH") {
        return mutate((db) => {
          const job = jobOr404(db, id);
          for (const key of ["title", "company", "location", "notes", "next_follow_up", "url"] as const) {
            if (key in body) (job as any)[key] = body[key] ?? "";
          }
          if ("status" in body) {
            if (!JOB_STATUSES.includes(body.status)) throw new ApiError("Invalid status");
            job.status = body.status;
            if (body.status === "applied" && !job.applied_at) job.applied_at = now();
          }
          job.updated_at = now();
          return { job };
        });
      }
      if (method === "DELETE") {
        mutate((db) => {
          jobOr404(db, id);
          db.jobs = db.jobs.filter((j) => j.id !== id);
          db.cvs = db.cvs.filter((c) => c.job_id !== id);
          db.messages = db.messages.filter((m) => m.job_id !== id);
          db.interactions = db.interactions.filter((i) => i.job_id !== id);
          for (const c of db.contacts) if (c.job_id === id) c.job_id = null;
        });
        return { ok: true };
      }
      return jobDetail(loadDb(), id);
    }
    if (parts[2] === "cv" && method === "POST") return generateCv(id);
    if (parts[2] === "chat" && method === "POST") return chat(id, body.message);
  }

  if (parts[0] === "contacts") {
    if (method === "POST") {
      if (!body.name?.trim()) throw new ApiError("Name is required");
      return mutate((db) => {
        const contact = {
          id: nextId(db),
          name: body.name.trim(),
          role: body.role ?? "",
          company: body.company ?? "",
          email: body.email ?? "",
          linkedin: body.linkedin ?? "",
          notes: body.notes ?? "",
          job_id: body.job_id ?? null,
          created_at: now(),
        };
        db.contacts.push(contact);
        return { contact };
      });
    }
    const db = loadDb();
    return {
      contacts: [...db.contacts]
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
        .map((c) => {
          const job = db.jobs.find((j) => j.id === c.job_id);
          return { ...c, job_title: job?.title ?? null, job_company: job?.company ?? null };
        }),
    };
  }

  if (parts[0] === "interactions") {
    if (method === "POST") {
      if (!body.content?.trim()) throw new ApiError("Content is required");
      return mutate((db) => {
        const interaction: Interaction = {
          id: nextId(db),
          job_id: body.job_id ?? null,
          contact_id: body.contact_id ?? null,
          type: INTERACTION_TYPES.includes(body.type) ? body.type : "note",
          content: body.content.trim(),
          happened_at: body.happened_at || now(),
          follow_up_date: body.follow_up_date || null,
          follow_up_done: 0,
          created_at: now(),
        };
        db.interactions.push(interaction);
        if (body.job_id) {
          const job = db.jobs.find((j) => j.id === body.job_id);
          if (job) job.updated_at = now();
        }
        return { interaction };
      });
    }
    if (method === "PATCH") {
      mutate((db) => {
        const i = db.interactions.find((i) => i.id === body.id);
        if (i) i.follow_up_done = body.follow_up_done ? 1 : 0;
      });
      return { ok: true };
    }
    const db = loadDb();
    let items = [...db.interactions];
    if (query?.includes("upcoming")) {
      items = items
        .filter((i) => i.follow_up_date && !i.follow_up_done)
        .sort((a, b) => ((a.follow_up_date ?? "") < (b.follow_up_date ?? "") ? -1 : 1));
    } else {
      items.sort((a, b) => (a.happened_at < b.happened_at ? 1 : -1));
      items = items.slice(0, 100);
    }
    return { interactions: items.map((i) => interactionJoined(db, i)) };
  }

  throw new ApiError(`Unknown route: ${method} ${url}`);
}
