import type { ExtractedContact } from "@/lib/extraction/contact";
import {
  ADDRESS_LINE_PATTERN,
  DOB_PATTERN,
  EMAIL_PATTERN,
  GENDER_FIELD_PATTERN,
  PHONE_PATTERN,
  PIN_CODE_PATTERN,
  URL_PATTERN,
} from "@/lib/redaction/patterns";
import { redactEducationInstitutions } from "@/lib/redaction/education";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function redactName(text: string, nameCandidates: string[]): string {
  if (nameCandidates.length === 0) return text;

  const tokens = new Set<string>();
  for (const name of nameCandidates) {
    tokens.add(name);
    for (const token of name.split(/\s+/)) {
      if (token.length > 1) tokens.add(token);
    }
  }

  // Longest first so "Rohan Desai" is redacted before a lone "Rohan"/"Desai"
  // leftover would otherwise partially match inside it.
  const ordered = Array.from(tokens).sort((a, b) => b.length - a.length);

  let result = text;
  for (const token of ordered) {
    const re = new RegExp(`\\b${escapeRegExp(token)}\\b`, "gi");
    result = result.replace(re, "[REDACTED-NAME]");
  }
  return result;
}

/**
 * Produces the text that is ever allowed to reach the AI: original CV text
 * with name/email/phone/urls/address/DOB/gender/institution-names stripped.
 * Order matters -- each step assumes the previous one has already removed
 * its category so patterns don't cross-match already-redacted placeholders.
 */
export function redactCvText(rawText: string, contact: ExtractedContact): string {
  let text = rawText;

  // Precise structural patterns (email/phone/url) run before the name's word
  // tokens are stripped -- a name is often a substring of its own email's
  // local part (e.g. "verma" inside "asha.verma@..."), and redacting the name
  // first would fracture the email match into orphaned name tags instead of
  // one clean [REDACTED-EMAIL].
  text = text.replace(EMAIL_PATTERN, "[REDACTED-EMAIL]");
  text = text.replace(PHONE_PATTERN, (match) =>
    match.replace(/\D/g, "").length >= 8 ? "[REDACTED-PHONE]" : match,
  );
  text = text.replace(URL_PATTERN, "[REDACTED-URL]");
  text = redactName(text, contact.nameCandidates);
  text = text.replace(ADDRESS_LINE_PATTERN, "[REDACTED-ADDRESS]");
  text = text.replace(PIN_CODE_PATTERN, "[REDACTED-ADDRESS]");
  text = text.replace(DOB_PATTERN, "[REDACTED-DOB]");
  text = text.replace(GENDER_FIELD_PATTERN, "[REDACTED-GENDER]");
  text = redactEducationInstitutions(text);

  return text;
}
