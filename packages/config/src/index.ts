import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { parse } from "smol-toml";
import { z } from "zod";
import type { ExecutionMode, WidgetConfig } from "@feuilleton/core";

const widgetSchema = z.object({
  command: z.string().min(1),
  description: z.string().refine((value) => value.includes("Example:"), {
    message: "widget description must contain an example call",
  }),
});

const partialConfigSchema = z.object({
  execution: z
    .object({
      mode: z.enum(["inline", "tool"]).optional(),
      shell: z.string().min(1).optional(),
      timeout_seconds: z.number().positive().optional(),
    })
    .optional(),
  terminal: z
    .object({
      fallback_columns: z.number().int().min(20).optional(),
      horizontal_inset: z.number().int().min(0).optional(),
    })
    .optional(),
  cache: z
    .object({
      max_bytes: z.number().int().positive().optional(),
      max_entries: z.number().int().positive().optional(),
      ttl_days: z.number().positive().optional(),
    })
    .optional(),
  widgets: z.record(widgetSchema).optional(),
});

export interface FeuilletonConfig {
  execution: { mode: ExecutionMode; shell: string; timeoutSeconds: number };
  terminal: { fallbackColumns: number; horizontalInset: number };
  cache: { maxBytes: number; maxEntries: number; ttlDays: number };
  widgets: Record<string, WidgetConfig>;
  sources: string[];
}

const defaults: FeuilletonConfig = {
  execution: { mode: "tool", shell: "bash", timeoutSeconds: 30 },
  terminal: { fallbackColumns: 80, horizontalInset: 4 },
  cache: { maxBytes: 256 * 1024 * 1024, maxEntries: 1000, ttlDays: 30 },
  widgets: {
    plot: {
      command: "ftn-plot",
      description: `TSV label<TAB>number. Example: printf 'Jan\\t12\\nFeb\\t19\\n' | ftn-plot bar (also line|scatter).`,
    },
    tree: {
      command: "ftn-tree",
      description: `Newline paths. Example: printf 'src/api.ts\\nsrc/ui.ts\\n' | ftn-tree.`,
    },
    graph: {
      command: "ftn-graph",
      description: `DOT input. Example: printf 'digraph { api -> db }\\n' | ftn-graph.`,
    },
  },
  sources: [],
};

function findProjectConfig(cwd: string): string | undefined {
  let current = resolve(cwd);
  for (;;) {
    const candidate = join(current, ".feuilleton", "config.toml");
    if (existsSync(candidate)) return candidate;
    if (existsSync(join(current, ".git"))) return undefined;
    const parent = dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

function loadFile(path: string): z.infer<typeof partialConfigSchema> {
  return partialConfigSchema.parse(parse(readFileSync(path, "utf8")));
}

export function loadConfig(cwd = process.cwd()): FeuilletonConfig {
  const homePath = join(homedir(), ".feuilleton", "config.toml");
  const projectPath = findProjectConfig(cwd);
  const trustedProject =
    projectPath &&
    (process.env.FTN_TRUST_ALL === "1" || isProjectTrusted(projectPath))
      ? projectPath
      : undefined;
  const paths = [homePath, trustedProject].filter((path): path is string =>
    Boolean(path && existsSync(path)),
  );
  const config = structuredClone(defaults);

  for (const path of paths) {
    const value = loadFile(path);
    if (value.execution?.mode) config.execution.mode = value.execution.mode;
    if (value.execution?.shell) config.execution.shell = value.execution.shell;
    if (value.execution?.timeout_seconds)
      config.execution.timeoutSeconds = value.execution.timeout_seconds;
    if (value.terminal?.fallback_columns)
      config.terminal.fallbackColumns = value.terminal.fallback_columns;
    if (value.terminal?.horizontal_inset !== undefined)
      config.terminal.horizontalInset = value.terminal.horizontal_inset;
    if (value.cache?.max_bytes) config.cache.maxBytes = value.cache.max_bytes;
    if (value.cache?.max_entries)
      config.cache.maxEntries = value.cache.max_entries;
    if (value.cache?.ttl_days) config.cache.ttlDays = value.cache.ttl_days;
    Object.assign(config.widgets, value.widgets);
    config.sources.push(path);
  }
  return config;
}

function trustFile(): string {
  return join(homedir(), ".feuilleton", "trust.json");
}

function fileHash(path: string): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(readFileSync(path));
  return hasher.digest("hex");
}

function trustedEntries(): Record<string, string> {
  try {
    return JSON.parse(readFileSync(trustFile(), "utf8")) as Record<
      string,
      string
    >;
  } catch {
    return {};
  }
}

export function isProjectTrusted(path: string): boolean {
  return trustedEntries()[resolve(path)] === fileHash(path);
}

export function trustProject(cwd = process.cwd()): string {
  const path = findProjectConfig(cwd);
  if (!path) throw new Error("no project .feuilleton/config.toml found");
  const entries = trustedEntries();
  entries[resolve(path)] = fileHash(path);
  const target = trustFile();
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, JSON.stringify(entries, null, 2));
  return path;
}
export { findProjectConfig };
