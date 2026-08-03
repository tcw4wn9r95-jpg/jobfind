"use client";

import { useEffect, useRef, useState } from "react";
import { PageHeader, Spinner, api, useApi } from "@/components/ui";

export default function ProfilePage() {
  const { data, reload } = useApi<{ profile: any; questions: any[] }>("/api/profile");
  const [cv, setCv] = useState("");
  const [analysing, setAnalysing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const seededRef = useRef(false);

  const profile = data?.profile;
  const questions = data?.questions ?? [];
  const hasCv = (profile?.raw_cv ?? "").length > 50;
  const structured = safeParse(profile?.structured);

  useEffect(() => {
    if (profile && !seededRef.current) {
      setCv(profile.raw_cv ?? "");
      seededRef.current = true;
    }
  }, [profile]);

  async function analyse() {
    setAnalysing(true);
    setError(null);
    try {
      await api("/api/profile", { method: "POST", body: JSON.stringify({ cv }) });
      setEditing(false);
      reload();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAnalysing(false);
    }
  }

  async function onUpload(file: File) {
    const text = await file.text();
    setCv(text);
  }

  return (
    <div>
      <PageHeader
        title="My Profile"
        subtitle="Give me your CV once — I'll use it to score every job and tailor every application."
      />

      {(!hasCv || editing) && (
        <section className="card mb-6 p-6 animate-rise">
          <h2 className="mb-1 font-bold text-ink-900">
            {hasCv ? "Update your CV" : "Paste your CV"}
          </h2>
          <p className="mb-4 text-sm text-ink-500">
            Paste the full text of your CV (or upload a .txt/.md export). I&apos;ll read it,
            build your profile, and ask a few follow-up questions to fill any gaps.
          </p>
          <textarea
            className="input min-h-[300px] font-mono text-xs leading-relaxed"
            placeholder={"Jane Doe\nProduct Manager — Berlin\n\nEXPERIENCE\nSenior PM, Acme (2021–now)\n- Led checkout redesign, +18% conversion\n..."}
            value={cv}
            onChange={(e) => setCv(e.target.value)}
          />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button className="btn-primary" onClick={analyse} disabled={analysing || cv.trim().length < 50}>
              {analysing ? <Spinner label="Claude is reading your CV…" /> : "Analyse my CV ✨"}
            </button>
            <label className="btn-secondary cursor-pointer">
              Upload .txt / .md
              <input
                type="file"
                accept=".txt,.md,.markdown,text/plain"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
              />
            </label>
            {editing && (
              <button className="btn-ghost" onClick={() => setEditing(false)}>
                Cancel
              </button>
            )}
          </div>
          {error && <p className="mt-3 text-sm font-medium text-rose-600">{error}</p>}
        </section>
      )}

      {hasCv && !editing && (
        <section className="card mb-6 p-6 animate-rise">
          <div className="mb-3 flex items-start justify-between gap-4">
            <div>
              <h2 className="font-bold text-ink-900">
                {structured.name || "Your profile"}
                {structured.headline && (
                  <span className="ml-2 text-sm font-medium text-ink-500">
                    · {structured.headline}
                  </span>
                )}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-600">
                {profile.summary}
              </p>
            </div>
            <button className="btn-secondary shrink-0" onClick={() => setEditing(true)}>
              Edit CV
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(structured.skills ?? []).slice(0, 16).map((s: string) => (
              <span key={s} className="chip bg-indigo-50 text-indigo-700">
                {s}
              </span>
            ))}
            {(structured.industries ?? []).map((s: string) => (
              <span key={s} className="chip bg-fuchsia-50 text-fuchsia-700">
                {s}
              </span>
            ))}
          </div>
        </section>
      )}

      {hasCv && <ContactCard profile={profile} onSaved={reload} />}

      {hasCv && questions.length > 0 && <QuestionsCard questions={questions} onSaved={reload} />}
    </div>
  );
}

/**
 * Contact details used on every generated CV. Deliberately editable and
 * stored on the profile rather than produced by the model each time — the
 * model used to return these empty, which silently dropped the whole
 * contact line (and the LinkedIn link with it).
 */
function ContactCard({ profile, onSaved }: { profile: any; onSaved: () => void }) {
  const stored = profile?.contact ?? {};
  const [form, setForm] = useState({
    name: stored.name ?? "",
    email: stored.email ?? "",
    phone: stored.phone ?? "",
    linkedin: stored.linkedin ?? "",
  });
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const seeded = useRef(false);

  useEffect(() => {
    if (profile && !seeded.current) {
      const c = profile.contact ?? {};
      setForm({
        name: c.name ?? "",
        email: c.email ?? "",
        phone: c.phone ?? "",
        linkedin: c.linkedin ?? "",
      });
      seeded.current = true;
    }
  }, [profile]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save() {
    setBusy(true);
    try {
      await api("/api/profile/contact", {
        method: "POST",
        body: JSON.stringify({ contact: form }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  const missing = !form.email || !form.phone || !form.linkedin;

  return (
    <section className="card mb-6 p-6 animate-rise">
      <h2 className="font-bold text-ink-900">Contact details</h2>
      <p className="mb-4 mt-1 text-sm text-ink-500">
        These go on the header of every CV you generate, exactly as typed. I pre-filled what I
        could read from your CV — check them, since a LinkedIn URL often isn&apos;t in the
        pasted text.
      </p>
      {missing && (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          Fill in the blanks below — anything empty is left off the generated CV.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Full name</label>
          <input className="input" value={form.name} onChange={set("name")} placeholder="Diego Casares Silva" />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" value={form.email} onChange={set("email")} placeholder="you@example.com" />
        </div>
        <div>
          <label className="label">Phone</label>
          <input className="input" value={form.phone} onChange={set("phone")} placeholder="+352 691 611 079" />
        </div>
        <div>
          <label className="label">LinkedIn URL</label>
          <input
            className="input"
            value={form.linkedin}
            onChange={set("linkedin")}
            placeholder="linkedin.com/in/yourprofile"
          />
        </div>
      </div>
      <button className="btn-primary mt-4" onClick={save} disabled={busy}>
        {saved ? "Saved ✓" : "Save contact details"}
      </button>
    </section>
  );
}

function QuestionsCard({
  questions,
  onSaved,
}: {
  questions: any[];
  onSaved: () => void;
}) {
  const unanswered = questions.filter((q) => !q.answer);
  const answered = questions.filter((q) => q.answer);
  const [draft, setDraft] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const answers = Object.entries(draft)
        .filter(([, v]) => v.trim())
        .map(([id, answer]) => ({ id: Number(id), answer: answer.trim() }));
      if (answers.length) {
        await api("/api/profile/answers", {
          method: "POST",
          body: JSON.stringify({ answers }),
        });
        setDraft({});
        onSaved();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card p-6 animate-rise">
      <h2 className="font-bold text-ink-900">Follow-up questions</h2>
      <p className="mb-4 mt-1 text-sm text-ink-500">
        {unanswered.length
          ? `Claude read your CV and wants to know ${unanswered.length} more thing${unanswered.length > 1 ? "s" : ""} — answers sharpen your match scores and tailored CVs.`
          : "All caught up — your profile is complete. 💪"}
      </p>
      <div className="space-y-4">
        {unanswered.map((q) => (
          <div key={q.id} className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
            <p className="mb-2 text-sm font-semibold text-ink-800">{q.question}</p>
            <textarea
              className="input min-h-[60px]"
              placeholder="Your answer…"
              value={draft[q.id] ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, [q.id]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      {unanswered.length > 0 && (
        <button
          className="btn-primary mt-4"
          onClick={save}
          disabled={saving || !Object.values(draft).some((v) => v.trim())}
        >
          {saving ? <Spinner label="Saving…" /> : "Save answers"}
        </button>
      )}
      {answered.length > 0 && (
        <details className="mt-5">
          <summary className="cursor-pointer text-xs font-semibold text-ink-500">
            {answered.length} answered question{answered.length > 1 ? "s" : ""}
          </summary>
          <ul className="mt-3 space-y-2">
            {answered.map((q) => (
              <li key={q.id} className="rounded-lg bg-ink-50 p-3 text-sm">
                <p className="font-medium text-ink-700">{q.question}</p>
                <p className="mt-1 text-ink-500">{q.answer}</p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function safeParse(json: string | undefined): any {
  try {
    return JSON.parse(json ?? "{}") ?? {};
  } catch {
    return {};
  }
}
