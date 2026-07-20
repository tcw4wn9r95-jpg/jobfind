# Lead Scanner — plan

A bot that scans job sources daily, filters them against your target profile,
and feeds promising leads into JobFind — at zero (or near-zero) running cost.

## Constraints it must respect

- **Free to run.** No servers, no paid aggregator APIs.
- **The app has no backend.** JobFind is a static PWA; the bot cannot write
  into the phone's localStorage. It must publish leads somewhere the app can
  *fetch*, and the app pulls them in on open.
- **Privacy.** The repo is public (that's what makes Pages free), so the
  scanner's config must contain only generic search intent (titles, locations,
  keywords) — never the CV. Deep matching against the full profile stays
  on-device with the user's own API key.

## Architecture

```
GitHub Action (cron, daily ~07:00)          ← free on public repos
  1. fetch sources (tiered, below)
  2. normalize → {title, company, location, url, posted_at, description_snippet}
  3. score locally 0–100: title match, keyword hits, location fit, recency
  4. dedupe against seen-ids state (committed alongside output)
  5. write top ~20 to leads.json on the gh-pages branch

JobFind app ("Leads" inbox on the Jobs page)
  6. fetches leads.json (same origin — no CORS issues)
  7. shows new leads with the local heuristic score
  8. one tap → existing Claude match analysis (on-device, your key)
     → promote to pipeline as a scored Lead, or dismiss
```

## Sources (tiered by cost and effort)

**Tier 1 — free public APIs, no key, no auth** *(build first)*
- [Arbeitnow](https://www.arbeitnow.com/blog/job-board-api) — EU-focused
  (relevant for Luxembourg/EU roles), jobs pulled from ATS systems
- [Remotive](https://publicapis.io/category/jobs), RemoteOK, Jobicy,
  Himalayas — remote-first boards, all free JSON feeds

**Tier 2 — target-company ATS boards, free, no key** *(highest quality)*
- [Greenhouse, Lever and Ashby expose public JSON APIs](https://cavuno.com/blog/ats-platforms-public-job-posting-apis)
  per company board (Workable, Recruitee, Personio too). Maintain a curated
  list of ~30–50 companies you'd actually work for in `scanner/companies.json`;
  the Action polls each board directly. This is where the best leads come from:
  jobs appear here before aggregators pick them up.

**Tier 3 — free-key aggregators** *(shipped; adds on-site, not just remote)*
- [Adzuna](https://developer.adzuna.com/) — free key (`ADZUNA_APP_ID`/
  `ADZUNA_APP_KEY` repo secrets). Covers on-site jobs in France and Germany —
  Luxembourg itself isn't one of Adzuna's 12 supported countries, but its two
  biggest commuter-source neighbors are, which is exactly the gap Tier 1/2
  (mostly remote-first) didn't close.
- [Jooble](https://jooble.org/api/about) — free key (`JOOBLE_API_KEY` repo
  secret). Aggregates from thousands of sources across 69+ countries; searched
  directly against `location: "Luxembourg"` with a 40km radius.
- Both are optional and skip themselves cleanly (one log line, empty result)
  if their secret isn't set — the scanner runs fine without them, just with
  less on-site breadth.
- Hacker News "Who is hiring?" via the free Algolia HN API (monthly thread)
  — not yet built.

**Investigated and explicitly excluded:**
- **LinkedIn, Indeed** — no public API; scraping violates their terms and
  breaks constantly. Paste the link/description into the app instead.
- **EURES** (the EU's official job mobility portal, ~2M postings) — no public
  API, and its terms of use *explicitly prohibit* scraping. Third-party paid
  scrapers exist but that's the same ToS problem, just outsourced.
- **ADEM** (Luxembourg's national employment agency) — publishes open data,
  but only historical statistics, not a live current-vacancies feed. Nothing
  usable despite being the most obvious candidate.
- **Moovijob** (Luxembourg's largest local job board) — no confirmed public
  API or feed; would mean scraping HTML with no ToS certainty.

## Local scoring (keeps it free)

The Action ranks without any AI call:

```
score = 40 · title_similarity(target_titles)
      + 30 · keyword_hits(must_have ∪ nice_to_have)  # capped
      + 20 · location_fit(Luxembourg | remote-EU | listed cities)
      + 10 · recency(≤7 days)
      − hard_filters (wrong seniority, excluded companies, non-EU on-site)
```

Config lives in `scanner/config.json` (titles, keywords, locations,
exclusions — generic by design). The expensive, personal, profile-aware
scoring stays exactly where it is today: on-device Claude analysis when you
tap a lead.

## Cost table

| Item | Cost |
|---|---|
| GitHub Actions (1 run/day, ~2 min) | $0 (public repo) |
| Tier 1 + 2 sources | $0, no keys |
| Adzuna / Jooble | $0 (free keys; unset = skipped, no cost either way) |
| Leads hosting (`leads.json` on gh-pages) | $0 |
| On-tap Claude analysis | your existing API usage (~$0.01–0.05/lead you choose to analyse) |
| *Optional:* Haiku pre-ranking of the daily top-20 inside the Action | ~$0.10–0.30/mo (needs an API key as a repo secret — off by default) |

**Total: $0/month** in the default configuration.

## Build phases

1. **Phase 1 (core, ~1 session):** Action + Tier 1/Tier 2 fetchers + local
   scorer + `leads.json` publish + Leads inbox in the app (fetch, dismiss,
   analyse-with-Claude, promote to pipeline).
2. **Phase 2:** Adzuna + Jooble keys, HN monthly thread, config UI in
   Settings ("what should the scanner look for?") that generates a PR-able
   `config.json`.
3. **Phase 3 (optional):** daily email digest from the Action (free via
   GitHub's own notification on workflow output, or a free-tier Resend key),
   Haiku pre-ranking behind a repo secret.

## Risks & mitigations

- **Public config reveals search intent** → keep it generic ("Senior Program
  Manager, Luxembourg/remote-EU") — nothing sensitive; if that's still too
  much, a private repo works but free Pages then goes away (Actions stay free
  up to 2 000 min/mo) — leads.json would move to a Gist the app fetches.
- **Source APIs change/deprecate** → each fetcher is isolated; one failing
  source degrades breadth, never the pipeline (Action continues on error).
- **Duplicate/expired leads** → seen-ids state + drop anything older than
  30 days; the app hides leads already in your pipeline by URL match.
