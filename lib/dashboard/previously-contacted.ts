import { readFileSync } from "fs";
import path from "path";

export interface PreviouslyContacted {
  name: string;
  email: string;
  note: string;
}

/** Minimal CSV split -- the seed file is hand-edited and small, so no need
 * for a full CSV parser; this only handles the plain name,email,note shape,
 * not quoted fields with embedded commas. */
function parseLine(line: string): string[] {
  return line.split(",").map((cell) => cell.trim());
}

export function getPreviouslyContacted(): PreviouslyContacted[] {
  const filePath = path.join(process.cwd(), "seed", "previously_contacted.csv");

  let text: string;
  try {
    text = readFileSync(filePath, "utf-8");
  } catch {
    return [];
  }

  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const [header, ...rows] = lines;
  if (!header || !header.toLowerCase().startsWith("name,email")) return [];

  return rows
    .map(parseLine)
    .filter(([name, email]) => name && email)
    .map(([name, email, note = ""]) => ({ name, email, note }));
}
