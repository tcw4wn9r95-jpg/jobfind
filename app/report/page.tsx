"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ReportCard } from "@/components/match-report";
import { Spinner } from "@/components/ui";
import { MatchReport, decodeReport, reportToText } from "@/lib/report";

/**
 * Standalone view for a shared report. Reads the payload from the URL
 * fragment, so it needs no server, no account, no API key and no stored
 * data — a recipient who has never used the app can open it.
 */
export default function ReportPage() {
  const [state, setState] = useState<{ report?: MatchReport; failed?: boolean }>({});
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    async function load() {
      const report = await decodeReport(window.location.hash);
      if (!live) return;
      setState(report ? { report } : { failed: true });
    }
    load();
    // Re-decode if the fragment changes (e.g. a second link pasted in place).
    const onHash = () => load();
    window.addEventListener("hashchange", onHash);
    return () => {
      live = false;
      window.removeEventListener("hashchange", onHash);
    };
  }, []);

  if (state.failed) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <p className="text-lg font-bold text-ink-800">This report link looks incomplete</p>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-500">
          The report travels inside the link itself, so a link that was cut short by a chat app
          or email client can&apos;t be opened. Ask for it again — pasted as one piece, or as
          plain text.
        </p>
        <Link href="/" className="btn-secondary mt-6 inline-block no-print">
          Go to JobFind
        </Link>
      </div>
    );
  }

  if (!state.report) return <Spinner label="Opening report…" />;
  const report = state.report;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="report-sheet-wrap overflow-hidden rounded-2xl shadow-card ring-1 ring-ink-200/70">
        <ReportCard report={report} />
      </div>

      <div className="no-print mt-5 flex flex-wrap items-center gap-2">
        <button className="btn-secondary" onClick={() => window.print()}>
          🖨 Print / save as PDF
        </button>
        <button
          className="btn-secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(
                reportToText(report, window.location.href)
              );
              setCopied(true);
              setTimeout(() => setCopied(false), 2500);
            } catch {
              setCopied(false);
            }
          }}
        >
          📝 Copy as text
        </button>
        {copied && <span className="text-xs font-bold text-emerald-700">✓ Copied</span>}
      </div>

      <p className="no-print mt-5 text-xs leading-relaxed text-ink-400">
        This is a shared summary of one job-match analysis. It was decoded from the link in your
        address bar — nothing was fetched, and no one was notified that you opened it.
      </p>
    </div>
  );
}
