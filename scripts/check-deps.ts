import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = "packages";
const graph = new Map<string, Set<string>>();
for (const name of readdirSync(root)) {
  const directory = join(root, name);
  if (!statSync(directory).isDirectory()) continue;
  const source = join(directory, "src", "index.ts");
  const imports = new Set<string>();
  try {
    for (const match of readFileSync(source, "utf8").matchAll(
      /@feuilleton\/([a-z-]+)/g,
    )) {
      if (match[1]) imports.add(match[1]);
    }
  } catch {
    // Packages without an index entry have no graph edges.
  }
  graph.set(name, imports);
}
function visit(node: string, path: string[]): void {
  if (path.includes(node))
    throw new Error(`dependency cycle: ${[...path, node].join(" -> ")}`);
  for (const dependency of graph.get(node) ?? [])
    visit(dependency, [...path, node]);
}
for (const node of graph.keys()) visit(node, []);
