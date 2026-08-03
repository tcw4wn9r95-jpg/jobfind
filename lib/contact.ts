// Contact details are stable personal facts, not something to re-derive per
// generation. They live on the profile and are injected into every generated
// CV deterministically.
//
// This exists because the CV_JSON_SCHEMA prompt showed `"email": "", "phone":
// "", "linkedin": ""` as its example values (every other field had a
// descriptive placeholder), so Claude faithfully echoed empty strings back —
// producing CVs with no contact line and, because an empty linkedin makes the
// docx builder omit the element, no LinkedIn link at all.

export type ContactDetails = {
  name: string;
  email: string;
  phone: string;
  linkedin: string;
};

export const EMPTY_CONTACT: ContactDetails = {
  name: "",
  email: "",
  phone: "",
  linkedin: "",
};

export function normalizeContact(c?: Partial<ContactDetails> | null): ContactDetails {
  return {
    name: c?.name ?? "",
    email: c?.email ?? "",
    phone: c?.phone ?? "",
    linkedin: c?.linkedin ?? "",
  };
}

export function hasAnyContact(c: ContactDetails): boolean {
  return Boolean(c.name || c.email || c.phone || c.linkedin);
}

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]{2,}/;

// Prefer a number that follows an explicit label; fall back to a loose
// international pattern. Requires 8+ digits so years ("2019 – 2022") and
// metrics ("€427MM") can't be mistaken for a phone number.
const LABELLED_PHONE_RE =
  /(?:tel|phone|mobile|mob|tél|telefon|telefono)[.:\s]*\+?[\d][\d\s().-]{6,}/i;
const LOOSE_PHONE_RE = /\+\d[\d\s().-]{7,}\d/;

const LINKEDIN_RE = /(?:https?:\/\/)?(?:[\w-]+\.)?linkedin\.com\/(?:in|pub)\/[\w%\-À-ÿ.]+\/?/i;

function cleanPhone(raw: string): string {
  // Strip the label, keep the number and its formatting
  const stripped = raw.replace(/^[^+\d]*/, "").trim();
  return stripped.replace(/[.,;|]+$/, "").trim();
}

/**
 * Best-effort extraction of contact details from raw CV text, used to
 * pre-fill the profile's contact fields. Anything it misses (commonly the
 * LinkedIn URL, which in a .docx often lives only inside the hyperlink
 * relationship and never appears in the pasted text) the user fills in by
 * hand — the profile fields are the source of truth either way.
 */
export function extractContact(rawCv: string): ContactDetails {
  const text = rawCv ?? "";
  const email = text.match(EMAIL_RE)?.[0] ?? "";

  const labelled = text.match(LABELLED_PHONE_RE)?.[0];
  const phone = labelled
    ? cleanPhone(labelled)
    : cleanPhone(text.match(LOOSE_PHONE_RE)?.[0] ?? "");

  const linkedin = (text.match(LINKEDIN_RE)?.[0] ?? "").replace(/\/$/, "");

  // The name is usually the first non-empty line of a CV
  const firstLine =
    text
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length > 0 && l.length <= 60 && !EMAIL_RE.test(l)) ?? "";

  return { name: firstLine, email, phone, linkedin };
}

/**
 * Overwrite a generated CV's contact fields with the profile's. Applied to
 * every CV the model produces so contact details can never be dropped,
 * truncated or invented. Falls back to whatever the model returned only for
 * fields the profile leaves blank.
 */
export function applyContact<T extends { name: string; email: string; phone: string; linkedin: string }>(
  cv: T,
  contact: ContactDetails
): T {
  return {
    ...cv,
    name: contact.name || cv.name,
    email: contact.email || cv.email,
    phone: contact.phone || cv.phone,
    linkedin: contact.linkedin || cv.linkedin,
  };
}
