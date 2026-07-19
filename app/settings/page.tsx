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
    </div>
  );
}
