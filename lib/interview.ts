// Interview prep pack: everything Claude produces for one job at one
// interview stage. Stored like tailored CVs — versioned per job, generated
// on-device with the user's own API key.

export type StarStory = {
  title: string;
  competencies: string[];
  situation: string;
  task: string;
  action: string;
  result: string;
  also_answers: string[];
};

export type InterviewPrep = {
  stage: string;
  stage_focus: string;
  talking_points: { headline: string; detail: string; evidence: string }[];
  star_stories: StarStory[];
  likely_questions: { question: string; category: string; approach: string; use_story: string }[];
  challenges: { challenge: string; why_it_comes_up: string; response: string }[];
  questions_to_ask: { question: string; why: string }[];
  research_checklist: string[];
  compensation: { guidance: string; notes: string[] };
};

/** The stages a prep pack can target — each is tested differently. */
export const INTERVIEW_STAGES = [
  "Recruiter screen",
  "Hiring manager",
  "Panel / team",
  "Case / technical exercise",
  "Executive / final round",
] as const;

export function isInterviewPrep(x: unknown): x is InterviewPrep {
  const p = x as InterviewPrep;
  return Boolean(
    p &&
      typeof p === "object" &&
      typeof p.stage_focus === "string" &&
      Array.isArray(p.star_stories) &&
      Array.isArray(p.likely_questions)
  );
}

export function parsePrep(content: string): InterviewPrep | null {
  try {
    const parsed = JSON.parse(content);
    return isInterviewPrep(parsed) ? withDefaults(parsed) : null;
  } catch {
    return null;
  }
}

function withDefaults(p: InterviewPrep): InterviewPrep {
  return {
    stage: p.stage ?? "",
    stage_focus: p.stage_focus ?? "",
    talking_points: p.talking_points ?? [],
    star_stories: (p.star_stories ?? []).map((s) => ({
      title: s.title ?? "",
      competencies: s.competencies ?? [],
      situation: s.situation ?? "",
      task: s.task ?? "",
      action: s.action ?? "",
      result: s.result ?? "",
      also_answers: s.also_answers ?? [],
    })),
    likely_questions: p.likely_questions ?? [],
    challenges: p.challenges ?? [],
    questions_to_ask: p.questions_to_ask ?? [],
    research_checklist: p.research_checklist ?? [],
    compensation: {
      guidance: p.compensation?.guidance ?? "",
      notes: p.compensation?.notes ?? [],
    },
  };
}

/** Plain-text rendition for download / printing / phone reference. */
export function prepToText(p: InterviewPrep, jobTitle: string, company: string): string {
  const L: string[] = [];
  L.push(`INTERVIEW PREP — ${jobTitle} at ${company}`);
  L.push(`Stage: ${p.stage}`);
  L.push("", "WHAT THIS STAGE IS REALLY TESTING", p.stage_focus);

  if (p.talking_points.length) {
    L.push("", "CORE TALKING POINTS");
    for (const t of p.talking_points) {
      L.push(`- ${t.headline}`, `  ${t.detail}`, `  Evidence: ${t.evidence}`);
    }
  }
  if (p.star_stories.length) {
    L.push("", "STAR STORY BANK");
    for (const s of p.star_stories) {
      L.push(
        "",
        `${s.title}  [${s.competencies.join(", ")}]`,
        `  S: ${s.situation}`,
        `  T: ${s.task}`,
        `  A: ${s.action}`,
        `  R: ${s.result}`
      );
      if (s.also_answers.length) L.push(`  Also answers: ${s.also_answers.join("; ")}`);
    }
  }
  if (p.likely_questions.length) {
    L.push("", "LIKELY QUESTIONS");
    for (const q of p.likely_questions) {
      L.push("", `Q (${q.category}): ${q.question}`, `  Approach: ${q.approach}`);
      if (q.use_story) L.push(`  Story: ${q.use_story}`);
    }
  }
  if (p.challenges.length) {
    L.push("", "TOUGH CHALLENGES / OBJECTIONS");
    for (const c of p.challenges) {
      L.push("", `Challenge: ${c.challenge}`, `  Why: ${c.why_it_comes_up}`, `  Response: ${c.response}`);
    }
  }
  if (p.questions_to_ask.length) {
    L.push("", "QUESTIONS TO ASK THEM");
    for (const q of p.questions_to_ask) L.push(`- ${q.question}`, `  (${q.why})`);
  }
  if (p.research_checklist.length) {
    L.push("", "RESEARCH BEFORE YOU GO");
    for (const r of p.research_checklist) L.push(`- ${r}`);
  }
  if (p.compensation.guidance || p.compensation.notes.length) {
    L.push("", "COMPENSATION", p.compensation.guidance);
    for (const n of p.compensation.notes) L.push(`- ${n}`);
  }
  return L.join("\n");
}
