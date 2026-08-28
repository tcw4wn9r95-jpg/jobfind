"use client";

import { useState } from "react";
import { Spinner, api } from "@/components/ui";
import { INTERVIEW_STAGES, InterviewPrep, parsePrep, prepToText } from "@/lib/interview";

type PrepRecord = { id: number; stage: string; content: string; created_at: string };

export function InterviewCoach({
  jobId,
  job,
  preps,
  reload,
  onPractice,
}: {
  jobId: number;
  job: any;
  preps: PrepRecord[];
  reload: () => void;
  onPractice: (stage: string) => void;
}) {
  const [stage, setStage] = useState<string>(preps[0]?.stage ?? INTERVIEW_STAGES[1]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = preps.find((p) => p.stage === stage);
  const prep = current ? parsePrep(current.content) : null;

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/jobs/${jobId}/interview`, {
        method: "POST",
        body: JSON.stringify({ stage }),
      });
      reload();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function download() {
    if (!prep) return;
    const text = prepToText(prep, job.title, job.company);
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Interview-prep-${(job.company || "role").replace(/[^\w-]+/g, "_")}-${stage.replace(/[^\w-]+/g, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="animate-rise">
      <section className="card mb-6 p-6">
        <h2 className="font-bold text-ink-900">Interview coach</h2>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-ink-500">
          A prep pack built only from your real experience: talking points, a STAR story bank,
          the questions they&apos;ll ask, the hard challenges they&apos;ll push on, and what to
          ask them. Each round is scored differently, so pick the stage you&apos;re facing.
        </p>

        <label className="label mt-4">Interview stage</label>
        <div className="flex flex-wrap gap-2">
          {INTERVIEW_STAGES.map((s) => {
            const has = preps.some((p) => p.stage === s);
            return (
              <button
                key={s}
                onClick={() => setStage(s)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                  stage === s
                    ? "border-indigo-400 bg-indigo-50 text-indigo-700"
                    : "border-ink-200 text-ink-600 hover:border-indigo-300"
                }`}
              >
                {s}
                {has && <span className="ml-1.5 text-emerald-600">●</span>}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn-primary" onClick={generate} disabled={busy}>
            {busy ? (
              <Spinner label="Building your prep…" />
            ) : prep ? (
              "Regenerate this stage"
            ) : (
              "Build my prep pack ✨"
            )}
          </button>
          {prep && (
            <>
              <button className="btn-secondary" onClick={() => onPractice(stage)}>
                🎤 Practice with Claude
              </button>
              <button className="btn-secondary" onClick={download}>
                ⬇ Download
              </button>
            </>
          )}
        </div>
        {error && <p className="mt-3 text-sm font-medium text-rose-600">{error}</p>}
        {busy && (
          <p className="mt-3 text-xs text-ink-400 animate-pulseSoft">
            Reading your profile, the job spec and your match analysis — usually 20–40 seconds.
          </p>
        )}
      </section>

      {!prep && !busy && (
        <div className="card p-10 text-center">
          <p className="text-lg font-bold text-ink-800">No prep pack for this stage yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-500">
            Pick the stage above and build one. Everything is grounded in your actual profile —
            no invented stories, and honest handling of the gaps they&apos;ll probe.
          </p>
        </div>
      )}

      {prep && <PrepBody prep={prep} generatedAt={current!.created_at} />}
    </div>
  );
}

function PrepBody({ prep, generatedAt }: { prep: InterviewPrep; generatedAt: string }) {
  return (
    <div className="space-y-5">
      <p className="text-xs text-ink-400">Generated {generatedAt.slice(0, 16)}</p>

      {prep.stage_focus && (
        <Card title="What this round is really testing" tone="indigo">
          <p className="text-sm leading-relaxed text-ink-700">{prep.stage_focus}</p>
        </Card>
      )}

      {prep.talking_points.length > 0 && (
        <Card title="Core talking points">
          <ul className="space-y-3">
            {prep.talking_points.map((t, i) => (
              <li key={i}>
                <p className="text-sm font-bold text-ink-900">{t.headline}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-ink-600">{t.detail}</p>
                {t.evidence && (
                  <p className="mt-1 text-xs text-ink-500">
                    <span className="font-semibold text-emerald-700">Evidence:</span> {t.evidence}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {prep.star_stories.length > 0 && (
        <Card
          title={`STAR story bank (${prep.star_stories.length})`}
          subtitle="Aim for 60–90 seconds each: brief setup, most of your time on what YOU did, close on the number."
        >
          <div className="space-y-3">
            {prep.star_stories.map((s, i) => (
              <details key={i} className="rounded-xl border border-ink-200/70 p-3" open={i === 0}>
                <summary className="cursor-pointer text-sm font-bold text-ink-900">
                  {s.title}
                </summary>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {s.competencies.map((c, j) => (
                    <span key={j} className="chip bg-violet-50 text-violet-700">
                      {c}
                    </span>
                  ))}
                </div>
                <dl className="mt-3 space-y-2 text-sm">
                  <Star label="Situation" text={s.situation} />
                  <Star label="Task" text={s.task} />
                  <Star label="Action" text={s.action} emphasis />
                  <Star label="Result" text={s.result} />
                </dl>
                {s.also_answers.length > 0 && (
                  <p className="mt-3 text-xs text-ink-500">
                    <span className="font-semibold">Also answers:</span>{" "}
                    {s.also_answers.join(" · ")}
                  </p>
                )}
              </details>
            ))}
          </div>
        </Card>
      )}

      {prep.likely_questions.length > 0 && (
        <Card title={`Questions they'll likely ask (${prep.likely_questions.length})`}>
          <div className="space-y-3">
            {prep.likely_questions.map((q, i) => (
              <div key={i} className="rounded-xl border border-ink-200/70 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="flex-1 text-sm font-semibold text-ink-900">“{q.question}”</p>
                  <span className="chip bg-ink-100 text-ink-600">{q.category}</span>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{q.approach}</p>
                {q.use_story && (
                  <p className="mt-1 text-xs font-semibold text-indigo-600">→ {q.use_story}</p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {prep.challenges.length > 0 && (
        <Card
          title="Hard challenges they'll push on"
          subtitle="Your real gaps, and honest answers for them — acknowledge, then redirect to evidence."
          tone="amber"
        >
          <div className="space-y-3">
            {prep.challenges.map((c, i) => (
              <div key={i} className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
                <p className="text-sm font-bold text-amber-900">“{c.challenge}”</p>
                <p className="mt-1 text-xs text-ink-500">{c.why_it_comes_up}</p>
                <p className="mt-2 text-sm leading-relaxed text-ink-700">
                  <span className="font-semibold">Your answer:</span> {c.response}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {prep.questions_to_ask.length > 0 && (
        <Card title="Questions to ask them" subtitle="None of these are answerable from the website.">
          <ul className="space-y-2.5">
            {prep.questions_to_ask.map((q, i) => (
              <li key={i}>
                <p className="text-sm font-semibold text-ink-900">{q.question}</p>
                <p className="mt-0.5 text-xs text-ink-500">{q.why}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {prep.research_checklist.length > 0 && (
        <Card title="Research before you go">
          <ul className="space-y-1.5">
            {prep.research_checklist.map((r, i) => (
              <li key={i} className="flex gap-2 text-sm text-ink-700">
                <span className="text-ink-300">☐</span>
                {r}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {(prep.compensation.guidance || prep.compensation.notes.length > 0) && (
        <Card title="Money talk">
          {prep.compensation.guidance && (
            <p className="text-sm leading-relaxed text-ink-700">{prep.compensation.guidance}</p>
          )}
          {prep.compensation.notes.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {prep.compensation.notes.map((n, i) => (
                <li key={i} className="flex gap-2 text-sm text-ink-600">
                  <span className="text-ink-300">•</span>
                  {n}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}

function Star({ label, text, emphasis }: { label: string; text: string; emphasis?: boolean }) {
  if (!text) return null;
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-wide text-ink-400">{label}</dt>
      <dd className={`leading-relaxed ${emphasis ? "text-ink-900" : "text-ink-600"}`}>{text}</dd>
    </div>
  );
}

function Card({
  title,
  subtitle,
  tone,
  children,
}: {
  title: string;
  subtitle?: string;
  tone?: "indigo" | "amber";
  children: React.ReactNode;
}) {
  const border =
    tone === "indigo" ? "border-indigo-200" : tone === "amber" ? "border-amber-200" : "";
  return (
    <section className={`card p-5 ${border}`}>
      <h3 className="font-bold text-ink-900">{title}</h3>
      {subtitle && <p className="mb-3 mt-0.5 text-xs text-ink-500">{subtitle}</p>}
      <div className={subtitle ? "" : "mt-3"}>{children}</div>
    </section>
  );
}
