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
(Set `DATA_DIR` to store it elsewhere, e.g. on a mounted volume.)

## Use it on your phone

JobFind is a PWA: mobile layout with a bottom tab bar, installable to your home
screen, with app icon and standalone (no browser chrome) mode.

**1. Host it** (it needs a Node server + disk for SQLite, so pick a host with a
persistent volume — Railway is the least-clicks option):

- [Railway](https://railway.app): *New Project → Deploy from GitHub repo* and pick
  this repo — the `Dockerfile` is detected automatically. Then:
  - **Variables** → add `ANTHROPIC_API_KEY` (plus the Google Drive vars if you use them)
  - **Volume** → attach a volume mounted at `/data` (the Dockerfile stores the DB there)
  - **Settings → Networking** → *Generate Domain* to get your `https://…up.railway.app` URL
- Render / Fly.io work the same way (Docker deploy + volume at `/data` + env vars).

**2. Add it to your home screen** from the generated URL:

- **iPhone (Safari):** Share button → *Add to Home Screen*
- **Android (Chrome):** ⋮ menu → *Add to Home screen* (or the install prompt)

It then opens full-screen like a native app.

> **Set `APP_PASSWORD`** when hosting online — it locks the whole app behind a
> login (you stay signed in for a year per device). Without it anyone with the
> URL could see your data.

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
