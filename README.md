# JobFind

Your job search, on offense. A personal job-hunting app that combines a
Claude-powered career copilot with a lightweight CRM, modeled on best-in-class
trackers (Huntr, Teal): a kanban pipeline, activity timeline, contacts, and
follow-up reminders.

**It runs entirely in your browser** and deploys free to GitHub Pages — no
server, no database. Your data and your Anthropic API key live on your device
(browser storage) and are sent nowhere except directly to Anthropic's API.

## What it does

- **Profile intake** — paste your CV (or upload a .txt/.md export). Claude reads
  it, builds your profile, and asks tailored follow-up questions to fill the
  gaps. Answers become part of your profile context.
- **Job matching** — add a posting by link (fetched through the free r.jina.ai
  reader; paste the text when a board blocks readers). Claude scores the fit
  0–100 with strengths, gaps, concrete recommendations, and the keywords a
  tailored CV should hit.
- **Tailored CV generation** — when you decide to apply, one click rewrites your
  CV for that role under hard rules: *nothing invented or exaggerated*, and
  *natural human writing* (no AI buzzword soup). Every version is stored;
  download as **.docx** or Markdown.
- **Claude chat per job** — a copilot that knows your profile, the job, and the
  current CV. Ask for revisions (saved automatically as new versions), cover
  notes, follow-up messages, or interview prep.
- **CRM** — kanban pipeline (Lead → Applied → Replied → Interview → Offer /
  Rejected), per-job activity timeline, contacts, and follow-up reminders that
  surface on the dashboard when due.

## Deploy to GitHub Pages (one-time)

1. Push this repo to GitHub (already done if you're reading this there).
2. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**
   (the included workflow usually enables this by itself on first run).
3. Every push to `main` deploys automatically. Your app appears at
   `https://<username>.github.io/<repo>/`.

Then on your phone, open that URL and **Add to Home Screen**
(iPhone: Safari share button → Add to Home Screen · Android: Chrome ⋮ → Add to
Home screen). It opens full-screen like a native app.

First-run setup (inside the installed app): open **Settings**, paste your
Anthropic API key from [console.anthropic.com](https://console.anthropic.com/settings/keys),
and add your CV under **Profile**.

> **Your data stays on the device.** It doesn't sync between phone and laptop.
> Use Settings → *Download backup* / *Restore backup* to move or safeguard it.
> On iPhone, the installed app's storage is separate from Safari's — set up
> your key inside the installed app.

## Run locally

```bash
npm install
npm run dev   # http://localhost:3000
```

## Stack

Next.js 14 static export · TypeScript · Tailwind CSS · browser localStorage ·
Anthropic SDK (direct browser calls) · docx
