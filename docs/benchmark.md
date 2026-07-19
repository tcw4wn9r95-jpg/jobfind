# JobFind vs. best-in-class job-search tools

Benchmark date: July 2026. Compared against the leading commercial trackers:
**Teal** (free + $9/wk premium), **Huntr** (free + ~$40/mo pro), **Simplify**
(free + $20/mo), **Careerflow** (free + premium).

| Capability | JobFind | Teal | Huntr | Simplify |
|---|---|---|---|---|
| Kanban pipeline tracking | ✅ | ✅ | ✅ | ✅ |
| AI match score vs. your profile | ✅ (Claude, 0–100 + gaps + recommendations) | 💰 premium | ❌ | ✅ |
| Tailored CV per job | ✅ **in your own .docx template** | ✅ their templates | 💰 | ✅ their templates |
| ATS-safe output + keyword targeting | ✅ structure + content rules | 💰 keyword analysis | ❌ | ✅ |
| Per-job AI copilot chat (revisions, cover notes, interview prep) | ✅ | partial (writing tools) | ❌ | partial |
| Contacts / people CRM | ✅ | limited | ✅ | ❌ |
| Follow-up reminders | ✅ (in-app, surfaced on dashboard) | ✅ | ✅ | ❌ |
| Job discovery / lead feed | 🔜 planned (see `lead-scanner-plan.md`) | ✅ | ✅ | ✅ |
| Browser-extension autofill for applications | ❌ (out of scope for a PWA) | ✅ | ✅ | ✅ core feature |
| Analytics | partial (reply rate, funnel counts) | ✅ | ✅ | partial |
| Push notifications | ❌ (no server) | ✅ | ✅ | ✅ |
| Multi-device sync | manual (JSON backup/restore) | ✅ | ✅ | ✅ |
| Works installed on phone | ✅ PWA | ✅ | ✅ | ✅ |
| Your data stays on your device | ✅ **only JobFind** | ❌ | ❌ | ❌ |
| Price | **$0** + your own Claude API usage (~$0.01–0.05/job) | $9/wk for the AI | ~$40/mo | $20/mo |

## Where JobFind wins

- **CV in your exact template.** No commercial tool regenerates into your own
  .docx layout — they force their templates. JobFind reproduces the reference
  template byte-for-byte in structure (verified with 22 XML assertions).
- **Privacy.** Everything (CV, pipeline, contacts, API key) lives in the
  browser on your device; the only external call is directly to Anthropic.
- **Cost.** Hosting is free (GitHub Pages); AI costs are your own API usage,
  roughly the price of one coffee per hundred analyses.
- **Copilot depth.** The chat knows your profile, the job, the analysis and the
  current CV version, and can ship a revised CV directly into version history.

## Honest gaps (ranked by impact)

1. **Job discovery** — competitors surface matching jobs; JobFind only scores
   what you feed it. Addressed by the lead-scanner plan (next doc).
2. **No push notifications** — follow-ups surface only when you open the app.
   A static PWA cannot send push without a server; mitigation: the dashboard
   makes due follow-ups loud, and the planned scanner can double as a daily
   nudge via a GitHub Action email.
3. **No autofill extension** — Simplify's core feature. Out of scope for a
   phone-first PWA; the .docx download covers the upload-your-CV step.
4. **Manual sync** — localStorage is device-local by design; backup/restore
   JSON covers migration. True sync would need a backend (breaks free+private).
5. **Analytics depth** — no time-in-stage or source tracking yet; the data
   model (status timestamps, interactions) already supports adding it.

## CV generation quality controls

The generator's prompt now enforces, in order of priority:
1. **Truth only** — no invented employers, dates, metrics or skills; missing
   requirements are omitted, not fabricated.
2. **Keywords woven, never stuffed** — a keyword must live inside a real
   achievement; max two uses; the summary must read as an argument, not a list;
   the posting's *terms* are matched but its sentences are never copied.
3. **Human voice** — varied bullet openings, mixed sentence lengths, concrete
   numbers over adjectives, banned-cliché list, and a final "skeptical
   recruiter" re-read instruction before output.

These are prompt-level guarantees; the model's output still deserves a human
read before sending — the app's chat makes one-line fixes cheap.
