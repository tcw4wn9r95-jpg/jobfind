// Structured CV matching Diego's template. The generator prompt, the docx
// builder and the on-screen preview all consume this shape.

export type CvRole = {
  title: string;
  location: string;
  dates: string;
  bullets: string[];
};

export type CvCompany = {
  company: string;
  blurb: string; // one-line company descriptor shown in italic gray
  roles: CvRole[];
};

export type CvEducation = {
  degree: string;
  institution: string; // school, city, country
  note: string; // e.g. "Graduated with Distinction" — italic, optional
  dates: string;
};

export type CvData = {
  name: string;
  email: string;
  phone: string;
  linkedin: string;
  summary: string;
  competencies: { label: string; text: string }[];
  experience: CvCompany[];
  education: CvEducation[];
  education_notes: string[]; // small italic lines under education (optional)
  certifications: string[]; // "**Name** — issuer, year" (inline bold supported)
  languages: string; // "Spanish (native) · English (…)" — rendered as a bullet
  leadership: string[];
  interests: string;
};

export function isCvData(x: unknown): x is CvData {
  const c = x as CvData;
  return Boolean(
    c &&
      typeof c === "object" &&
      typeof c.name === "string" &&
      Array.isArray(c.experience) &&
      typeof c.summary === "string"
  );
}

/** Parse a stored CV: JSON (current format) or null for legacy Markdown. */
export function parseCv(content: string): CvData | null {
  const trimmed = content.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(trimmed);
    return isCvData(parsed) ? withDefaults(parsed) : null;
  } catch {
    return null;
  }
}

function withDefaults(c: CvData): CvData {
  return {
    name: c.name ?? "",
    email: c.email ?? "",
    phone: c.phone ?? "",
    linkedin: c.linkedin ?? "",
    summary: c.summary ?? "",
    competencies: c.competencies ?? [],
    experience: (c.experience ?? []).map((e) => ({
      company: e.company ?? "",
      blurb: e.blurb ?? "",
      roles: (e.roles ?? []).map((r) => ({
        title: r.title ?? "",
        location: r.location ?? "",
        dates: r.dates ?? "",
        bullets: r.bullets ?? [],
      })),
    })),
    education: c.education ?? [],
    education_notes: c.education_notes ?? [],
    certifications: c.certifications ?? [],
    languages: c.languages ?? "",
    leadership: c.leadership ?? [],
    interests: c.interests ?? "",
  };
}

/**
 * Normalize a LinkedIn field (often stored as "linkedin.com/in/x" or
 * "www.linkedin.com/in/x" with no protocol) into a real https:// URL a
 * hyperlink can point to. Returns "" if the field is empty.
 */
export function linkedinUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/** Plain-text rendition (for the .md/.txt download and for chat context). */
export function cvToText(c: CvData): string {
  const lines: string[] = [];
  lines.push(c.name);
  const linkedin = linkedinUrl(c.linkedin);
  lines.push(
    `Email: ${c.email}  |  Tel: ${c.phone}  |  LinkedIn: ${linkedin ? `[LinkedIn](${linkedin})` : c.linkedin}`
  );
  lines.push("", c.summary, "", "CORE COMPETENCIES");
  for (const k of c.competencies) lines.push(`- ${k.label}: ${k.text}`);
  lines.push("", "PROFESSIONAL EXPERIENCE");
  for (const e of c.experience) {
    lines.push("", `${e.company} — ${e.blurb}`);
    for (const r of e.roles) {
      lines.push(`${r.title} | ${r.location}, ${r.dates}`);
      for (const b of r.bullets) lines.push(`- ${b.replace(/\*\*/g, "")}`);
    }
  }
  lines.push("", "EDUCATION");
  for (const ed of c.education) {
    lines.push(
      `${ed.degree} — ${ed.institution}${ed.note ? ` (${ed.note})` : ""} · ${ed.dates}`
    );
  }
  for (const n of c.education_notes) lines.push(n);
  if (c.certifications.length || c.languages) {
    lines.push("", "CERTIFICATIONS & LANGUAGES");
    for (const cert of c.certifications) lines.push(`- ${cert.replace(/\*\*/g, "")}`);
    if (c.languages) lines.push(`- Languages: ${c.languages}`);
  }
  if (c.leadership.length) {
    lines.push("", "LEADERSHIP & VOLUNTEERING");
    for (const l of c.leadership) lines.push(`- ${l.replace(/\*\*/g, "")}`);
  }
  if (c.interests) lines.push("", "PERSONAL INTERESTS", c.interests);
  return lines.join("\n");
}
