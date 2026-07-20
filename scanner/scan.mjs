// Lead scanner entry point — runs daily in GitHub Actions (see
// .github/workflows/scanner.yml). Fetches free job sources, scores them
// against scanner/config.json, and writes scanner/out/{leads,seen}.json
// which the workflow publishes to the gh-pages 'leads/' directory.
//
// Every fetcher is isolated: one source failing (API change, rate limit)
// only reduces breadth. The run never hard-fails on a source.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { makeLead, selectLeads } from "./lib.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(DIR, "config.json"), "utf8"));
const companies = JSON.parse(fs.readFileSync(path.join(DIR, "companies.json"), "utf8"));
// Live site base, used to load the previously-seen ids so leads aren't repeated
const SITE_BASE = process.env.SITE_BASE || "";

async function getJson(url, init) {
  const res = await fetch(url, {
    headers: { "User-Agent": "jobfind-lead-scanner (personal project)", Accept: "application/json" },
    signal: AbortSignal.timeout(20000),
    ...init,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const fetchers = {
  async arbeitnow() {
    const leads = [];
    for (let page = 1; page <= 3; page++) {
      const data = await getJson(`https://www.arbeitnow.com/api/job-board-api?page=${page}`);
      for (const j of data.data ?? []) {
        leads.push(
          makeLead({
            title: j.title,
            company: j.company_name,
            location: [j.location, j.remote ? "Remote" : ""].filter(Boolean).join(" · "),
            url: j.url,
            postedAt: j.created_at ? j.created_at * 1000 : null,
            description: j.description,
            source: "arbeitnow",
          })
        );
      }
    }
    return leads;
  },

  async remotive() {
    const data = await getJson("https://remotive.com/api/remote-jobs?limit=200");
    return (data.jobs ?? []).map((j) =>
      makeLead({
        title: j.title,
        company: j.company_name,
        location: j.candidate_required_location || "Remote",
        url: j.url,
        postedAt: j.publication_date,
        description: j.description,
        source: "remotive",
      })
    );
  },

  async remoteok() {
    const data = await getJson("https://remoteok.com/api");
    return (Array.isArray(data) ? data : [])
      .filter((j) => j && j.position && j.url)
      .map((j) =>
        makeLead({
          title: j.position,
          company: j.company,
          location: j.location || "Remote",
          url: j.url,
          postedAt: j.date,
          description: j.description,
          source: "remoteok",
        })
      );
  },

  async jobicy() {
    const data = await getJson("https://jobicy.com/api/v2/remote-jobs?count=100");
    return (data.jobs ?? []).map((j) =>
      makeLead({
        title: j.jobTitle,
        company: j.companyName,
        location: j.jobGeo || "Remote",
        url: j.url,
        postedAt: j.pubDate,
        description: j.jobExcerpt || j.jobDescription,
        source: "jobicy",
      })
    );
  },

  async greenhouse() {
    const leads = [];
    for (const board of companies.greenhouse ?? []) {
      try {
        const data = await getJson(
          `https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`
        );
        for (const j of data.jobs ?? []) {
          leads.push(
            makeLead({
              title: j.title,
              company: board,
              location: j.location?.name ?? "",
              url: j.absolute_url,
              postedAt: j.updated_at,
              description: j.content,
              source: `greenhouse:${board}`,
            })
          );
        }
      } catch (e) {
        console.warn(`greenhouse ${board}: ${e.message}`);
      }
    }
    return leads;
  },

  async lever() {
    const leads = [];
    for (const board of companies.lever ?? []) {
      try {
        const data = await getJson(`https://api.lever.co/v0/postings/${board}?mode=json&limit=100`);
        for (const j of Array.isArray(data) ? data : []) {
          leads.push(
            makeLead({
              title: j.text,
              company: board,
              location: j.categories?.location ?? "",
              url: j.hostedUrl,
              postedAt: j.createdAt,
              description: j.descriptionPlain || j.description,
              source: `lever:${board}`,
            })
          );
        }
      } catch (e) {
        console.warn(`lever ${board}: ${e.message}`);
      }
    }
    return leads;
  },

  async ashby() {
    const leads = [];
    for (const board of companies.ashby ?? []) {
      try {
        const data = await getJson(`https://api.ashbyhq.com/posting-api/job-board/${board}`);
        for (const j of data.jobs ?? []) {
          leads.push(
            makeLead({
              title: j.title,
              company: board,
              location: [j.location, j.isRemote ? "Remote" : ""].filter(Boolean).join(" · "),
              url: j.jobUrl || j.applyUrl,
              postedAt: j.publishedAt,
              description: j.descriptionPlain || "",
              source: `ashby:${board}`,
            })
          );
        }
      } catch (e) {
        console.warn(`ashby ${board}: ${e.message}`);
      }
    }
    return leads;
  },

  // Optional: needs a free key from developer.adzuna.com, set as the
  // ADZUNA_APP_ID / ADZUNA_APP_KEY repo secrets. Covers on-site (not just
  // remote) jobs in France and Germany — Luxembourg itself isn't one of
  // Adzuna's 12 supported countries, but its two biggest commuter-source
  // neighbors are, which is what closes the "not only remote jobs" gap.
  async adzuna() {
    const id = process.env.ADZUNA_APP_ID;
    const key = process.env.ADZUNA_APP_KEY;
    if (!id || !key) {
      console.log("adzuna: skipped (ADZUNA_APP_ID/ADZUNA_APP_KEY not set)");
      return [];
    }
    const leads = [];
    // Capped to a handful of the most senior/representative titles per
    // country to stay well inside the free tier's daily call allowance —
    // local scoring still ranks the results, so precision here matters
    // less than breadth.
    const titles = (config.target_titles ?? []).slice(0, 4);
    for (const country of ["fr", "de"]) {
      for (const title of titles) {
        try {
          const data = await getJson(
            `https://api.adzuna.com/v1/api/jobs/${country}/search/1?` +
              new URLSearchParams({
                app_id: id,
                app_key: key,
                results_per_page: "20",
                what: title,
                content_type: "application/json",
              })
          );
          for (const j of data.results ?? []) {
            leads.push(
              makeLead({
                title: j.title,
                company: j.company?.display_name,
                location: j.location?.display_name ?? "",
                url: j.redirect_url,
                postedAt: j.created,
                description: j.description,
                source: `adzuna:${country}`,
              })
            );
          }
        } catch (e) {
          console.warn(`adzuna ${country}/${title}: ${e.message}`);
        }
      }
    }
    return leads;
  },

  // Optional: needs a free key from jooble.org/api/about, set as the
  // JOOBLE_API_KEY repo secret. Aggregates from thousands of sources
  // across 69+ countries; searched directly against Luxembourg with a
  // radius wide enough to catch the real commuter belt.
  async jooble() {
    const key = process.env.JOOBLE_API_KEY;
    if (!key) {
      console.log("jooble: skipped (JOOBLE_API_KEY not set)");
      return [];
    }
    const keywords = (config.target_titles ?? []).slice(0, 5).join(", ");
    const res = await fetch(`https://jooble.org/api/${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keywords, location: "Luxembourg", radius: "40" }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return (data.jobs ?? []).map((j) =>
      makeLead({
        title: j.title,
        company: j.company,
        location: j.location ?? "",
        url: j.link,
        postedAt: j.updated,
        description: j.snippet,
        source: "jooble",
      })
    );
  },
};

async function main() {
  // Previously published ids, so the inbox only ever shows new leads
  let seenIds = [];
  if (SITE_BASE) {
    try {
      const seen = await getJson(`${SITE_BASE}/leads/seen.json`);
      seenIds = seen.ids ?? [];
    } catch {
      console.warn("no previous seen.json (first run?)");
    }
  }

  const all = [];
  for (const [name, fn] of Object.entries(fetchers)) {
    try {
      const leads = await fn();
      console.log(`${name}: ${leads.length} jobs`);
      all.push(...leads);
    } catch (e) {
      console.warn(`${name} failed: ${e.message}`);
    }
  }

  const selected = selectLeads(all, config, seenIds);
  console.log(`selected ${selected.length} leads of ${all.length} fetched`);

  const outDir = path.join(DIR, "out");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "leads.json"),
    JSON.stringify({ generated_at: new Date().toISOString(), leads: selected }, null, 2)
  );
  // Keep the seen list bounded; oldest ids age out
  const ids = [...seenIds, ...selected.map((l) => l.id)].slice(-5000);
  fs.writeFileSync(path.join(outDir, "seen.json"), JSON.stringify({ ids }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
