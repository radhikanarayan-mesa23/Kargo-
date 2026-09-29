/** Substitutes the real name in only at send time -- the model never sees it. */
export function substituteFirstName(bodyTemplate: string, fullName: string | null): string {
  const firstName = (fullName ?? "").trim().split(/\s+/)[0] || "there";
  return bodyTemplate.replaceAll("{{first_name}}", firstName);
}
