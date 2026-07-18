"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  Markdown,
  PageHeader,
  ScoreRing,
  Spinner,
  STATUS_META,
  StatusChip,
  api,
  useApi,
} from "@/components/ui";

type Tab = "match" | "cv" | "chat" | "activity";

export default function JobPage({ params }: { params: { id: string } }) {
  const { data, loading, reload } = useApi<any>(`/api/jobs/${params.id}`);
  const [tab, setTab] = useState<Tab>("match");
  const router = useRouter();

  if (loading) return <Spinner label="Loading…" />;
  if (!data?.job) return <p className="text-ink-500">Job not found.</p>;
  const { job, cvs, messages, interactions, contacts } = data;
  const analysis = safeParse(job.analysis);

  async function setStatus(status: string) {
    await api(`/api/jobs/${params.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    reload();
  }

  return (
    <div>
      <div className="mb-2 text-sm">
        <Link href="/jobs" className="font-semibold text-indigo-600 hover:underline">
          ← All jobs
        </Link>
      </div>
      <PageHeader
        title={job.title || "Untitled role"}
        subtitle={`${job.company}${job.location ? ` · ${job.location}` : ""}`}
      >
        <div className="flex items-center gap-3">
          {job.url && (
            <a href={job.url} target="_blank" rel="noreferrer" className="btn-secondary">
              View posting ↗
            </a>
          )}
          <select
            className="input !w-auto font-semibold"
            value={job.status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {Object.entries(STATUS_META).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </select>
        </div>
      </PageHeader>

      <div className="mb-6 flex gap-1 rounded-xl bg-ink-100/80 p-1">
        {(
          [
            ["match", "Match analysis"],
            ["cv", `Tailored CV${cvs.length ? ` (${cvs.length})` : ""}`],
            ["chat", "Claude chat"],
            ["activity", "Activity & contacts"],
          ] as [Tab, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
              tab === value
                ? "bg-white text-indigo-700 shadow-card"
                : "text-ink-500 hover:text-ink-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "match" && (
        <MatchTab job={job} analysis={analysis} onApply={() => { setStatus("applied"); setTab("cv"); }} />
      )}
      {tab === "cv" && <CvTab jobId={params.id} job={job} cvs={cvs} reload={reload} />}
      {tab === "chat" && <ChatTab jobId={params.id} messages={messages} reload={reload} />}
      {tab === "activity" && (
        <ActivityTab jobId={params.id} interactions={interactions} contacts={contacts} reload={reload} />
      )}

      <div className="mt-10 text-right">
        <button
          className="btn-ghost text-xs text-rose-500 hover:bg-rose-50"
          onClick={async () => {
            if (confirm("Delete this job and everything attached to it?")) {
              await api(`/api/jobs/${params.id}`, { method: "DELETE" });
              router.push("/jobs");
            }
          }}
        >
          Delete job
        </button>
      </div>
    </div>
  );
}

function MatchTab({
  job,
  analysis,
  onApply,
}: {
  job: any;
  analysis: any;
  onApply: () => void;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-3 animate-rise">
      <div className="card flex flex-col items-center p-6 text-center">
        <ScoreRing score={job.score} size={120} />
        <p className="mt-3 text-sm font-bold text-ink-800">Match score</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">{analysis.verdict}</p>
        {job.status === "lead" && (
          <button className="btn-primary mt-5 w-full" onClick={onApply}>
            I&apos;m applying — tailor my CV →
          </button>
        )}
      </div>
      <div className="space-y-6 lg:col-span-2">
        <ListCard
          title="Why you fit"
          items={analysis.strengths}
          chipClass="bg-emerald-50 text-emerald-700"
          marker="✓"
        />
        <ListCard
          title="Gaps to address"
          items={analysis.gaps}
          chipClass="bg-amber-50 text-amber-700"
          marker="!"
        />
        <ListCard
          title="Recommendations"
          items={analysis.recommendations}
          chipClass="bg-indigo-50 text-indigo-700"
          marker="→"
        />
        {(analysis.keywords ?? []).length > 0 && (
          <div className="card p-5">
            <h3 className="mb-3 text-sm font-bold text-ink-900">
              Keywords the tailored CV will target
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {analysis.keywords.map((k: string) => (
                <span key={k} className="chip bg-ink-100 text-ink-600">
                  {k}
                </span>
              ))}
            </div>
          </div>
        )}
        <details className="card p-5">
          <summary className="cursor-pointer text-sm font-bold text-ink-900">
            Job description
          </summary>
          <p className="mt-3 whitespace-pre-wrap text-xs leading-relaxed text-ink-600">
            {job.description}
          </p>
        </details>
      </div>
    </div>
  );
}

function ListCard({
  title,
  items,
  chipClass,
  marker,
}: {
  title: string;
  items?: string[];
  chipClass: string;
  marker: string;
}) {
  if (!items?.length) return null;
  return (
    <div className="card p-5">
      <h3 className="mb-3 text-sm font-bold text-ink-900">{title}</h3>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm text-ink-700">
            <span className={`chip mt-0.5 shrink-0 ${chipClass}`}>{marker}</span>
            <span className="leading-relaxed">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CvTab({
  jobId,
  job,
  cvs,
  reload,
}: {
  jobId: string;
  job: any;
  cvs: any[];
  reload: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [driveBusy, setDriveBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState(0);
  const cv = cvs[selected];

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await api(`/api/jobs/${jobId}/cv`, { method: "POST" });
      if (res.driveError) setError(`Saved locally, but Drive upload failed: ${res.driveError}`);
      setSelected(0);
      reload();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function uploadToDrive(cvId: number) {
    setDriveBusy(cvId);
    setError(null);
    try {
      await api(`/api/jobs/${jobId}/cv/${cvId}/drive`, { method: "POST" });
      reload();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDriveBusy(null);
    }
  }

  return (
    <div className="animate-rise">
      <div className="card mb-6 flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <h3 className="font-bold text-ink-900">Tailored CV for {job.company || "this role"}</h3>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-ink-500">
            Rebuilt from your real experience only — nothing invented, reworded to sound like
            you, emphasised for this role. Ask for tweaks in the Claude chat tab.
          </p>
        </div>
        <button className="btn-primary" onClick={generate} disabled={busy}>
          {busy ? (
            <Spinner label="Writing your CV… (~30s)" />
          ) : cvs.length ? (
            "Regenerate (new version)"
          ) : (
            "Generate tailored CV ✨"
          )}
        </button>
      </div>
      {error && <p className="mb-4 text-sm font-medium text-rose-600">{error}</p>}

      {cvs.length === 0 ? (
        <div className="card p-10 text-center text-sm text-ink-500">
          No tailored CV yet — hit the button above and I&apos;ll write one for this exact role.
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-4">
          <div className="space-y-2">
            {cvs.map((c, i) => (
              <button
                key={c.id}
                onClick={() => setSelected(i)}
                className={`w-full rounded-xl border p-3 text-left text-sm transition ${
                  i === selected
                    ? "border-indigo-300 bg-indigo-50/60 font-semibold text-indigo-800"
                    : "border-ink-200 bg-white text-ink-600 hover:border-indigo-200"
                }`}
              >
                Version {c.version}
                <span className="mt-0.5 block text-xs font-normal text-ink-400">
                  {c.created_at?.slice(0, 16)}
                </span>
                {c.drive_link && (
                  <span className="mt-1 block text-xs font-semibold text-emerald-600">
                    ● In Google Drive
                  </span>
                )}
              </button>
            ))}
          </div>
          {cv && (
            <div className="lg:col-span-3">
              <div className="mb-3 flex flex-wrap gap-2">
                <a
                  className="btn-secondary"
                  href={`/api/jobs/${jobId}/cv/${cv.id}/download?format=docx`}
                >
                  ⬇ Download .docx
                </a>
                <a
                  className="btn-secondary"
                  href={`/api/jobs/${jobId}/cv/${cv.id}/download?format=md`}
                >
                  ⬇ Markdown
                </a>
                {cv.drive_link ? (
                  <a className="btn-secondary" href={cv.drive_link} target="_blank" rel="noreferrer">
                    Open in Google Drive ↗
                  </a>
                ) : (
                  <button
                    className="btn-secondary"
                    onClick={() => uploadToDrive(cv.id)}
                    disabled={driveBusy === cv.id}
                  >
                    {driveBusy === cv.id ? <Spinner label="Uploading…" /> : "Save to Google Drive"}
                  </button>
                )}
              </div>
              <div className="card p-8">
                <Markdown text={cv.content} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ChatTab({
  jobId,
  messages,
  reload,
}: {
  jobId: string;
  messages: any[];
  reload: () => void;
}) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function send() {
    const message = input.trim();
    if (!message || busy) return;
    setBusy(true);
    setError(null);
    setInput("");
    try {
      await api(`/api/jobs/${jobId}/chat`, {
        method: "POST",
        body: JSON.stringify({ message }),
      });
      reload();
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 300);
    } catch (e: any) {
      setError(e.message);
      setInput(message);
    } finally {
      setBusy(false);
    }
  }

  const suggestions = [
    "Draft a short cover note for this application",
    "Make the CV punchier — tighten the bullets",
    "Write a follow-up message to the recruiter",
    "How should I prep for a first interview here?",
  ];

  return (
    <div className="card flex h-[600px] flex-col animate-rise">
      <div className="flex-1 space-y-4 overflow-y-auto p-6">
        {messages.length === 0 && (
          <div className="text-center">
            <p className="text-sm font-semibold text-ink-700">
              Your copilot for this application
            </p>
            <p className="mx-auto mt-1 max-w-md text-xs text-ink-500">
              I know your profile, this job, and the tailored CV. Ask for revisions, cover
              letters, follow-ups or interview prep. If I revise the CV, it&apos;s saved as a new
              version automatically.
            </p>
            <div className="mx-auto mt-4 flex max-w-lg flex-wrap justify-center gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  className="chip border border-indigo-100 bg-indigo-50/70 text-indigo-700 hover:bg-indigo-100"
                  onClick={() => setInput(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex"}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white"
                  : "border border-ink-200/70 bg-ink-50"
              }`}
            >
              {m.role === "user" ? (
                <p className="whitespace-pre-wrap">{m.content}</p>
              ) : (
                <Markdown text={m.content} />
              )}
            </div>
          </div>
        ))}
        {busy && <Spinner label="Claude is thinking…" />}
        <div ref={bottomRef} />
      </div>
      {error && <p className="px-6 pb-2 text-sm font-medium text-rose-600">{error}</p>}
      <div className="flex gap-3 border-t border-ink-200/70 p-4">
        <textarea
          className="input min-h-[44px] flex-1 resize-none"
          rows={1}
          placeholder="Ask anything about this application…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button className="btn-primary" onClick={send} disabled={busy || !input.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}

function ActivityTab({
  jobId,
  interactions,
  contacts,
  reload,
}: {
  jobId: string;
  interactions: any[];
  contacts: any[];
  reload: () => void;
}) {
  const [type, setType] = useState("note");
  const [content, setContent] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactRole, setContactRole] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function logInteraction() {
    if (!content.trim()) return;
    setBusy(true);
    try {
      await api("/api/interactions", {
        method: "POST",
        body: JSON.stringify({
          job_id: Number(jobId),
          type,
          content,
          follow_up_date: followUp || null,
        }),
      });
      setContent("");
      setFollowUp("");
      reload();
    } finally {
      setBusy(false);
    }
  }

  async function addContact() {
    if (!contactName.trim()) return;
    setBusy(true);
    try {
      await api("/api/contacts", {
        method: "POST",
        body: JSON.stringify({
          name: contactName,
          role: contactRole,
          email: contactEmail,
          job_id: Number(jobId),
        }),
      });
      setContactName("");
      setContactRole("");
      setContactEmail("");
      reload();
    } finally {
      setBusy(false);
    }
  }

  const typeIcons: Record<string, string> = {
    note: "✎",
    meeting: "🤝",
    call: "📞",
    email: "✉",
    reply: "↩",
    interview: "★",
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3 animate-rise">
      <div className="space-y-6 lg:col-span-2">
        <div className="card p-5">
          <h3 className="mb-3 text-sm font-bold text-ink-900">Log activity</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(typeIcons).map(([t, icon]) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`chip border transition ${
                  type === t
                    ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                    : "border-ink-200 bg-white text-ink-500 hover:border-indigo-200"
                }`}
              >
                {icon} {t}
              </button>
            ))}
          </div>
          <textarea
            className="input mt-3 min-h-[70px]"
            placeholder={
              type === "meeting"
                ? "Who did you meet, what did you discuss, what's next?"
                : "What happened?"
            }
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="text-xs font-semibold text-ink-500">
              Follow up on
              <input
                type="date"
                className="input ml-2 !w-auto !py-1.5"
                value={followUp}
                onChange={(e) => setFollowUp(e.target.value)}
              />
            </label>
            <button className="btn-primary ml-auto" onClick={logInteraction} disabled={busy || !content.trim()}>
              Log it
            </button>
          </div>
        </div>

        <div className="card p-5">
          <h3 className="mb-4 text-sm font-bold text-ink-900">Timeline</h3>
          {interactions.length === 0 ? (
            <p className="text-sm text-ink-500">
              Nothing logged yet. Applied? Got a reply? Met someone? Log it — future-you will
              thank you before the interview.
            </p>
          ) : (
            <ul className="space-y-3">
              {interactions.map((i) => (
                <li key={i.id} className="flex gap-3 rounded-xl border border-ink-200/70 p-3">
                  <span className="text-lg">{typeIcons[i.type] ?? "✎"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="whitespace-pre-wrap text-sm text-ink-700">{i.content}</p>
                    <p className="mt-1 text-xs text-ink-400">
                      {i.happened_at?.slice(0, 16)}
                      {i.contact_name ? ` · with ${i.contact_name}` : ""}
                      {i.follow_up_date && !i.follow_up_done
                        ? ` · follow up ${i.follow_up_date}`
                        : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card h-fit p-5">
        <h3 className="mb-3 text-sm font-bold text-ink-900">People at {`this company`}</h3>
        {contacts.length > 0 && (
          <ul className="mb-4 space-y-2">
            {contacts.map((c) => (
              <li key={c.id} className="rounded-xl border border-ink-200/70 p-3">
                <p className="text-sm font-semibold text-ink-800">{c.name}</p>
                <p className="text-xs text-ink-500">
                  {[c.role, c.email].filter(Boolean).join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        )}
        <div className="space-y-2">
          <input
            className="input"
            placeholder="Name (e.g. hiring manager)"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
          />
          <input
            className="input"
            placeholder="Role"
            value={contactRole}
            onChange={(e) => setContactRole(e.target.value)}
          />
          <input
            className="input"
            placeholder="Email / LinkedIn"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
          />
          <button
            className="btn-secondary w-full"
            onClick={addContact}
            disabled={busy || !contactName.trim()}
          >
            + Add contact
          </button>
        </div>
      </div>
    </div>
  );
}

function safeParse(json: string | null): any {
  try {
    return JSON.parse(json ?? "{}") ?? {};
  } catch {
    return {};
  }
}
