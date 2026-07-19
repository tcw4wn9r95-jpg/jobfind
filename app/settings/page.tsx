"use client";

import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/ui";
import { exportJson, importJson, loadDb, mutate, resetDb } from "@/lib/localdb";

const MODELS = [
  { id: "claude-sonnet-5", label: "Claude Sonnet 5 — best balance (default)" },
  { id: "claude-opus-4-8", label: "Claude Opus 4.8 — most thorough" },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 — fastest/cheapest" },
];

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("claude-sonnet-5");
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const { settings } = loadDb();
    setApiKey(settings.apiKey);
    setModel(settings.model || "claude-sonnet-5");
  }, []);

  function save() {
    mutate((db) => {
      db.settings.apiKey = apiKey.trim();
      db.settings.model = model;
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function backup() {
    const blob = new Blob([exportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jobfind-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function restore(file: File) {
    try {
      importJson(await file.text());
      setMessage("Backup restored — your data is back. ✓");
      const { settings } = loadDb();
      setApiKey(settings.apiKey);
      setModel(settings.model);
    } catch (e: any) {
      setMessage(`Restore failed: ${e.message}`);
    }
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Everything — your data and your API key — stays on this device, in this browser."
      />

      <section className="card mb-6 max-w-2xl p-6 animate-rise">
        <h2 className="font-bold text-ink-900">Anthropic API key</h2>
        <p className="mt-1 text-sm text-ink-500">
          Powers the CV analysis, match scoring, tailoring and chat. Create one at{" "}
          <a
            className="font-semibold text-indigo-600 hover:underline"
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noreferrer"
          >
            console.anthropic.com
          </a>
          . It's stored only in this browser and sent only to Anthropic.
        </p>
        <input
          type="password"
          className="input mt-4 font-mono"
          placeholder="sk-ant-…"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />
        <label className="label mt-4">Model</label>
        <select className="input" value={model} onChange={(e) => setModel(e.target.value)}>
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <button className="btn-primary mt-4" onClick={save}>
          {saved ? "Saved ✓" : "Save"}
        </button>
      </section>

      <section className="card max-w-2xl p-6 animate-rise">
        <h2 className="font-bold text-ink-900">Your data</h2>
        <p className="mt-1 text-sm text-ink-500">
          Lives in this browser only — it doesn't sync between devices, and clearing the
          browser's site data would erase it. Download a backup now and then, and restore it
          here on any device.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button className="btn-secondary" onClick={backup}>
            ⬇ Download backup
          </button>
          <button className="btn-secondary" onClick={() => fileRef.current?.click()}>
            ⬆ Restore backup
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])}
          />
          <button
            className="btn-ghost text-rose-500 hover:bg-rose-50"
            onClick={() => {
              if (confirm("Erase ALL JobFind data on this device? This cannot be undone.")) {
                resetDb();
                setMessage("All data erased.");
                setApiKey("");
              }
            }}
          >
            Erase everything
          </button>
        </div>
        {message && <p className="mt-3 text-sm font-medium text-ink-700">{message}</p>}
      </section>

      <VersionCard />
    </div>
  );
}

const RUNNING_SHA = process.env.NEXT_PUBLIC_BUILD_SHA || "dev";
const RUNNING_BUILT_AT = process.env.NEXT_PUBLIC_BUILD_TIME || "";

function VersionCard() {
  const [status, setStatus] = useState<
    "idle" | "checking" | "latest" | "outdated" | "error"
  >("idle");
  const [latestSha, setLatestSha] = useState<string | null>(null);

  async function checkForUpdates() {
    setStatus("checking");
    try {
      const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
      // no-store: this file is small and must never be served from a stale
      // cache, unlike the app shell itself which browsers/PWAs hold onto.
      const res = await fetch(`${base}/version.json?t=${Date.now()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setLatestSha(data.sha);
      setStatus(data.sha === RUNNING_SHA ? "latest" : "outdated");
    } catch {
      setStatus("error");
    }
  }

  return (
    <section className="card mt-6 max-w-2xl p-6 animate-rise">
      <h2 className="font-bold text-ink-900">App version</h2>
      <p className="mt-1 text-sm text-ink-500">
        Running build{" "}
        <code className="rounded bg-ink-100 px-1.5 py-0.5 text-xs font-semibold text-ink-700">
          {RUNNING_SHA}
        </code>
        {RUNNING_BUILT_AT && ` · built ${RUNNING_BUILT_AT.replace("T", " ").slice(0, 16)} UTC`}
      </p>
      <button className="btn-secondary mt-4" onClick={checkForUpdates} disabled={status === "checking"}>
        {status === "checking" ? "Checking…" : "Check for updates"}
      </button>
      {status === "latest" && (
        <p className="mt-3 text-sm font-medium text-emerald-600">
          ✓ You're on the latest version.
        </p>
      )}
      {status === "outdated" && (
        <div className="mt-3 text-sm">
          <p className="font-medium text-amber-600">
            A newer version is live (build {latestSha}) — this install is behind.
          </p>
          <p className="mt-1 text-ink-500">
            Remove JobFind from your home screen and re-add it from the site to update: your
            data stays put, only the app code refreshes. (A plain browser reload sometimes
            works too, but installed home-screen apps often hold onto the old code until
            reinstalled.)
          </p>
        </div>
      )}
      {status === "error" && (
        <p className="mt-3 text-sm font-medium text-rose-600">
          Couldn't reach the update check — you may be offline.
        </p>
      )}
    </section>
  );
}
