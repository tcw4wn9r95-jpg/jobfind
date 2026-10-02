"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ReportCard } from "@/components/match-report";
import { MatchReport, encodeReport, reportToText, reportUrl } from "@/lib/report";

/**
 * Generate a short report of a match result and share it.
 *
 * The app has no server, so the link carries the report in its fragment —
 * see lib/report.ts. That makes sharing work from a static host and from a
 * phone offline, at the cost of a link anyone can read, which the panel
 * says out loud.
 *
 * It opens as a dialog rather than inline because the preview is a document:
 * the trigger sits in a narrow sidebar card, which is far too tight to show
 * one honestly.
 */
export function ShareReport({ report }: { report: MatchReport }) {
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Detected after mount: this page is prerendered in Node, where there is no
  // navigator, so deciding during render would mismatch on hydration.
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    // Don't let the page behind the dialog scroll away under it.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  function flash(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2500);
  }

  async function build() {
    setBusy(true);
    setError(null);
    try {
      setLink(reportUrl(await encodeReport(report)));
      setOpen(true);
    } catch (e: any) {
      setError(e?.message ?? "Could not build the report link.");
    } finally {
      setBusy(false);
    }
  }

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      flash(`${what} copied`);
    } catch {
      // Clipboard is blocked outside a secure context or without permission;
      // selecting the link box is the fallback.
      setError("Copying was blocked — select the link below and copy it manually.");
    }
  }

  async function share(url: string) {
    const title = `${report.person ? `${report.person} — ` : ""}${report.title}${report.company ? ` at ${report.company}` : ""}`;
    if (canShare) {
      try {
        await navigator.share({ title, text: `${reportToText(report)}\n`, url });
        return;
      } catch (e: any) {
        if (e?.name === "AbortError") return; // the share sheet was dismissed
      }
    }
    await copy(url, "Link");
  }

  return (
    <>
      <button className="btn-secondary w-full" onClick={build} disabled={busy}>
        {busy ? "Preparing…" : "📤 Share this result"}
      </button>
      {!open && error && <p className="mt-2 text-xs font-medium text-rose-600">{error}</p>}

      {/* Portalled to <body>: the match tab animates with a transform, which
          would otherwise become the containing block for `fixed` and clip the
          dialog inside the tab. */}
      {open && link && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-900/40 p-4 backdrop-blur-sm sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label="Share this result"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-xl rounded-3xl bg-white p-5 text-left shadow-lift animate-rise sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-ink-900">Share this result</h3>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-500">
                  A one-page summary — score, verdict, fit, gaps and next steps. The CV, the
                  full job description and your chat are never included.
                </p>
              </div>
              <button
                className="btn-ghost shrink-0 px-2 py-1 text-xs"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 max-h-[45vh] overflow-y-auto rounded-2xl border border-ink-200/70">
              <ReportCard report={report} compact />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {canShare && (
                <button className="btn-primary" onClick={() => share(link)}>
                  Share…
                </button>
              )}
              <button
                className={canShare ? "btn-secondary" : "btn-primary"}
                onClick={() => copy(link, "Link")}
              >
                🔗 Copy link
              </button>
              <button
                className="btn-secondary"
                onClick={() => copy(reportToText(report, link), "Report text")}
              >
                📝 Copy as text
              </button>
              <a className="btn-secondary" href={link} target="_blank" rel="noreferrer">
                ↗ Open / print
              </a>
            </div>

            <label className="label mt-4">Link</label>
            <textarea
              readOnly
              className="input min-h-[64px] font-mono text-[10px] leading-relaxed"
              value={link}
              onFocus={(e) => e.currentTarget.select()}
            />
            <p className="mt-2 text-xs leading-relaxed text-ink-500">
              <span className="font-semibold text-ink-700">The report is inside the link.</span>{" "}
              Nothing is uploaded — the recipient&apos;s browser decodes it, so this works even
              from a phone. The flip side: anyone who gets the link can read the report, so
              treat it like the document itself.
            </p>
            {link.length > 6000 && (
              <p className="mt-2 text-xs font-medium text-amber-700">
                This link is long ({link.length} characters) and some chat apps may truncate it
                — &ldquo;Copy as text&rdquo; is safer there.
              </p>
            )}

            {toast && <p className="mt-3 text-xs font-bold text-emerald-700">✓ {toast}</p>}
            {error && <p className="mt-2 text-xs font-medium text-rose-600">{error}</p>}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
