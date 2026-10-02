"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { Markdown, PageHeader, ScoreRing, Spinner, api, useApi } from "@/components/ui";
import { CvPreview } from "@/components/cv-preview";
import { InterviewCoach } from "@/components/interview-prep";
import { ShareReport } from "@/components/share-report";
import { downloadCv } from "@/lib/cvdocx";
import { buildReport } from "@/lib/report";

type Tab = "match" | "cv" | "interview" | "chat";

export default function CoachSessionPage() {
  return (
    <Suspense fallback={<Spinner label="Loading…" />}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const id = useSearchParams().get("id") ?? "";
  const { data, loading, reload } = useApi<any>(`/api/coach/${id}`);
  const [tab, setTab] = useState<Tab>("match");
  const [chatSeed, setChatSeed] = useState("");
  const router = useRouter();

  if (loading) return <Spinner label="Loading…" />;
  if (!data?.session) return <p className="text-ink-500">Session not found.</p>;
  const s = data.session;
  const analysis = safeParse(s.analysis);

  return (
    <div>
      <div className="mb-2 text-sm">
        <Link href="/coach" className="font-semibold text-indigo-600 hover:underline">
          ← All coaching sessions
        </Link>
      </div>
      <PageHeader
        title={s.person || "Unnamed person"}
        subtitle={`${s.job_title}${s.company ? ` · ${s.company}` : ""}${s.location ? ` · ${s.location}` : ""}`}
      />

      <div className="card mb-6 border-indigo-200 bg-indigo-50/40 p-3 animate-rise">
        <p className="text-xs text-ink-600">
          <span className="font-bold text-ink-800">Separate workspace.</span> Everything here
          belongs to this session only — it never mixes with your own profile or pipeline.
        </p>
      </div>

      <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl bg-ink-100/80 p-1">
        {(
          [
            ["match", "Match analysis"],
            ["cv", `Tailored CV${s.cvs.length ? ` (${s.cvs.length})` : ""}`],
            ["interview", `Interview coach${s.preps.length ? ` (${s.preps.length})` : ""}`],
            ["chat", "Claude chat"],
          ] as [Tab, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition ${
              tab === value ? "bg-white text-indigo-700 shadow-card" : "text-ink-500 hover:text-ink-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "match" && <MatchTab session={s} analysis={analysis} />}
      {tab === "cv" && <CvTab session={s} reload={reload} />}
      {tab === "interview" && (
        <InterviewCoach
          apiPath={`/api/coach/${id}`}
          job={{ title: s.job_title, company: s.company }}
          preps={s.preps}
          person={s.person || "this candidate"}
          reload={reload}
          onPractice={(stage) => {
            setChatSeed(
              `Let's run a mock ${stage.toLowerCase()} for ${s.person || "this candidate"}. Play the interviewer: ask one question at a time, wait for the answer I give on their behalf, then give short specific feedback before the next question. Start with your first question.`
            );
            setTab("chat");
          }}
        />
      )}
      {tab === "chat" && (
        <ChatTab
          id={id}
          messages={s.messages}
          reload={reload}
          seed={chatSeed}
          onSeedUsed={() => setChatSeed("")}
        />
      )}

      <div className="mt-10 text-right">
        <button
          className="btn-ghost text-xs text-rose-500 hover:bg-rose-50"
          onClick={async () => {
            if (confirm(`Delete this coaching session and all of ${s.person || "their"} data?`)) {
              await api(`/api/coach/${id}`, { method: "DELETE" });
              router.push("/coach");
            }
          }}
        >
          Delete session
        </button>
      </div>
    </div>
  );
}

function MatchTab({ session, analysis }: { session: any; analysis: any }) {
  return (
    <div className="grid gap-6 lg:grid-cols-3 animate-rise">
      <div className="card flex flex-col items-center p-6 text-center">
        <ScoreRing score={session.score} size={120} />
        <p className="mt-3 text-sm font-bold text-ink-800">Match score</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">{analysis.verdict}</p>
        <div className="mt-4 w-full">
          <ShareReport
            report={buildReport({
              person: session.person,
              title: session.job_title,
              company: session.company,
              location: session.location,
              score: session.score,
              analysis,
            })}
          />
        </div>
      </div>
      <div className="space-y-6 lg:col-span-2">
        <List title="Why they fit" items={analysis.strengths} marker="✓" />
        <List title="Gaps to address" items={analysis.gaps} marker="!" />
        <List title="Recommendations" items={analysis.recommendations} marker="→" />
        <details className="card p-5">
          <summary className="cursor-pointer text-sm font-bold text-ink-900">
            Job description
          </summary>
          <p className="mt-3 whitespace-pre-wrap text-xs leading-relaxed text-ink-600">
            {session.job_description}
          </p>
        </details>
      </div>
    </div>
  );
}

function List({ title, items, marker }: { title: string; items?: string[]; marker: string }) {
  if (!items?.length) return null;
  return (
    <div className="card p-5">
      <h3 className="mb-3 text-sm font-bold text-ink-900">{title}</h3>
      <ul className="space-y-2">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2 text-sm leading-relaxed text-ink-600">
            <span className="font-bold text-indigo-500">{marker}</span>
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CvTab({ session, reload }: { session: any; reload: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState(0);
  const cvs = [...session.cvs].sort((a: any, b: any) => b.version - a.version);
  const cv = cvs[selected];

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/coach/${session.id}/cv`, { method: "POST" });
      setSelected(0);
      reload();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="animate-rise">
      <section className="card mb-6 p-6">
        <h2 className="font-bold text-ink-900">Tailored CV for {session.person || "them"}</h2>
        <p className="mt-1 max-w-xl text-xs leading-relaxed text-ink-500">
          Same template and the same rules as your own: built only from what their CV actually
          says, keyword-matched for ATS parsers. Their contact details come from their CV — yours
          are never used here.
        </p>
        <button className="btn-primary mt-4" onClick={generate} disabled={busy}>
          {busy ? <Spinner label="Writing…" /> : cvs.length ? "Regenerate (new version)" : "Generate tailored CV ✨"}
        </button>
        {error && <p className="mt-3 text-sm font-medium text-rose-600">{error}</p>}
      </section>

      {cvs.length > 0 && cv && (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {cvs.map((c: any, i: number) => (
              <button
                key={c.id}
                onClick={() => setSelected(i)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-semibold ${
                  i === selected ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-ink-200 text-ink-600"
                }`}
              >
                Version {c.version}
              </button>
            ))}
          </div>
          <div className="mb-3 flex flex-wrap gap-2">
            <button
              className="btn-secondary"
              onClick={() => downloadCv(cv.content, session.company, cv.version, "docx", session.contact)}
            >
              ⬇ Download .docx
            </button>
            <button
              className="btn-secondary"
              onClick={() => downloadCv(cv.content, session.company, cv.version, "md", session.contact)}
            >
              ⬇ Markdown
            </button>
          </div>
          <div className="card p-8">
            <CvPreview content={cv.content} contact={session.contact} />
          </div>
        </>
      )}
    </div>
  );
}

function ChatTab({
  id,
  messages,
  reload,
  seed,
  onSeedUsed,
}: {
  id: string;
  messages: any[];
  reload: () => void;
  seed?: string;
  onSeedUsed?: () => void;
}) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (seed) {
      setInput(seed);
      onSeedUsed?.();
    }
  }, [seed, onSeedUsed]);

  async function send() {
    const message = input.trim();
    if (!message || busy) return;
    setBusy(true);
    setError(null);
    setInput("");
    try {
      await api(`/api/coach/${id}/chat`, { method: "POST", body: JSON.stringify({ message }) });
      reload();
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (e: any) {
      setError(e.message);
      setInput(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card flex h-[70vh] min-h-[420px] flex-col animate-rise md:h-[600px]">
      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {messages.length === 0 && (
          <p className="mx-auto max-w-md pt-10 text-center text-sm text-ink-500">
            Ask anything about coaching them through this application — cover letters, how to
            frame a gap, what to push them on before the interview.
          </p>
        )}
        {messages.map((m: any) => (
          <div
            key={m.id}
            className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              m.role === "user"
                ? "ml-auto bg-indigo-600 text-white"
                : "bg-ink-100/70 text-ink-800"
            }`}
          >
            {m.role === "user" ? m.content : <Markdown text={m.content} />}
          </div>
        ))}
        {busy && <Spinner label="Thinking…" />}
        <div ref={bottomRef} />
      </div>
      {error && <p className="px-5 pb-2 text-sm font-medium text-rose-600">{error}</p>}
      <div className="flex gap-2 border-t border-ink-200/70 p-3">
        <textarea
          className="input min-h-[44px] flex-1 text-sm"
          rows={1}
          placeholder="Ask about their application…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button className="btn-primary shrink-0" onClick={send} disabled={busy || !input.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}

function safeParse(s: string | null) {
  try {
    return JSON.parse(s ?? "{}");
  } catch {
    return {};
  }
}
