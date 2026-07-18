# JobFind

Your job search, on offense. A personal job-hunting app that combines a Claude-powered
career copilot with a lightweight CRM, modeled on best-in-class trackers (Huntr, Teal):
a kanban pipeline, activity timeline, contacts, and follow-up reminders.

## What it does

- **Profile intake** — paste your CV (or upload a .txt/.md export). Claude reads it,
  builds your profile, and asks tailored follow-up questions to fill the gaps
  (metrics, target roles, location, work authorization…). Answers become part of
  your profile context.
- **Job matching** — paste a job posting link. The app fetches and parses the page
  (JSON-LD `JobPosting` aware, with a paste-the-text fallback for bot-blocked or
  JS-rendered boards), then Claude scores the fit 0–100 with strengths, gaps,
  concrete recommendations, and the keywords a tailored CV should hit.
- **Tailored CV generation** — when you decide to apply, one click rewrites your CV
  for that role under hard rules: *nothing invented or exaggerated* (only facts from
  your material), and *natural human writing* (no AI buzzword soup). Every version is
  stored; download as **.docx** or Markdown, and it auto-uploads to **Google Drive**
  as a Google Doc when configured.
- **Claude chat per job** — a copilot that knows your profile, the job, and the
  current CV. Ask for revisions (saved automatically as new versions), cover notes,
  follow-up messages, or interview prep.
- **CRM** — kanban pipeline (Lead → Applied → Replied → Interview → Offer / Rejected)
  with drag & drop, per-job activity timeline (notes, meetings, calls, emails,
  replies, interviews), contacts, and follow-up reminders that surface on the
  dashboard when due.

## Run it

```bash
npm install
cp .env.example .env.local   # add your ANTHROPIC_API_KEY
npm run dev                  # http://localhost:3000
```

Data lives in a local SQLite file at `data/jobfind.db` — no external database.

### Google Drive (optional)

1. In Google Cloud, create a service account and enable the **Drive API**; download
   its JSON key.
2. In Google Drive, create a folder (e.g. "Tailored CVs") and **share it with the
   service account's email** (Editor).
3. In `.env.local` set `GOOGLE_SERVICE_ACCOUNT_JSON` (the key JSON inline) or
   `GOOGLE_SERVICE_ACCOUNT_FILE` (path to it), plus `GOOGLE_DRIVE_FOLDER_ID` (the
   folder ID from its URL).

Generated CVs are then saved to that folder as Google Docs automatically (and you
can re-upload any stored version from the CV tab). Without Drive configured,
everything still works — CVs are stored in the app and downloadable.

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS · SQLite (better-sqlite3) ·
Anthropic SDK (Claude) · googleapis · docx
