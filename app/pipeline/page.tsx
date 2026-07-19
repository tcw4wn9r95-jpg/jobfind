"use client";

import Link from "next/link";
import { useState } from "react";
import { PageHeader, ScoreRing, Spinner, STATUS_META, api, useApi } from "@/components/ui";

const COLUMNS = ["lead", "applied", "replied", "interview", "offer", "rejected"];

export default function PipelinePage() {
  const { data, loading, reload } = useApi<{ jobs: any[] }>("/api/jobs");
  const [dragId, setDragId] = useState<number | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const jobs = data?.jobs ?? [];

  async function setJobStatus(jobId: number, status: string) {
    await api(`/api/jobs/${jobId}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    reload();
  }

  async function moveTo(status: string) {
    if (dragId == null) return;
    const job = jobs.find((j) => j.id === dragId);
    setDragId(null);
    setOverCol(null);
    if (!job || job.status === status) return;
    await setJobStatus(job.id, status);
  }

  // Touch devices don't fire HTML5 drag events — give each card step buttons too
  function step(job: any, dir: -1 | 1) {
    const idx = COLUMNS.indexOf(job.status);
    const next = COLUMNS[idx + dir];
    if (next) setJobStatus(job.id, next);
  }

  return (
    <div>
      <PageHeader
        title="Pipeline"
        subtitle="Drag cards — or tap the arrows — to move roles between stages. A full pipeline is a healthy pipeline."
      />
      {loading ? (
        <Spinner label="Loading…" />
      ) : (
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0 xl:grid xl:grid-cols-6 xl:overflow-visible">
          {COLUMNS.map((col) => {
            const colJobs = jobs.filter((j) => j.status === col);
            const meta = STATUS_META[col];
            return (
              <div
                key={col}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverCol(col);
                }}
                onDragLeave={() => setOverCol((c) => (c === col ? null : c))}
                onDrop={() => moveTo(col)}
                className={`flex min-h-[300px] w-64 shrink-0 snap-start flex-col rounded-2xl border p-3 transition xl:w-auto ${
                  overCol === col
                    ? "border-indigo-400 bg-indigo-50/70"
                    : "border-ink-200/60 bg-white/50"
                }`}
              >
                <div className="mb-3 flex items-center justify-between px-1">
                  <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-600">
                    <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                    {meta.label}
                  </span>
                  <span className="text-xs font-semibold text-ink-400">{colJobs.length}</span>
                </div>
                <div className="flex flex-1 flex-col gap-2">
                  {colJobs.map((j) => (
                    <Link
                      key={j.id}
                      href={`/jobs/${j.id}`}
                      draggable
                      onDragStart={() => setDragId(j.id)}
                      onDragEnd={() => setDragId(null)}
                      className={`card cursor-grab p-3 transition hover:border-indigo-300 active:cursor-grabbing ${
                        dragId === j.id ? "opacity-40" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="line-clamp-2 text-sm font-semibold leading-snug text-ink-900">
                          {j.title}
                        </p>
                        <div className="shrink-0">
                          <ScoreRing score={j.score} size={34} />
                        </div>
                      </div>
                      <p className="mt-1 truncate text-xs text-ink-500">{j.company}</p>
                      <div className="mt-2 flex justify-between gap-1">
                        <button
                          aria-label="Move to previous stage"
                          className={`rounded-lg border border-ink-200 px-2 py-0.5 text-xs font-bold text-ink-500 hover:border-indigo-300 hover:text-indigo-600 ${
                            COLUMNS.indexOf(j.status) === 0 ? "invisible" : ""
                          }`}
                          onClick={(e) => {
                            e.preventDefault();
                            step(j, -1);
                          }}
                        >
                          ←
                        </button>
                        <button
                          aria-label="Move to next stage"
                          className={`rounded-lg border border-ink-200 px-2 py-0.5 text-xs font-bold text-ink-500 hover:border-indigo-300 hover:text-indigo-600 ${
                            COLUMNS.indexOf(j.status) === COLUMNS.length - 1 ? "invisible" : ""
                          }`}
                          onClick={(e) => {
                            e.preventDefault();
                            step(j, 1);
                          }}
                        >
                          →
                        </button>
                      </div>
                    </Link>
                  ))}
                  {colJobs.length === 0 && (
                    <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-ink-200 text-xs text-ink-300">
                      drop here
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
