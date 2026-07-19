"use client";

import { Markdown } from "@/components/ui";
import { parseCv } from "@/lib/cvschema";

/** On-screen approximation of the CV template (navy accents, small-caps
 *  section rules). Falls back to Markdown for legacy versions. */
export function CvPreview({ content }: { content: string }) {
  const cv = parseCv(content);
  if (!cv) return <Markdown text={content} />;

  return (
    <div className="font-[Calibri,sans-serif] text-[13px] leading-snug text-black">
      <p className="text-center text-xl font-bold text-[#1f3a5f]">{cv.name}</p>
      <p className="mb-3 text-center text-[11px]">
        Email: <span className="text-[#1f3a5f] underline">{cv.email}</span>
        {"  |  "}Tel: {cv.phone}
        {"  |  "}LinkedIn: <span className="text-[#1f3a5f] underline">{cv.linkedin}</span>
      </p>
      <p className="mb-3 text-justify">{plain(cv.summary)}</p>

      {cv.competencies.length > 0 && (
        <>
          <SectionHeading text="Core Competencies" />
          <ul className="mb-2 space-y-0.5">
            {cv.competencies.map((k, i) => (
              <li key={i} className="flex gap-1.5 text-justify">
                <span>•</span>
                <span>
                  <b>{k.label}:</b> <Rich text={k.text} />
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {cv.experience.length > 0 && (
        <>
          <SectionHeading text="Professional Experience" />
          {cv.experience.map((e, i) => (
            <div key={i} className="mb-2">
              <p className="mt-2">
                <span className="text-[14px] font-bold text-[#1f3a5f]">{e.company}</span>
                {e.blurb && (
                  <span className="text-[10px] italic text-[#555555]"> — {e.blurb}</span>
                )}
              </p>
              {e.roles.map((r, j) => (
                <div key={j}>
                  <p className="mt-1 flex items-baseline justify-between gap-4">
                    <span className="font-bold">{r.title}</span>
                    <span className="shrink-0 text-[11px] italic">
                      {[r.location, r.dates].filter(Boolean).join(", ")}
                    </span>
                  </p>
                  <ul className="space-y-0.5">
                    {r.bullets.map((b, k) => (
                      <li key={k} className="flex gap-1.5 text-justify">
                        <span>•</span>
                        <span>
                          <Rich text={b} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ))}
        </>
      )}

      {cv.education.length > 0 && (
        <>
          <SectionHeading text="Education" />
          {cv.education.map((ed, i) => (
            <p key={i} className="mb-0.5">
              <b>{ed.degree}</b> — {ed.institution}
              {ed.note && <i> ({ed.note})</i>}
              {ed.dates && <> · {ed.dates}</>}
            </p>
          ))}
          {cv.education_notes.map((n, i) => (
            <p key={i} className="text-[11px] italic">
              {n}
            </p>
          ))}
        </>
      )}

      {(cv.certifications.length > 0 || cv.languages) && (
        <>
          <SectionHeading text="Certifications & Languages" />
          <ul className="space-y-0.5">
            {cv.certifications.map((c, i) => (
              <li key={i} className="flex gap-1.5">
                <span>•</span>
                <span>
                  <Rich text={c} />
                </span>
              </li>
            ))}
            {cv.languages && (
              <li className="flex gap-1.5">
                <span>•</span>
                <span>
                  <b>Languages:</b> {plain(cv.languages)}
                </span>
              </li>
            )}
          </ul>
        </>
      )}

      {cv.leadership.length > 0 && (
        <>
          <SectionHeading text="Leadership & Volunteering" />
          <ul className="space-y-0.5">
            {cv.leadership.map((l, i) => (
              <li key={i} className="flex gap-1.5 text-justify">
                <span>•</span>
                <span>
                  <Rich text={l} />
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {cv.interests && (
        <>
          <SectionHeading text="Personal Interests" />
          <p className="text-justify">{plain(cv.interests)}</p>
        </>
      )}
    </div>
  );
}

function SectionHeading({ text }: { text: string }) {
  return (
    <p className="mb-1.5 mt-3 border-b border-[#1f3a5f] pb-0.5 text-[13px] font-bold uppercase tracking-wide text-[#1f3a5f]">
      {text}
    </p>
  );
}

function plain(s: string) {
  return s.replace(/\*\*/g, "");
}

/** Render **bold** markers. */
function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? (
          <b key={i}>{p.slice(2, -2)}</b>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  );
}
