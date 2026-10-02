// Coaching sessions: the same analysis / tailored CV / interview prep
// machinery, run for someone else.
//
// CONTAINMENT IS THE POINT. Every artefact a session produces lives INSIDE
// the session object — its own CV versions, prep packs, chat history and
// contact details. Nothing is written to db.profile, db.jobs, db.cvs,
// db.interview_preps, db.messages, db.contacts or db.interactions, so a
// coaching session can never alter the owner's own profile or pipeline, and
// deleting one removes every trace of that person's data in a single step.

import { ContactDetails, EMPTY_CONTACT } from "./contact";

export type CoachCv = {
  id: number;
  version: number;
  content: string;
  created_at: string;
};

export type CoachPrep = {
  id: number;
  stage: string;
  content: string;
  created_at: string;
};

export type CoachMessage = {
  id: number;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export type CoachSession = {
  id: number;
  person: string;
  cv: string;
  job_title: string;
  company: string;
  location: string;
  job_description: string;
  /** The posting link, when the job was added by link rather than pasted. */
  job_url: string;
  analysis: string | null;
  score: number | null;
  /** Their contact details — never the app owner's. */
  contact: ContactDetails;
  cvs: CoachCv[];
  preps: CoachPrep[];
  messages: CoachMessage[];
  created_at: string;
  updated_at: string;
};

export function newSession(id: number, fields: Partial<CoachSession>, timestamp: string): CoachSession {
  return {
    id,
    person: fields.person ?? "",
    cv: fields.cv ?? "",
    job_title: fields.job_title ?? "",
    company: fields.company ?? "",
    location: fields.location ?? "",
    job_description: fields.job_description ?? "",
    job_url: fields.job_url ?? "",
    analysis: null,
    score: null,
    contact: fields.contact ?? { ...EMPTY_CONTACT },
    cvs: [],
    preps: [],
    messages: [],
    created_at: timestamp,
    updated_at: timestamp,
  };
}

/** Normalize a session loaded from storage so missing arrays can't crash the UI. */
export function normalizeSession(s: Partial<CoachSession>): CoachSession {
  return {
    id: s.id ?? 0,
    person: s.person ?? "",
    cv: s.cv ?? "",
    job_title: s.job_title ?? "",
    company: s.company ?? "",
    location: s.location ?? "",
    job_description: s.job_description ?? "",
    job_url: s.job_url ?? "",
    analysis: s.analysis ?? null,
    score: s.score ?? null,
    contact: { ...EMPTY_CONTACT, ...(s.contact ?? {}) },
    cvs: s.cvs ?? [],
    preps: s.preps ?? [],
    messages: s.messages ?? [],
    created_at: s.created_at ?? "",
    updated_at: s.updated_at ?? "",
  };
}

/** The keys a coaching session is allowed to touch. Used by the containment test. */
export const OWNER_KEYS_COACH_MUST_NOT_TOUCH = [
  "profile",
  "questions",
  "jobs",
  "cvs",
  "interview_preps",
  "messages",
  "contacts",
  "interactions",
  "dismissed_leads",
] as const;
