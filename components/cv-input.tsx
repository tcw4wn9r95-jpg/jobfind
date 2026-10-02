"use client";

import { useRef, useState } from "react";
import { Spinner } from "@/components/ui";
import { CV_FILE_ACCEPT, CvFileError, extractCvText } from "@/lib/cvfile";

/**
 * A CV box that takes an uploaded file OR pasted text.
 *
 * Uploading fills the textarea rather than bypassing it, so what was read is
 * always visible and editable — a mangled extraction is something you can see
 * and fix, not something silently sent to Claude. Any failure leaves the box
 * ready for pasting.
 */
export function CvInput({
  value,
  onChange,
  placeholder,
  minHeight = 160,
}: {
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  minHeight?: number;
}) {
  const [reading, setReading] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load(file: File) {
    setReading(true);
    setStatus(null);
    try {
      const { text, detail } = await extractCvText(file);
      onChange(text);
      setStatus({
        ok: true,
        message: `Read ${file.name} (${detail}, ${text.length.toLocaleString()} characters). Check the text in the box and edit anything that came out wrong.`,
      });
    } catch (e: any) {
      setStatus({
        ok: false,
        message: `${
          e instanceof CvFileError ? e.message : "Couldn't read that file."
        } Paste the text into the box instead.`,
      });
    } finally {
      setReading(false);
      // Allow re-selecting the same file after a failure.
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) load(file);
      }}
      className={`rounded-xl transition ${dragging ? "ring-2 ring-indigo-400 ring-offset-2" : ""}`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <label className={`btn-secondary cursor-pointer ${reading ? "pointer-events-none opacity-60" : ""}`}>
          📎 Upload CV
          <input
            ref={fileRef}
            type="file"
            accept={CV_FILE_ACCEPT}
            className="hidden"
            data-testid="cv-file"
            onChange={(e) => e.target.files?.[0] && load(e.target.files[0])}
          />
        </label>
        <span className="text-xs text-ink-400">
          .docx, .pdf or .txt — read on this device, never uploaded. Or just paste.
        </span>
        {reading && <Spinner label="Reading…" />}
      </div>

      <textarea
        className="input text-xs"
        style={{ minHeight }}
        placeholder={placeholder ?? "Paste the CV text here, or drop a file onto this box…"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />

      {status && (
        <p
          className={`mt-2 text-xs font-medium ${status.ok ? "text-emerald-700" : "text-rose-600"}`}
          role={status.ok ? "status" : "alert"}
        >
          {status.ok ? "✓ " : ""}
          {status.message}
        </p>
      )}
    </div>
  );
}
