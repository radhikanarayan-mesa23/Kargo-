export interface ExtractedContact {
  name: string | null;
  email: string | null;
  phone: string | null;
  urls: string[];
}

const EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const URL_PATTERN = /\bhttps?:\/\/\S+\b|\bwww\.\S+\b|\blinkedin\.com\/\S+\b/gi;
const PHONE_CANDIDATE_PATTERN = /(\+?\d[\d\-.\s()]{7,}\d)/g;

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

  let name: string | null = null;
  for (const line of lines) {
    if (!line) continue;
    if (looksLikeContactLine(line)) continue;
    name = line;
    break;
  }

  const emailMatch = rawText.match(EMAIL_PATTERN);
  const email = emailMatch ? emailMatch[0] : null;

  const urls = Array.from(
    new Set((rawText.match(URL_PATTERN) ?? []).map((u) => u.trim())),
  );

  const phoneCandidates = rawText.match(PHONE_CANDIDATE_PATTERN) ?? [];
  const phone =
    phoneCandidates.find((p) => p.replace(/\D/g, "").length >= 8) ?? null;

  return { name, email, phone, urls };
}
