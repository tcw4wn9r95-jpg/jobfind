"use client";

import Link from "next/link";
import { useState } from "react";
import { CvInput } from "@/components/cv-input";
import { PageHeader, ScoreRing, Spinner, api, useApi } from "@/components/ui";

export default function CoachPage() {
  const { data, loading, reload } = useApi<{ sessions: any[] }>("/api/coach");
  const [open, setOpen] = useState(false);
  const EMPTY = { person: "", cv: "", job_url: "", job_description: "" };
  const [form, setForm] = useState(EMPTY);
  const [showPaste, setShowPaste] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessions = data?.sessions ?? [];

  async function create() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/coach", { method: "POST", body: JSON.stringify(form) });
      setForm(EMPTY);
      setShowPaste(false);
      setOpen(false);
      reload();
    } catch (e: any) {
      setError(e.message);
      // A link that couldn't be read isn't a dead end: open the paste box.
      if (e.data?.needsPaste) setShowPaste(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Coach someone"
        subtitle="Run the same analysis, CV tailoring and interview prep for a friend, mentee or colleague."
      >
        <button className="btn-primary" onClick={() => setOpen((o) => !o)}>
          {open ? "Cancel" : "+ New session"}
        </button>
      </PageHeader>

      <div className="card mb-6 border-indigo-200 bg-gradient-to-r from-indigo-50/60 to-fuchsia-50/60 p-4 animate-rise">
        <p className="text-xs leading-relaxed text-ink-600">
          <span className="font-bold text-ink-800">Kept separate.</span> Each session holds its
          own CV, job, versions, prep packs and chat. Nothing here touches your profile, your
          pipeline or your leads — and deleting a session removes that person&apos;s data
          completely.
        </p>
      </div>

      {open && (
        <section className="card mb-8 p-6 animate-rise">
          <h2 className="mb-3 font-bold text-ink-900">New coaching session</h2>
          <label className="label">Who are you helping?</label>
          <input
            className="input"
            placeholder="e.g. Maria — former colleague"
            value={form.person}
            onChange={(e) => setForm((f) => ({ ...f, person: e.target.value }))}
          />
          <label className="label mt-4">Their CV</label>
          <CvInput
            value={form.cv}
            onChange={(cv) => setForm((f) => ({ ...f, cv }))}
            placeholder="Paste their CV text here, or upload / drop a file…"
          />

          <label className="label mt-4">The job</label>
          <input
            className="input"
            placeholder="https://… paste the job posting link"
            value={form.job_url}
            onChange={(e) => setForm((f) => ({ ...f, job_url: e.target.value }))}
          />
          <p className="mt-1.5 text-xs text-ink-400">
            The posting is read through a public reader (r.jina.ai) — only the link is sent, never
            the CV.
          </p>
          <button
            type="button"
            className="mt-2 block text-xs font-semibold text-indigo-600 hover:underline"
            onClick={() => setShowPaste((v) => !v)}
          >
            {showPaste ? "Hide" : "Or paste the job description text instead →"}
          </button>
          {showPaste && (
            <textarea
              className="input mt-2 min-h-[160px] text-xs"
              placeholder="Paste the full job description here… (used instead of the link)"
              value={form.job_description}
              onChange={(e) => setForm((f) => ({ ...f, job_description: e.target.value }))}
            />
          )}
          {error && <p className="mt-3 text-sm font-medium text-rose-600">{error}</p>}
          <button
            className="btn-primary mt-4"
            onClick={create}
            disabled={
              busy ||
              form.cv.trim().length < 50 ||
              (!form.job_url.trim() && form.job_description.trim().length < 100)
            }
          >
            {busy ? <Spinner label="Scoring the match…" /> : "Create session ✨"}
          </button>
          {busy && (
            <p className="mt-3 text-xs text-ink-400 animate-pulseSoft">
              Reading the posting and comparing it with their CV — usually 10–30 seconds.
            </p>
          )}
        </section>
      )}

      {loading ? (
        <Spinner label="Loading…" />
      ) : sessions.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-lg font-bold text-ink-800">No coaching sessions yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-500">
            Add someone&apos;s CV (upload it or paste it) and a job (a link or the description), and
            they get everything you get: a scored match, a tailored CV in the same template, and a
            stage-aware interview pack.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4">
          {sessions.map((s) => (
            <li key={s.id}>
              <Link
                href={`/coach/session/?id=${s.id}`}
                className="card flex items-center gap-5 p-5 transition hover:border-indigo-300 hover:shadow-lift"
              >
                <ScoreRing score={s.score} size={64} />
                <div className="min-w-0 flex-1">
                  <p className="text-base font-bold text-ink-900">{s.person || "Unnamed person"}</p>
                  <p className="mt-0.5 text-sm text-ink-500">
                    {s.job_title}
                    {s.company ? ` · ${s.company}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-ink-400">
                    {s.cvs.length} CV{s.cvs.length === 1 ? "" : "s"} · {s.preps.length} prep pack
                    {s.preps.length === 1 ? "" : "s"}
                  </p>
                </div>
                <span className="hidden text-xs font-semibold text-indigo-600 sm:block">Open →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
