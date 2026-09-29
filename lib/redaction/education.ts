const SECTION_HEADING_PATTERN = /^(education|academic background|academics)\s*:?\s*$/i;

const NEXT_HEADING_PATTERN =
  /^(experience|work experience|professional experience|employment|skills|projects|certifications?|achievements?|summary|objective|profile|extracurriculars?|publications?|awards?)\s*:?\s*$/i;

// Keyword-based institution names, e.g. "Indian Institute of Technology Bombay",
// "XLRI Jamshedpur School of Business", "St. Xavier's College".
const INSTITUTION_KEYWORD_PATTERN =
  /\b(?:[A-Z][\w&.'-]*\s+){0,6}(?:University|Institute(?:\s+of\s+Technology)?|College|School|Academy|Polytechnic)(?:\s+(?:of\s+)?[A-Z][\w&.'-]*(?:\s+[A-Z][\w&.'-]*)*)?\b/g;

// Common acronym-only institute names that don't contain a keyword above.
const INSTITUTION_ACRONYM_PATTERN =
  /\b(?:IIT|IIM|NIT|BITS|XLRI|IIFT|ISB|VIT|SRM|NMIMS|SIBM|FMS)\b(?:\s+[A-Z][a-z]+)?/g;

/**
 * Blanks institution names on each line of the education section while
 * leaving degree text (MBA, B.Tech, etc.) and dates untouched, since those
 * patterns don't overlap with institution-name matches.
 */
export function redactEducationInstitutions(text: string): string {
  const lines = text.split(/\r?\n/);
  let inEducation = false;

  const redactedLines = lines.map((line) => {
    const trimmed = line.trim();

    if (SECTION_HEADING_PATTERN.test(trimmed)) {
      inEducation = true;
      return line;
    }
    if (inEducation && NEXT_HEADING_PATTERN.test(trimmed)) {
      inEducation = false;
      return line;
    }
    if (!inEducation) return line;

    return line
      .replace(INSTITUTION_KEYWORD_PATTERN, "[REDACTED-INSTITUTION]")
      .replace(INSTITUTION_ACRONYM_PATTERN, "[REDACTED-INSTITUTION]");
  });

  return redactedLines.join("\n");
}
