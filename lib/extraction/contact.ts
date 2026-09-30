export interface ExtractedContact {
  name: string | null;
  email: string | null;
  phone: string | null;
  urls: string[];
  /** Every name-shaped string worth redacting -- may include more than just
   * `name` (e.g. an ALL-CAPS header echo of the same name), since PDF text
   * extraction order for templated resumes often doesn't match the visual
   * layout and a name can appear in more than one form before/after the
   * "first line" guess. Redaction should strip all of these, not just one. */
  nameCandidates: string[];
}

const EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const URL_PATTERN = /\bhttps?:\/\/\S+\b|\bwww\.\S+\b|\blinkedin\.com\/\S+\b/gi;
const PHONE_CANDIDATE_PATTERN = /(\+?\d[\d\-.\s()]{7,}\d)/g;

// Many resume templates render the name twice in the header -- once as a
// stylized ALL-CAPS element, once as plain title-case text (accessibility/
// searchability duplicate), e.g. "ISHAAN ROY\tIshaan Roy". Extraction order
// for these can place this well after line one, so this is scanned across
// the whole document rather than assumed to be near the top.
const ECHOED_NAME_HEADER_PATTERN =
  /\b([A-Z]{2,}(?:\s+[A-Z]{2,}){0,3})\s*[\t|]\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\b/;

// A line that itself looks like an email/URL/phone header is not a name --
// skip it and keep looking at subsequent non-empty lines.
function looksLikeContactLine(line: string): boolean {
  return (
    EMAIL_PATTERN.test(line) ||
    /https?:\/\/|www\./i.test(line) ||
    /\d{4,}/.test(line)
  );
}

export function extractContact(rawText: string): ExtractedContact {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim());

  let firstLineName: string | null = null;
  for (const line of lines) {
    if (!line) continue;
    if (looksLikeContactLine(line)) continue;
    firstLineName = line;
    break;
  }

  const echoMatch = rawText.match(ECHOED_NAME_HEADER_PATTERN);
  const echoedAllCaps = echoMatch?.[1] ?? null;
  const echoedTitleCase = echoMatch?.[2] ?? null;

  // The echoed title-case form is a more reliable name signal than "first
  // non-contact-looking line" when present, since that line-based guess can
  // land on a stray header/location string in a scrambled extraction order.
  const name = echoedTitleCase ?? firstLineName;

  const nameCandidates = Array.from(
    new Set([firstLineName, echoedAllCaps, echoedTitleCase].filter((n): n is string => !!n)),
  );

  const emailMatch = rawText.match(EMAIL_PATTERN);
  const email = emailMatch ? emailMatch[0] : null;

  const urls = Array.from(
    new Set((rawText.match(URL_PATTERN) ?? []).map((u) => u.trim())),
  );

  const phoneCandidates = rawText.match(PHONE_CANDIDATE_PATTERN) ?? [];
  const phone =
    phoneCandidates.find((p) => p.replace(/\D/g, "").length >= 8) ?? null;

  return { name, email, phone, urls, nameCandidates };
}
