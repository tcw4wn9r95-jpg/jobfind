"use client";

import Link from "next/link";
import { useState } from "react";
import {
  PageHeader,
  ScoreRing,
  Spinner,
  StatusChip,
  api,
  useApi,
} from "@/components/ui";

export default function JobsPage() {
  const { data, loading, reload } = useApi<{ jobs: any[] }>("/api/jobs");
  const [url, setUrl] = useState("");
  const [pasted, setPasted] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const jobs = data?.jobs ?? [];

  async function addJob() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/jobs", {
        method: "POST",
        body: JSON.stringify({ url: url.trim(), description: pasted.trim() }),
      });
      setUrl("");
      setPasted("");
      setShowPaste(false);
      reload();
    } catch (e: any) {
      setError(e.message);
      if (e.data?.needsPaste) setShowPaste(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Jobs & Matches"
        subtitle="Drop in a job link — I'll read it, score the fit against your profile, and tell you how to win it."
      />

      <section className="card mb-8 p-6 animate-rise">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            className="input flex-1"
            placeholder="https://… paste a job posting link"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !busy && (url || pasted) && addJob()}
          />
          <button
            className="btn-primary shrink-0"
            onClick={addJob}
            disabled={busy || (!url.trim() && pasted.trim().length < 100)}
          >
            {busy ? <Spinner label="Reading & scoring…" /> : "Analyse match ✨"}
          </button>
        </div>
        <button
          className="mt-3 text-xs font-semibold text-indigo-600 hover:underline"
          onClick={() => setShowPaste((s) => !s)}
        >
          {showPaste ? "Hide" : "Or paste the job description text instead →"}
        </button>
        {showPaste && (
          <textarea
            className="input mt-3 min-h-[160px] text-xs"
            placeholder="Paste the full job description here…"
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
          />
        )}
        {error && <p className="mt-3 text-sm font-medium text-rose-600">{error}</p>}
        {busy && (
          <p className="mt-3 text-xs text-ink-400 animate-pulseSoft">
            Fetching the posting and comparing it with your profile — usually 10–20 seconds.
          </p>
        )}
      </section>

      {loading ? (
        <Spinner label="Loading jobs…" />
      ) : jobs.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-lg font-bold text-ink-800">No jobs yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-500">
            Add your first posting above. Each one gets a match score, a fit analysis, and a
            one-click tailored CV when you decide to go for it.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4">
          {jobs.map((j) => (
            <li key={j.id}>
              <Link
                href={`/job/?id=${j.id}`}
                className="card flex items-center gap-5 p-5 transition hover:border-indigo-300 hover:shadow-lift"
              >
                <ScoreRing score={j.score} size={64} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-bold text-ink-900">{j.title}</p>
                    <StatusChip status={j.status} />
                  </div>
                  <p className="mt-0.5 text-sm text-ink-500">
                    {j.company}
                    {j.location ? ` · ${j.location}` : ""}
                  </p>
                  {j.analysis && (
                    <p className="mt-1.5 line-clamp-1 text-xs text-ink-400">
                      {safeVerdict(j.analysis)}
                    </p>
                  )}
                </div>
                <span className="hidden text-xs font-semibold text-indigo-600 sm:block">
                  Open →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function safeVerdict(analysis: string): string {
  try {
    return JSON.parse(analysis).verdict ?? "";
  } catch {
    return "";
  }
}
