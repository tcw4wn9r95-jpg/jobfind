"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader, ScoreRing, Spinner, StatusChip, api, useApi } from "@/components/ui";
import { loadDb } from "@/lib/localdb";

const greetings = [
  "Let's find you something great.",
  "Momentum beats motivation — nice to see you.",
  "One good application today moves everything.",
  "The right role is out there. Let's go get it.",
];

export default function Dashboard() {
  const { data: jobsData, loading } = useApi<{ jobs: any[] }>("/api/jobs");
  const { data: profileData } = useApi<{ profile: any; questions: any[] }>("/api/profile");
  const { data: followUps, reload: reloadFollowUps } = useApi<{ interactions: any[] }>(
    "/api/interactions?upcoming=1"
  );

  const jobs = jobsData?.jobs ?? [];
  const applied = jobs.filter((j) =>
    ["applied", "replied", "interview", "offer"].includes(j.status)
  );
  const active = jobs.filter((j) => !["rejected"].includes(j.status));
  const interviews = jobs.filter((j) => ["interview", "offer"].includes(j.status));
  const replyRate = applied.length
    ? Math.round(
        (jobs.filter((j) => ["replied", "interview", "offer"].includes(j.status)).length /
          applied.length) *
          100
      )
    : null;
  const hasProfile = (profileData?.profile?.raw_cv ?? "").length > 50;
  const [hasKey, setHasKey] = useState(true);
  useEffect(() => setHasKey(Boolean(loadDb().settings.apiKey)), []);
  const greeting = greetings[new Date().getDate() % greetings.length];
  const today = new Date().toISOString().slice(0, 10);
  const due = (followUps?.interactions ?? []).filter(
    (i) => (i.follow_up_date ?? "") <= today
  );
  const upcoming = (followUps?.interactions ?? []).filter(
    (i) => (i.follow_up_date ?? "") > today
  );
  const best = [...jobs]
    .filter((j) => j.score != null && j.status === "lead")
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return (
    <div>
      <PageHeader title="Dashboard" subtitle={greeting}>
        <Link href="/jobs" className="btn-primary">
          + Add a job
        </Link>
      </PageHeader>

      {!hasKey && (
        <Link
          href="/settings"
          className="card mb-6 flex items-center justify-between gap-4 border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-5 transition hover:shadow-lift"
        >
          <div>
            <p className="font-bold text-amber-900">First: add your Anthropic API key</p>
            <p className="mt-0.5 text-sm text-ink-500">
              It stays on this device and unlocks match scoring, CV tailoring and chat.
            </p>
          </div>
          <span className="btn-primary shrink-0">Open Settings →</span>
        </Link>
      )}

      {!hasProfile && (
        <Link
          href="/profile"
          className="card mb-6 flex items-center justify-between gap-4 border-indigo-200 bg-gradient-to-r from-indigo-50 to-fuchsia-50 p-5 transition hover:shadow-lift"
        >
          <div>
            <p className="font-bold text-indigo-900">Start here: add your CV</p>
            <p className="mt-0.5 text-sm text-ink-500">
              Once I know your profile, I can score every job against it and tailor your CV.
            </p>
          </div>
          <span className="btn-primary shrink-0">Set up profile →</span>
        </Link>
      )}

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Active opportunities" value={active.length} note="in your pipeline" />
        <Stat label="Applications sent" value={applied.length} note="keep the reps coming" />
        <Stat
          label="Reply rate"
          value={replyRate == null ? "—" : `${replyRate}%`}
          note={replyRate == null ? "apply to unlock" : "of applications got a response"}
        />
        <Stat
          label="Interviews & offers"
          value={interviews.length}
          note={interviews.length ? "you're in the room 🎉" : "they're coming"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-6 animate-rise">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold text-ink-900">Follow-ups</h2>
            <Link href="/pipeline" className="text-xs font-semibold text-indigo-600 hover:underline">
              View pipeline →
            </Link>
          </div>
          {due.length === 0 && upcoming.length === 0 ? (
            <Empty text="No follow-ups scheduled. Log a meeting or reply and set a follow-up date — persistence wins offers." />
          ) : (
            <ul className="space-y-2.5">
              {[...due, ...upcoming].slice(0, 6).map((i) => (
                <li
                  key={i.id}
                  className={`flex items-start justify-between gap-3 rounded-xl border p-3 ${
                    (i.follow_up_date ?? "") <= today
                      ? "border-amber-200 bg-amber-50/60"
                      : "border-ink-200/70 bg-ink-50/50"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink-800">
                      {i.job_title
                        ? `${i.job_title} — ${i.job_company}`
                        : i.contact_name || "General"}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-ink-500">{i.content}</p>
                    <p className="mt-1 text-xs font-semibold text-ink-400">
                      {(i.follow_up_date ?? "") <= today ? "Due" : "On"} {i.follow_up_date}
                    </p>
                  </div>
                  <button
                    className="btn-secondary !px-2.5 !py-1 text-xs"
                    onClick={async () => {
                      await api("/api/interactions", {
                        method: "PATCH",
                        body: JSON.stringify({ id: i.id, follow_up_done: true }),
                      });
                      reloadFollowUps();
                    }}
                  >
                    Done ✓
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-6 animate-rise">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold text-ink-900">Best open matches</h2>
            <Link href="/jobs" className="text-xs font-semibold text-indigo-600 hover:underline">
              All jobs →
            </Link>
          </div>
          {loading ? (
            <Spinner label="Loading…" />
          ) : best.length === 0 ? (
            <Empty text="No scored leads yet. Paste a job link on the Jobs page and I'll tell you how well it fits." />
          ) : (
            <ul className="space-y-2.5">
              {best.map((j) => (
                <li key={j.id}>
                  <Link
                    href={`/job/?id=${j.id}`}
                    className="flex items-center gap-4 rounded-xl border border-ink-200/70 p-3 transition hover:border-indigo-300 hover:shadow-card"
                  >
                    <ScoreRing score={j.score} size={52} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink-900">{j.title}</p>
                      <p className="truncate text-xs text-ink-500">{j.company}</p>
                    </div>
                    <StatusChip status={j.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: number | string;
  note: string;
}) {
  return (
    <div className="card p-5 animate-rise">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</p>
      <p className="mt-2 text-4xl font-extrabold tracking-tight text-ink-900">{value}</p>
      <p className="mt-1 text-xs text-ink-400">{note}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-dashed border-ink-200 p-4 text-sm text-ink-500">
      {text}
    </p>
  );
}
