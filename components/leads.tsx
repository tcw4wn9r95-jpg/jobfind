"use client";

import { useEffect, useState } from "react";
import { Spinner, api } from "@/components/ui";
import { loadDb, mutate } from "@/lib/localdb";

type Lead = {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  posted_at: string | null;
  snippet: string;
  source: string;
  score: number;
};

/**
 * Inbox for the daily lead scanner (see docs/lead-scanner-plan.md).
 * Fetches leads.json that the GitHub Action publishes next to the app;
 * renders nothing until the first scan has run.
 */
export function LeadsInbox({ onPromoted }: { onPromoted: () => void }) {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string>("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    fetch(`${base}/leads/leads.json`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.leads) return;
        const db = loadDb();
        const dismissed = new Set(db.dismissed_leads);
        const trackedUrls = new Set(db.jobs.map((j) => j.url).filter(Boolean));
        setLeads(
          data.leads.filter(
            (l: Lead) => !dismissed.has(l.id) && !trackedUrls.has(l.url)
          )
        );
        setGeneratedAt(data.generated_at ?? "");
      })
      .catch(() => setLeads(null));
  }, []);

  function dismiss(id: string) {
    mutate((db) => {
      if (!db.dismissed_leads.includes(id)) db.dismissed_leads.push(id);
    });
    setHiddenIds((s) => new Set(s).add(id));
  }

  async function analyse(lead: Lead) {
    setBusyId(lead.id);
    setError(null);
    try {
      try {
        await api("/api/jobs", {
          method: "POST",
          body: JSON.stringify({ url: lead.url }),
        });
      } catch (e: any) {
        // Bot-blocked page: fall back to the scanner's stored snippet
        if (e.data?.needsPaste && lead.snippet.length >= 200) {
          await api("/api/jobs", {
            method: "POST",
            body: JSON.stringify({
              url: lead.url,
              description: `${lead.title} at ${lead.company} (${lead.location})\n\n${lead.snippet}`,
            }),
          });
        } else {
          throw e;
        }
      }
      dismiss(lead.id);
      onPromoted();
    } catch (e: any) {
      setError(`${lead.title}: ${e.message}`);
    } finally {
      setBusyId(null);
    }
  }

  const visible = (leads ?? []).filter((l) => !hiddenIds.has(l.id));
  if (!leads || visible.length === 0) return null;

  return (
    <section className="card mb-8 p-6 animate-rise">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-bold text-ink-900">
          Fresh leads
          <span className="ml-2 rounded-full bg-fuchsia-100 px-2 py-0.5 text-xs font-bold text-fuchsia-700">
            {visible.length} new
          </span>
        </h2>
        <span className="text-xs text-ink-400">
          scanned {generatedAt.slice(0, 10)} · sourced free from public job boards
        </span>
      </div>
      {error && <p className="mb-3 text-sm font-medium text-rose-600">{error}</p>}
      <ul className="space-y-2.5">
        {visible.map((lead) => (
          <li
            key={lead.id}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-ink-200/70 p-3"
          >
            <span
              className="w-10 shrink-0 text-center text-sm font-extrabold text-ink-700"
              title="Scanner heuristic score — tap Analyse for the real Claude match"
            >
              {lead.score}
            </span>
            <div className="min-w-0 flex-1">
              <a
                href={lead.url}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-semibold text-ink-900 hover:text-indigo-700 hover:underline"
              >
                {lead.title} ↗
              </a>
              <p className="truncate text-xs text-ink-500">
                {[lead.company, lead.location].filter(Boolean).join(" · ")}
                {lead.posted_at ? ` · ${lead.posted_at}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                className="btn-primary !px-3 !py-1.5 text-xs"
                onClick={() => analyse(lead)}
                disabled={busyId !== null}
              >
                {busyId === lead.id ? <Spinner label="Scoring…" /> : "Analyse ✨"}
              </button>
              <button
                className="btn-ghost !px-2.5 !py-1.5 text-xs"
                onClick={() => dismiss(lead.id)}
                title="Not interested"
              >
                ✕
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
