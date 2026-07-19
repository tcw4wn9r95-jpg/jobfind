// Client-side data layer: everything lives in localStorage on this device.
// Shapes mirror the SQL rows the original server version used, so the UI
// components consume identical objects.

export type Profile = {
  raw_cv: string;
  summary: string;
  structured: string; // JSON string
  updated_at: string;
};

export type Question = {
  id: number;
  question: string;
  answer: string | null;
  created_at: string;
};

export type Job = {
  id: number;
  title: string;
  company: string;
  location: string;
  url: string;
  description: string;
  status: string;
  score: number | null;
  analysis: string | null;
  notes: string;
  next_follow_up: string | null;
  applied_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TailoredCv = {
  id: number;
  job_id: number;
  version: number;
  content: string;
  created_at: string;
};

export type ChatMessage = {
  id: number;
  job_id: number;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export type Contact = {
  id: number;
  name: string;
  role: string;
  company: string;
  email: string;
  linkedin: string;
  notes: string;
  job_id: number | null;
  created_at: string;
};

export type Interaction = {
  id: number;
  job_id: number | null;
  contact_id: number | null;
  type: string;
  content: string;
  happened_at: string;
  follow_up_date: string | null;
  follow_up_done: number;
  created_at: string;
};

export type Settings = {
  apiKey: string;
  model: string;
};

export type Db = {
  profile: Profile;
  questions: Question[];
  jobs: Job[];
  cvs: TailoredCv[];
  messages: ChatMessage[];
  contacts: Contact[];
  interactions: Interaction[];
  settings: Settings;
  nextId: number;
};

const KEY = "jobfind-db";

function emptyDb(): Db {
  return {
    profile: { raw_cv: "", summary: "", structured: "{}", updated_at: now() },
    questions: [],
    jobs: [],
    cvs: [],
    messages: [],
    contacts: [],
    interactions: [],
    settings: { apiKey: "", model: "claude-sonnet-5" },
    nextId: 1,
  };
}

export function now(): string {
  // Same format SQLite's datetime('now') produced; the UI slices it
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

export function loadDb(): Db {
  if (typeof window === "undefined") return emptyDb();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyDb();
    return { ...emptyDb(), ...JSON.parse(raw) };
  } catch {
    return emptyDb();
  }
}

export function saveDb(db: Db) {
  localStorage.setItem(KEY, JSON.stringify(db));
}

export function mutate<T>(fn: (db: Db) => T): T {
  const db = loadDb();
  const result = fn(db);
  saveDb(db);
  return result;
}

export function nextId(db: Db): number {
  return db.nextId++;
}

export function exportJson(): string {
  return JSON.stringify(loadDb(), null, 2);
}

export function importJson(json: string) {
  const parsed = JSON.parse(json);
  if (!parsed || typeof parsed !== "object" || !("jobs" in parsed)) {
    throw new Error("That file doesn't look like a JobFind backup.");
  }
  saveDb({ ...emptyDb(), ...parsed });
}

export function resetDb() {
  localStorage.removeItem(KEY);
}
