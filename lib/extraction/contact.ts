export interface ExtractedContact {
  name: string | null;
  email: string | null;
  phone: string | null;
  urls: string[];
  /** Every name-shaped string worth redacting -- usually more than one,
   * since resume templates commonly render the name twice (an ALL-CAPS
   * display form plus a title-case one). Redaction must strip all of
   * these: over-redacting a non-name is harmless, missing one form of a
   * real name is a PII leak. */
  nameCandidates: string[];
}

const EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const URL_PATTERN = /\bhttps?:\/\/\S+\b|\bwww\.\S+\b|\blinkedin\.com\/\S+\b/gi;
const PHONE_CANDIDATE_PATTERN = /(\+?\d[\d\-.\s()]{7,}\d)/g;

/** Resume section headings and similar boilerplate are never names. PDF
 * text extraction frequently reorders lines so that one of these lands
 * where a naive "first line" guess would look, which is exactly how
 * "SUMMARY" once ended up stored as a candidate's name. */
const SECTION_HEADINGS = new Set([
  "summary",
  "professional summary",
  "career summary",
  "profile",
  "objective",
  "about",
  "about me",
  "experience",
  "work experience",
  "professional experience",
  "employment",
  "employment history",
  "education",
  "academics",
  "academic background",
  "skills",
  "core skills",
  "key skills",
  "technical skills",
  "core competencies",
  "competencies",
  "projects",
  "key projects",
  "certifications",
  "certification",
  "achievements",
  "accomplishments",
  "awards",
  "publications",
  "languages",
  "strengths",
  "interests",
  "hobbies",
  "contact",
  "contact details",
  "references",
  "media coverage",
  "tools",
  "volunteering",
  "leadership",
]);

/**
 * A person's name: 1-4 words, letters only (allowing . ' -), no digits or
 * @, and rendered in Title Case or ALL CAPS -- not a lowercase sentence
 * fragment, and not a known section heading.
 */
function looksLikeName(raw: string): boolean {
  const s = raw.trim();
  if (s.length < 2 || s.length > 60) return false;
  if (/[@\d]/.test(s)) return false;
  if (SECTION_HEADINGS.has(s.toLowerCase())) return false;

  const words = s.split(/\s+/);
  if (words.length < 1 || words.length > 4) return false;

  for (const w of words) {
    if (!/^[A-Za-z][A-Za-z.'-]*$/.test(w)) return false;
  }
  // Must look deliberately capitalised (Title Case or ALL CAPS), which
  // rules out prose fragments that happen to be short.
  const titleCase = words.every((w) => /^[A-Z]/.test(w));
  return titleCase;
}

/** Words that appear in job titles but effectively never in a person's
 * name. Used to down-rank, not to exclude -- a title sitting next to the
 * contact block is a common layout and was repeatedly winning over the
 * real name. */
const TITLE_WORDS =
  /\b(manager|engineer|analyst|director|lead|consultant|intern|associate|head|officer|specialist|designer|developer|founder|president|executive|architect|scientist|strategist|coordinator|administrator|owner|principal|senior|junior|staff|product|program|project|marketing|sales|growth|brand|operations|data|software|business)\b/i;

/** A single line can hold the name alongside other contact details --
 * either both renderings separated by a tab/pipe ("ROHAN MEHTA\tRohan
 * Mehta"), or the name run together with the email on one line ("Nishant
 * Joshi squad_2@example.com"). Contact tokens are stripped first, then
 * each remaining segment is tested. */
function nameSegments(line: string): string[] {
  const stripped = line
    .replace(new RegExp(EMAIL_PATTERN.source, "gi"), " ")
    .replace(URL_PATTERN, " ")
    .replace(PHONE_CANDIDATE_PATTERN, " ");

  const parts = stripped
    .split(/[\t|·•,]+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const candidates = parts.length > 1 ? [stripped.trim(), ...parts] : [stripped.trim()];
  return candidates.filter(looksLikeName);
}

/** Normalised token form used to cross-check a candidate against a
 * LinkedIn slug or email local part ("Nishant Joshi" -> "nishantjoshi"). */
function squash(s: string): string {
  return s.toLowerCase().replace(/[^a-z]/g, "");
}

/**
 * Ranks name candidates by independent corroborating signals rather than
 * document position alone, because position varies wildly across resume
 * templates once PDF text extraction reorders things.
 */
function rankNameCandidates(candidates: string[], corroborators: string[]): string[] {
  const corroboration = corroborators.map(squash).filter((c) => c.length > 4);
  const hasCaseTwin = (c: string) =>
    candidates.some((o) => o !== c && squash(o) === squash(c) && (o === o.toUpperCase()) !== (c === c.toUpperCase()));

  const score = (c: string): number => {
    let s = 0;
    const sq = squash(c);
    // A LinkedIn slug or email local part containing the candidate's
    // letters is near-conclusive: slugs are derived from real names.
    if (sq.length > 4 && corroboration.some((co) => co.includes(sq))) s += 3;
    // Templates render the name twice (ALL CAPS + Title Case); job titles
    // essentially never get that treatment.
    if (hasCaseTwin(c)) s += 2;
    if (TITLE_WORDS.test(c)) s -= 3;
    if (c !== c.toUpperCase()) s += 1; // prefer Title Case for display
    return s;
  };

  return [...candidates].sort((a, b) => score(b) - score(a));
}

/**
 * Names sit adjacent to the contact block in essentially every resume
 * layout, and the email is the single most reliably located item on the
 * page. Anchoring the search there survives the text-extraction reordering
 * that makes document position ("the first line") unreliable -- across
 * real resumes the name was variously on line 39-42, 81, and 49, while
 * line 0 was a section heading or a location tagline every time.
 */
function findNamesNearContactBlock(lines: string[]): string[] {
  const emailLine = lines.findIndex((l) => EMAIL_PATTERN.test(l));
  if (emailLine === -1) return [];

  const found: string[] = [];
  // The email line itself can carry the name ("Nishant Joshi a@b.com"),
  // so it's parsed too -- nameSegments strips the contact tokens out.
  found.push(...nameSegments(lines[emailLine]));

  // Then look just above the email line (the common case), and just
  // below it, stopping at the first non-name, non-blank line so
  // unrelated body text further away isn't swept in.
  for (let i = emailLine - 1; i >= Math.max(0, emailLine - 5); i--) {
    const segs = nameSegments(lines[i]);
    if (segs.length === 0 && lines[i].trim() !== "") break;
    found.push(...segs);
  }
  for (let i = emailLine + 1; i <= Math.min(lines.length - 1, emailLine + 3); i++) {
    const segs = nameSegments(lines[i]);
    if (segs.length === 0 && lines[i].trim() !== "") break;
    found.push(...segs);
  }
  return found;
}

function looksLikeContactLine(line: string): boolean {
  return (
    EMAIL_PATTERN.test(line) || /https?:\/\/|www\./i.test(line) || /\d{4,}/.test(line)
  );
}

export function extractContact(rawText: string): ExtractedContact {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim());

  const nearContact = findNamesNearContactBlock(lines);

  // Weak fallback, only used when the contact block yields nothing: the
  // first line that is neither contact-shaped nor a section heading.
  let firstLineName: string | null = null;
  for (const line of lines) {
    if (!line) continue;
    if (looksLikeContactLine(line)) continue;
    if (!looksLikeName(line)) continue;
    firstLineName = line;
    break;
  }

  const emailMatch = rawText.match(EMAIL_PATTERN);
  const email = emailMatch ? emailMatch[0] : null;

  const urls = Array.from(
    new Set((rawText.match(URL_PATTERN) ?? []).map((u) => u.trim())),
  );

  const nameCandidates = Array.from(
    new Set([...nearContact, firstLineName].filter((n): n is string => !!n)),
  );

  // Rank against the LinkedIn slug and email local part, which are
  // derived from the real name and so corroborate it independently of
  // where it happened to land in the extracted text.
  const ranked = rankNameCandidates(nameCandidates, [
    ...urls,
    email ? email.split("@")[0] : "",
  ]);
  const name = ranked[0] ?? null;

  const phoneCandidates = rawText.match(PHONE_CANDIDATE_PATTERN) ?? [];
  const phone = phoneCandidates.find((p) => p.replace(/\D/g, "").length >= 8) ?? null;

  return { name, email, phone, urls, nameCandidates };
}
