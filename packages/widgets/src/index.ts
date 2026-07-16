import { Graphviz } from "@hpcc-js/wasm-graphviz";

export type WidgetName = "plot" | "tree" | "graph";

export async function runWidget(
  name: WidgetName,
  input: string,
  args: string[],
  options: { columns?: number } = {},
): Promise<string> {
  if (name === "tree") return renderTree(input);
  if (name === "plot") return renderPlot(input, args, options.columns);
  return await renderGraph(input, options.columns);
}

function columns(requested?: number): number {
  const value = Number(
    requested ?? process.env.FTN_COLUMNS ?? process.env.COLUMNS ?? 80,
  );
  return Number.isFinite(value) ? Math.max(20, Math.floor(value)) : 80;
}

export function renderTree(input: string): string {
  interface Node {
    children: Map<string, Node>;
  }
  const root: Node = { children: new Map() };
  for (const line of input.split(/\r?\n/)) {
    const path = line.trim().replace(/^\.\//, "");
    if (!path) continue;
    let node = root;
    for (const part of path.split("/").filter(Boolean)) {
      let child = node.children.get(part);
      if (!child) {
        child = { children: new Map() };
        node.children.set(part, child);
      }
      node = child;
    }
  }
  const lines: string[] = [];
  const walk = (node: Node, prefix: string): void => {
    const entries = [...node.children.entries()];
    entries.forEach(([label, child], index) => {
      const last = index === entries.length - 1;
      lines.push(`${prefix}${last ? "└── " : "├── "}${label}`);
      walk(child, `${prefix}${last ? "    " : "│   "}`);
    });
  };
  walk(root, "");
  return lines.length ? `${lines.join("\n")}\n` : "";
}

interface Datum {
  label: string;
  value: number;
}

function parseData(input: string): Datum[] {
  const values: Datum[] = [];
  for (const [index, line] of input.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    const cells = line.includes("\t") ? line.split("\t") : line.split(",");
    const raw = cells.at(-1)?.trim() ?? "";
    const value = Number(raw);
    if (!Number.isFinite(value))
      throw new Error(`invalid numeric value on line ${index + 1}: ${raw}`);
    values.push({
      label: cells.slice(0, -1).join(" ").trim() || String(index + 1),
      value,
    });
  }
  return values;
}

export function renderPlot(
  input: string,
  args: string[],
  requestedColumns?: number,
): string {
  const kind = args[0] ?? "bar";
  const values = parseData(input);
  if (!values.length) return "";
  if (kind === "bar") return renderBars(values, requestedColumns);
  if (kind !== "line" && kind !== "scatter")
    throw new Error(`unknown plot type: ${kind}`);
  return renderPoints(values, kind === "line", requestedColumns);
}

function renderBars(values: Datum[], requestedColumns?: number): string {
  const width = columns(requestedColumns);
  const labelWidth = Math.max(...values.map(({ label }) => label.length));
  const max = Math.max(...values.map(({ value }) => Math.abs(value)), 1);
  const inline = labelWidth <= Math.floor(width * 0.35);
  const barWidth = Math.max(4, width - (inline ? labelWidth + 3 : 0) - 12);
  const lines: string[] = [];
  for (const { label, value } of values) {
    const length =
      value === 0
        ? 0
        : Math.max(1, Math.round((Math.abs(value) / max) * barWidth));
    const bar = `${value < 0 ? "◀" : ""}${"█".repeat(Math.max(0, length - (value < 0 ? 1 : 0)))}`;
    if (inline) lines.push(`${label.padEnd(labelWidth)}  ${bar} ${value}`);
    else lines.push(`${label}\n  ${bar} ${value}`);
  }
  return `${lines.join("\n")}\n`;
}

function renderPoints(
  values: Datum[],
  connect: boolean,
  requestedColumns?: number,
): string {
  const width = Math.max(16, Math.min(60, columns(requestedColumns) - 12));
  const height = Math.min(8, Math.max(5, Math.ceil(values.length / 2)));
  const min = Math.min(...values.map(({ value }) => value));
  const max = Math.max(...values.map(({ value }) => value));
  const range = max - min || 1;
  const pixelWidth = width * 2;
  const pixelHeight = height * 4;
  const pixels = Array.from({ length: pixelHeight }, () =>
    Array.from({ length: pixelWidth }, () => false),
  );
  const points = values.map(({ value }, index) => ({
    x:
      values.length === 1
        ? 0
        : Math.round((index / (values.length - 1)) * (pixelWidth - 1)),
    y: Math.round(((max - value) / range) * (pixelHeight - 1)),
  }));
  if (connect) {
    for (let index = 1; index < points.length; index += 1)
      drawLine(pixels, points[index - 1]!, points[index]!);
  }
  for (const point of points) pixels[point.y]![point.x] = true;
  const rows = Array.from({ length: height }, (_, row) => {
    const label =
      row === 0 ? max.toFixed(1) : row === height - 1 ? min.toFixed(1) : "";
    return `${label.padStart(8)} ${row === height - 1 ? "┤" : "│"}${brailleRow(pixels, row, width)}`;
  });
  rows.push(`${"".padStart(9)}└${"─".repeat(width)}`);
  const first = compactLabel(values[0]!.label, Math.floor(width / 2));
  const last = compactLabel(values.at(-1)!.label, Math.floor(width / 2));
  rows.push(
    `${"".padStart(10)}${first}${" ".repeat(Math.max(1, width - first.length - last.length))}${last}`,
  );
  return `${rows.join("\n")}\n`;
}

function drawLine(
  pixels: boolean[][],
  from: { x: number; y: number },
  to: { x: number; y: number },
): void {
  let { x, y } = from;
  const dx = Math.abs(to.x - x);
  const sx = x < to.x ? 1 : -1;
  const dy = -Math.abs(to.y - y);
  const sy = y < to.y ? 1 : -1;
  let error = dx + dy;
  for (;;) {
    pixels[y]![x] = true;
    if (x === to.x && y === to.y) break;
    const twice = error * 2;
    if (twice >= dy) {
      error += dy;
      x += sx;
    }
    if (twice <= dx) {
      error += dx;
      y += sy;
    }
  }
}

function brailleRow(pixels: boolean[][], row: number, width: number): string {
  const dots = [
    [0, 0, 0],
    [0, 1, 1],
    [0, 2, 2],
    [1, 0, 3],
    [1, 1, 4],
    [1, 2, 5],
    [0, 3, 6],
    [1, 3, 7],
  ] as const;
  return Array.from({ length: width }, (_, cell) => {
    let value = 0;
    for (const [x, y, bit] of dots)
      if (pixels[row * 4 + y]?.[cell * 2 + x]) value |= 1 << bit;
    return String.fromCodePoint(0x2800 + value);
  })
    .join("")
    .trimEnd();
}

function compactLabel(value: string, width: number): string {
  const characters = Array.from(value);
  return characters.length <= width
    ? value
    : `${characters.slice(0, Math.max(1, width - 1)).join("")}…`;
}

interface PlainNode {
  x: number;
  y: number;
  label: string;
}
interface PlainEdge {
  from: string;
  to: string;
}

function tokens(line: string): string[] {
  return [...line.matchAll(/"(?:\\.|[^"])*"|\S+/g)].map(({ 0: value }) =>
    value.startsWith('"') ? (JSON.parse(value) as string) : value,
  );
}

export async function renderGraph(
  dot: string,
  requestedColumns?: number,
): Promise<string> {
  const graphviz = await Graphviz.load();
  const plain = graphviz.layout(dot, "plain", "dot");
  const nodes = new Map<string, PlainNode>();
  const edges: PlainEdge[] = [];
  let graphWidth = 1;
  let graphHeight = 1;
  for (const line of plain.split("\n")) {
    const parts = tokens(line);
    if (parts[0] === "graph") {
      graphWidth = Number(parts[2]) || 1;
      graphHeight = Number(parts[3]) || 1;
    } else if (parts[0] === "node" && parts.length >= 7) {
      nodes.set(parts[1]!, {
        x: Number(parts[2]),
        y: Number(parts[3]),
        label: parts[6]!,
      });
    } else if (parts[0] === "edge" && parts.length >= 3) {
      edges.push({ from: parts[1]!, to: parts[2]! });
    }
  }
  if (!nodes.size) return "";
  const width = Math.max(20, columns(requestedColumns));
  const height = Math.max(
    5,
    Math.ceil((graphHeight / graphWidth) * width * 0.4),
  );
  const canvas = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => " "),
  );
  const placed = new Map<string, { x: number; y: number; half: number }>();
  for (const [name, node] of nodes) {
    const text = `[${node.label}]`;
    const half = Math.floor(text.length / 2);
    const x = Math.max(
      half,
      Math.min(
        width - text.length + half,
        Math.round((node.x / graphWidth) * (width - 1)),
      ),
    );
    const y = Math.max(
      0,
      Math.min(
        height - 1,
        Math.round(((graphHeight - node.y) / graphHeight) * (height - 1)),
      ),
    );
    placed.set(name, { x, y, half });
    for (
      let index = 0;
      index < text.length && x - half + index < width;
      index += 1
    )
      canvas[y]![Math.max(0, x - half + index)] = text[index]!;
  }
  for (const edge of edges) {
    const from = placed.get(edge.from);
    const to = placed.get(edge.to);
    if (!from || !to) continue;
    const direction = to.y >= from.y ? 1 : -1;
    for (let y = from.y + direction; y !== to.y; y += direction)
      if (canvas[y]?.[from.x] === " ") canvas[y]![from.x] = "│";
    const minX = Math.min(from.x, to.x);
    const maxX = Math.max(from.x, to.x);
    for (let x = minX; x <= maxX; x += 1)
      if (canvas[to.y]?.[x] === " ") canvas[to.y]![x] = "─";
    if (from.x !== to.x && canvas[to.y])
      canvas[to.y]![from.x] = from.x < to.x ? "└" : "┘";
    const arrowY = to.y - direction;
    if (canvas[arrowY]?.[to.x] === "│")
      canvas[arrowY][to.x] = direction > 0 ? "▼" : "▲";
  }
  return `${canvas
    .map((row) => row.join("").trimEnd())
    .join("\n")
    .replace(/\n+$/, "")}\n`;
}
