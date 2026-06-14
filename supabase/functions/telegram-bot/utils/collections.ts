import type { Collezione } from "../types.ts";

export type SearchResult =
  | { status: "found"; collezione: Collezione }
  | { status: "ambiguous"; matches: Collezione[] }
  | { status: "not_found" };

export function searchCollezione(input: string, all: Collezione[]): SearchResult {
  const q = input.toLowerCase().trim();
  if (!q) return { status: "not_found" };
  const matches = all.filter((c) => c.nome.toLowerCase().startsWith(q));
  if (matches.length === 1) return { status: "found", collezione: matches[0] };
  if (matches.length > 1) return { status: "ambiguous", matches };
  return { status: "not_found" };
}
