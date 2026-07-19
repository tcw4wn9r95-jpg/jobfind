"use client";

import { useEffect, useState } from "react";

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-ink-500">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
      {label}
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 animate-rise">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink-900">
          {title}
        </h1>
        {subtitle && <p className="mt-1.5 text-sm text-ink-500">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

/** Score donut. The number is the signal; color reinforces but never replaces it. */
export function ScoreRing({
  score,
  size = 72,
}: {
  score: number | null;
  size?: number;
}) {
  const s = score ?? 0;
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const color =
    s >= 70 ? "#059669" : s >= 50 ? "#d97706" : s >= 30 ? "#ea580c" : "#e11d48";
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#eceef6"
          strokeWidth={7}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={score == null ? "#d9dcea" : color}
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - s / 100)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-extrabold text-ink-900"
          style={{ fontSize: size / 3.4 }}
        >
          {score == null ? "—" : s}
        </span>
      </div>
    </div>
  );
}

export const STATUS_META: Record<
  string,
  { label: string; chip: string; dot: string }
> = {
  lead: { label: "Lead", chip: "bg-ink-100 text-ink-600", dot: "bg-ink-400" },
  applied: {
    label: "Applied",
    chip: "bg-indigo-50 text-indigo-700",
    dot: "bg-indigo-500",
  },
  replied: {
    label: "Replied",
    chip: "bg-violet-50 text-violet-700",
    dot: "bg-violet-500",
  },
  interview: {
    label: "Interview",
    chip: "bg-amber-50 text-amber-700",
    dot: "bg-amber-500",
  },
  offer: {
    label: "Offer 🎉",
    chip: "bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
  },
  rejected: {
    label: "Rejected",
    chip: "bg-rose-50 text-rose-600",
    dot: "bg-rose-400",
  },
};

export function StatusChip({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? STATUS_META.lead;
  return (
    <span className={`chip ${meta.chip}`}>
      <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

/** Minimal Markdown → HTML for CV preview / chat replies. Safe: escapes HTML first. */
export function Markdown({ text }: { text: string }) {
  const html = mdToHtml(text);
  return (
    <div className="prose-cv" dangerouslySetInnerHTML={{ __html: html }} />
  );
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function mdToHtml(md: string): string {
  const lines = escapeHtml(md.replace(/\r\n/g, "\n")).split("\n");
  const out: string[] = [];
  let inList = false;
  let inCode = false;
  const closeList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };
  for (const line of lines) {
    if (/^```/.test(line.trim())) {
      closeList();
      if (!inCode) {
        out.push('<pre class="mb-3 overflow-x-auto rounded-lg bg-ink-100 p-3 text-xs">');
        inCode = true;
      } else {
        out.push("</pre>");
        inCode = false;
      }
      continue;
    }
    if (inCode) {
      out.push(line + "\n");
      continue;
    }
    const inline = (s: string) =>
      s
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
        .replace(
          /\[([^\]]+)\]\((https?:[^)]+)\)/g,
          '<a class="text-indigo-600 underline" href="$2" target="_blank" rel="noreferrer">$1</a>'
        );
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      closeList();
      const lvl = Math.min(h[1].length, 3);
      out.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`);
      continue;
    }
    if (/^(---|\*\*\*)\s*$/.test(line.trim())) {
      closeList();
      out.push("<hr/>");
      continue;
    }
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (bullet) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${inline(bullet[1])}</li>`);
      continue;
    }
    closeList();
    if (line.trim()) out.push(`<p>${inline(line)}</p>`);
  }
  closeList();
  if (inCode) out.push("</pre>");
  return out.join("\n");
}

/**
 * Same call signature the components always used, but routed to the
 * in-browser data layer instead of a server. Errors carry `.data`
 * (e.g. { needsPaste: true }) exactly as before.
 */
export async function api<T = any>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const { localApi, ApiError } = await import("@/lib/localapi");
  try {
    return await localApi(url, {
      method: init?.method ?? "GET",
      body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    });
  } catch (e: any) {
    const err: any = new Error(e.message);
    err.data = e instanceof ApiError ? e.data : {};
    throw err;
  }
}

export function useApi<T = any>(url: string): {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    api<T>(url)
      .then((d) => alive && (setData(d), setError(null)))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [url, tick]);
  return { data, loading, error, reload: () => setTick((t) => t + 1) };
}
