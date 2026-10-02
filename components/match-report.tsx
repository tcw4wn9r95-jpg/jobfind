"use client";

import { ScoreRing } from "@/components/ui";
import { MatchReport } from "@/lib/report";

/** The report itself — one shared renderer, so the share preview and the
 *  link a recipient opens are the same document. Print-friendly: see the
 *  @media print rules in globals.css. */
export function ReportCard({ report, compact }: { report: MatchReport; compact?: boolean }) {
  const r = report;
  const band =
    r.score >= 70
      ? { label: "Strong match", cls: "bg-emerald-50 text-emerald-700" }
      : r.score >= 50
        ? { label: "Worth a shot", cls: "bg-amber-50 text-amber-700" }
        : r.score >= 30
          ? { label: "Stretch", cls: "bg-orange-50 text-orange-700" }
          : { label: "Long shot", cls: "bg-rose-50 text-rose-700" };

  return (
    <article className="report-sheet rounded-2xl bg-white p-6 text-ink-800 sm:p-8">
      <header className="flex flex-wrap items-start gap-5 border-b border-ink-200/70 pb-5">
        <ScoreRing score={r.score} size={compact ? 76 : 92} />
        <div className="min-w-0 flex-1">
          {r.person && (
            <p className="text-xs font-bold uppercase tracking-wide text-indigo-600">
              {r.person}
            </p>
          )}
          <h1
            className={`break-words font-extrabold leading-tight text-ink-900 ${compact ? "text-lg" : "text-2xl"}`}
          >
            {r.title}
          </h1>
          <p className="mt-0.5 text-sm text-ink-500">
            {[r.company, r.location].filter(Boolean).join(" · ")}
          </p>
          <span className={`chip mt-2 inline-block ${band.cls}`}>
            {band.label} · {r.score}/100
          </span>
        </div>
      </header>

      {r.verdict && (
        <p className={`mt-5 leading-relaxed text-ink-700 ${compact ? "text-sm" : "text-base"}`}>
          {r.verdict}
        </p>
      )}

      <Section
        title={r.person ? "Why they fit" : "Why I fit"}
        items={r.strengths}
        marker="✓"
        markerClass="text-emerald-600"
      />
      <Section title="Gaps to address" items={r.gaps} marker="!" markerClass="text-amber-600" />
      <Section title="Next steps" items={r.actions} marker="→" markerClass="text-indigo-600" />

      <footer className="mt-7 border-t border-ink-200/70 pt-3 text-xs text-ink-400">
        Match report · {r.created} · analysed with Claude
      </footer>
    </article>
  );
}

function Section({
  title,
  items,
  marker,
  markerClass,
}: {
  title: string;
  items: string[];
  marker: string;
  markerClass: string;
}) {
  if (!items.length) return null;
  return (
    <section className="mt-5 break-inside-avoid">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-500">{title}</h2>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2 text-sm leading-relaxed text-ink-700">
            <span className={`font-bold ${markerClass}`}>{marker}</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
