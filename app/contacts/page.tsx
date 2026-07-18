"use client";

import Link from "next/link";
import { useState } from "react";
import { PageHeader, Spinner, api, useApi } from "@/components/ui";

export default function ContactsPage() {
  const { data, loading, reload } = useApi<{ contacts: any[] }>("/api/contacts");
  const { data: jobsData } = useApi<{ jobs: any[] }>("/api/jobs");
  const [form, setForm] = useState({
    name: "",
    role: "",
    company: "",
    email: "",
    linkedin: "",
    notes: "",
    job_id: "",
  });
  const [busy, setBusy] = useState(false);
  const contacts = data?.contacts ?? [];
  const jobs = jobsData?.jobs ?? [];

  async function add() {
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      await api("/api/contacts", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          job_id: form.job_id ? Number(form.job_id) : null,
        }),
      });
      setForm({ name: "", role: "", company: "", email: "", linkedin: "", notes: "", job_id: "" });
      reload();
    } finally {
      setBusy(false);
    }
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div>
      <PageHeader
        title="People"
        subtitle="Recruiters, hiring managers, referrals — jobs come from people. Keep track of yours."
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card h-fit p-5 animate-rise">
          <h2 className="mb-3 text-sm font-bold text-ink-900">Add a person</h2>
          <div className="space-y-2.5">
            <input className="input" placeholder="Name *" value={form.name} onChange={set("name")} />
            <input className="input" placeholder="Role (e.g. Recruiter)" value={form.role} onChange={set("role")} />
            <input className="input" placeholder="Company" value={form.company} onChange={set("company")} />
            <input className="input" placeholder="Email" value={form.email} onChange={set("email")} />
            <input className="input" placeholder="LinkedIn URL" value={form.linkedin} onChange={set("linkedin")} />
            <select className="input" value={form.job_id} onChange={set("job_id")}>
              <option value="">Link to a job (optional)</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title} — {j.company}
                </option>
              ))}
            </select>
            <textarea
              className="input min-h-[60px]"
              placeholder="Notes (how you met, what they said…)"
              value={form.notes}
              onChange={set("notes")}
            />
            <button className="btn-primary w-full" onClick={add} disabled={busy || !form.name.trim()}>
              + Add person
            </button>
          </div>
        </section>

        <section className="lg:col-span-2">
          {loading ? (
            <Spinner label="Loading…" />
          ) : contacts.length === 0 ? (
            <div className="card p-10 text-center text-sm text-ink-500">
              No contacts yet. Every recruiter call, referral and hiring manager belongs here —
              relationships outlast any single application.
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {contacts.map((c) => (
                <li key={c.id} className="card p-4 animate-rise">
                  <p className="font-bold text-ink-900">{c.name}</p>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {[c.role, c.company].filter(Boolean).join(" · ") || "—"}
                  </p>
                  {(c.email || c.linkedin) && (
                    <p className="mt-2 space-x-3 text-xs">
                      {c.email && (
                        <a className="font-semibold text-indigo-600 hover:underline" href={`mailto:${c.email}`}>
                          {c.email}
                        </a>
                      )}
                      {c.linkedin && (
                        <a
                          className="font-semibold text-indigo-600 hover:underline"
                          href={c.linkedin}
                          target="_blank"
                          rel="noreferrer"
                        >
                          LinkedIn ↗
                        </a>
                      )}
                    </p>
                  )}
                  {c.notes && <p className="mt-2 text-xs leading-relaxed text-ink-600">{c.notes}</p>}
                  {c.job_title && (
                    <Link
                      href={`/jobs/${c.job_id}`}
                      className="mt-2 inline-block text-xs font-semibold text-violet-600 hover:underline"
                    >
                      ↳ {c.job_title} at {c.job_company}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
