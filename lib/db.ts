import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  db = new Database(path.join(dir, "jobfind.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      raw_cv TEXT NOT NULL DEFAULT '',
      summary TEXT NOT NULL DEFAULT '',
      structured TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS profile_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT NOT NULL,
      answer TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL DEFAULT '',
      company TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'lead',
      score INTEGER,
      analysis TEXT,
      notes TEXT NOT NULL DEFAULT '',
      next_follow_up TEXT,
      applied_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tailored_cvs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      version INTEGER NOT NULL DEFAULT 1,
      content TEXT NOT NULL,
      drive_file_id TEXT,
      drive_link TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT '',
      company TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      linkedin TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS interactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
      contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
      type TEXT NOT NULL DEFAULT 'note',
      content TEXT NOT NULL,
      happened_at TEXT NOT NULL DEFAULT (datetime('now')),
      follow_up_date TEXT,
      follow_up_done INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  db.prepare(
    "INSERT OR IGNORE INTO profile (id, raw_cv, summary, structured) VALUES (1, '', '', '{}')"
  ).run();
}

export const JOB_STATUSES = [
  "lead",
  "applied",
  "replied",
  "interview",
  "offer",
  "rejected",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export function touchJob(id: number) {
  getDb()
    .prepare("UPDATE jobs SET updated_at = datetime('now') WHERE id = ?")
    .run(id);
}

/** Full profile context handed to Claude: raw CV plus answered follow-ups. */
export function getProfileContext(): {
  rawCv: string;
  summary: string;
  qa: { question: string; answer: string }[];
} {
  const db = getDb();
  const profile = db
    .prepare("SELECT raw_cv, summary FROM profile WHERE id = 1")
    .get() as { raw_cv: string; summary: string };
  const qa = db
    .prepare(
      "SELECT question, answer FROM profile_questions WHERE answer IS NOT NULL AND answer != '' ORDER BY id"
    )
    .all() as { question: string; answer: string }[];
  return { rawCv: profile?.raw_cv ?? "", summary: profile?.summary ?? "", qa };
}

export function profileContextAsText(): string {
  const { rawCv, qa } = getProfileContext();
  let text = `CANDIDATE CV (as provided by the candidate):\n${rawCv}`;
  if (qa.length) {
    text += `\n\nADDITIONAL DETAILS (from follow-up questions the candidate answered):\n`;
    for (const { question, answer } of qa) {
      text += `Q: ${question}\nA: ${answer}\n`;
    }
  }
  return text;
}
