export function normalizeOracleText(text: string): string {
  return text.replace(/(\d)[‐‑‒–—−](?=\d)/g, "$1-");
}
