#!/usr/bin/env bun
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { realCodexPath } from "@feuilleton/setup";
import {
  classifySelectionStatus,
  type ExpectedUse,
  widgetMatches,
} from "./selection-status";
import { normalizeOracleText } from "./oracle-text";

const ROOT = resolve(import.meta.dir, "..");
const CASES_ROOT = join(import.meta.dir, "cases");
const RUNS_ROOT = join(ROOT, ".feuilleton-evals", "runs");
const DEFAULT_MODEL = "gpt-5.6-luna";
const DEFAULT_REASONING = "low";
const HTTP_PORT = 18765;
const BANNED = /feuilleton|\bftn\b|widget|artifact|\bbash\b|tokens?/i;

type Mode = "with-ftn" | "without-ftn";
type Widget = "plot" | "tree" | "graph" | "heatmap" | "histogram";

interface CaseManifest {
  id: string;
  fixture: string;
  expected_use: ExpectedUse;
  expected_widget?: Widget | Widget[];
  widget_arg?: string;
  required_facts: string[];
  required_patterns?: string[];
  min_payload_bytes?: number;
  record_pattern?: string;
  min_unique_records?: number;
}
interface Usage {
  input_tokens: number;
  cached_input_tokens: number;
  output_tokens: number;
  reasoning_output_tokens: number;
}
interface CaseResult {
  id: string;
  mode: Mode;
  functional_pass: boolean;
  ftn_status: string;
  oracle_facts: Record<string, boolean>;
  expected_use: ExpectedUse;
  expected_widget?: Widget | Widget[];
  observed_widget?: string;
  exit_code: number;
  prompt_hash: string;
  fixture_hash: string;
  case_hash: string;
}
interface CaseMetrics extends Usage {
  id: string;
  mode: Mode;
  uncached_input_tokens: number;
  total_tokens: number;
  visible_output_tokens: number;
  wall_ms: number;
  first_event_ms: number | null;
  tool_calls: number;
  command_calls: number;
  final_response_bytes: number;
  artifact_bytes: number;
}
interface RunResult {
  schema_version: 1;
  suite_hash: string;
  model: string;
  reasoning: string;
  mode: Mode;
  cases: CaseResult[];
}

function fail(message: string): never {
  throw new Error(message);
}
function json(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}
function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}
function sha(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}
function files(root: string): string[] {
  if (!existsSync(root)) return [];
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.name === ".git") continue;
      if (entry.isDirectory()) walk(path);
      else out.push(path);
    }
  };
  walk(root);
  return out.sort();
}
function treeHash(root: string): string {
  const parts = files(root).map((path) => {
    const relative = path.slice(root.length + 1);
    return `${relative}\0${sha(readFileSync(path))}`;
  });
  return sha(parts.join("\n"));
}
function loadCases(): Array<{
  dir: string;
  prompt: string;
  manifest: CaseManifest;
}> {
  return readdirSync(CASES_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const dir = join(CASES_ROOT, entry.name);
      const manifest = json(join(dir, "case.json")) as CaseManifest;
      const prompt = readFileSync(join(dir, "prompt.txt"), "utf8").trim();
      if (manifest.id !== entry.name) fail(`case id mismatch: ${entry.name}`);
      return { dir, prompt, manifest };
    })
    .sort((a, b) => a.manifest.id.localeCompare(b.manifest.id));
}
function suiteHash(cases = loadCases()): string {
  return sha(
    cases
      .map(
        ({ prompt, manifest }) =>
          `${manifest.id}\0${prompt}\0${JSON.stringify(manifest)}`,
      )
      .join("\n"),
  );
}
function put(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function generateFixture(kind: string, workspace: string): void {
  const lines: string[] = [];
  if (kind === "cpu-series") {
    for (let day = 1; day <= 7; day++)
      for (let minute = 0; minute < 288; minute++) {
        const hour = String(Math.floor(minute / 12)).padStart(2, "0");
        const min = String((minute % 12) * 5).padStart(2, "0");
        const label = `d${day}-${hour}:${min}`;
        const value =
          label === "d3-14:00" ? 99 : 35 + ((day * 17 + minute * 7) % 31);
        lines.push(`${label}\t${value}`);
      }
    put(join(workspace, "metrics.tsv"), `${lines.join("\n")}\n`);
  } else if (kind === "benchmarks") {
    for (let i = 1; i <= 60; i++) {
      const name =
        i === 42 ? "/checkout" : `/endpoint-${String(i).padStart(2, "0")}`;
      const before = 80 + i * 3;
      const after = i === 42 ? before + 390 : before + ((i * 19) % 80) - 20;
      lines.push(`${name}\t${before}\t${after}`);
    }
    put(
      join(workspace, "benchmark.tsv"),
      `endpoint\tbefore_ms\tafter_ms\n${lines.join("\n")}\n`,
    );
  } else if (kind === "storage") {
    const names = [
      "images",
      "databases",
      "backups",
      "logs",
      "builds",
      "documents",
      "audio",
      "video",
      "archives",
      "cache",
      "models",
      "other",
    ];
    names.forEach((name, i) =>
      lines.push(`${name}\t${name === "images" ? 480 : 20 + i * 17}`),
    );
    put(join(workspace, "allocation.tsv"), `${lines.join("\n")}\n`);
  } else if (kind === "backlog") {
    for (let i = 1; i <= 180; i++)
      lines.push(
        `day-${String(i).padStart(3, "0")}\t${i === 137 ? 920 : 100 + Math.floor(i * 2.3) + ((i * 29) % 90)}`,
      );
    put(join(workspace, "backlog.tsv"), `${lines.join("\n")}\n`);
  } else if (kind === "paths") {
    for (let pkg = 1; pkg <= 20; pkg++)
      for (let file = 1; file <= 20; file++)
        lines.push(
          `packages/pkg-${String(pkg).padStart(2, "0")}/src/module-${String(file).padStart(2, "0")}.ts`,
        );
    put(join(workspace, "paths.txt"), `${lines.join("\n")}\n`);
  } else if (kind === "dependencies") {
    for (let i = 1; i <= 45; i++)
      lines.push(
        `service-${String(i).padStart(2, "0")}\tservice-${String((i % 45) + 1).padStart(2, "0")}`,
      );
    lines.push("service-07\tservice-19", "service-19\tservice-07");
    put(
      join(workspace, "dependencies.tsv"),
      `source\ttarget\n${lines.join("\n")}\n`,
    );
  } else if (kind === "http-api") {
    put(
      join(workspace, "endpoint.txt"),
      `http://127.0.0.1:${HTTP_PORT}/items\n`,
    );
  } else if (kind === "logs") {
    const signatures = [
      "auth-timeout",
      "db-deadlock",
      "quota-exceeded",
      "upstream-reset",
      "invalid-payload",
      "cache-miss-storm",
      "worker-crash",
      "tls-expired",
    ];
    for (let i = 0; i < 20000; i++)
      lines.push(
        JSON.stringify({
          ts: `2026-07-${String((i % 28) + 1).padStart(2, "0")}T12:${String(i % 60).padStart(2, "0")}:00Z`,
          service: `svc-${i % 16}`,
          level: i % 5 ? "error" : "warn",
          signature: signatures[i % signatures.length],
          request: `r-${String(i).padStart(5, "0")}`,
        }),
      );
    put(join(workspace, "events.ndjson"), `${lines.join("\n")}\n`);
  } else if (kind === "traces") {
    for (let request = 1; request <= 80; request++)
      for (let step = 0; step < 80; step++)
        lines.push(
          `${String((step * 37 + request) % 80).padStart(3, "0")} req-${String(request).padStart(3, "0")} step-${String(step).padStart(3, "0")} service-${step % 12}`,
        );
    lines.sort();
    put(join(workspace, "trace.log"), `${lines.join("\n")}\n`);
  } else if (kind === "junit") {
    lines.push('<testsuites name="all">');
    for (let i = 1; i <= 120; i++)
      lines.push(
        `<testsuite name="Suite${i}"><testcase name="test_${i}" time="${(i / 17).toFixed(3)}"><failure message="failure-${i}">stack-${i}</failure></testcase></testsuite>`,
      );
    lines.push("</testsuites>");
    put(join(workspace, "results.xml"), `${lines.join("\n")}\n`);
  } else if (kind === "sales") {
    lines.push("region,category,amount");
    for (let i = 0; i < 50000; i++)
      lines.push(
        `region-${String((i % 10) + 1).padStart(2, "0")},category-${(i % 4) + 1},${20 + ((i * 31) % 500)}`,
      );
    put(join(workspace, "sales.csv"), `${lines.join("\n")}\n`);
  } else if (kind === "lockfile") {
    const packages: Record<string, unknown> = {};
    for (let i = 1; i <= 300; i++)
      packages[`pkg-${String(i).padStart(3, "0")}`] = {
        version: `1.${i % 20}.${i}`,
        license: i % 17 === 0 ? "GPL-3.0" : "MIT",
        duplicate_versions: i % 13 === 0 ? 2 : 1,
      };
    put(
      join(workspace, "lock.json"),
      `${JSON.stringify({ packages }, null, 2)}\n`,
    );
  } else if (kind === "rfc") {
    for (let i = 1; i <= 180; i++)
      lines.push(
        `## Section ${i}\n\nREQ-${String(i).padStart(3, "0")}: Implementations MUST preserve invariant ${i}.\n\nBackground text for requirement ${i}.`,
      );
    put(
      join(workspace, "specification.md"),
      `# Protocol Specification\n\n${lines.join("\n\n")}\n`,
    );
  } else if (kind === "source-index") {
    for (let i = 1; i <= 250; i++)
      lines.push(
        `/** Public operation ${i}. */\nexport function function${String(i).padStart(3, "0")}(value: number, label: string): string {\n  return label + String(value + ${i});\n}\n`,
      );
    put(join(workspace, "operations.ts"), lines.join("\n"));
  } else if (kind === "diff") {
    for (let i = 1; i <= 100; i++)
      lines.push(
        `diff --git a/component-${String((i % 20) + 1).padStart(2, "0")}/file-${String(i).padStart(3, "0")}.ts b/component-${String((i % 20) + 1).padStart(2, "0")}/file-${String(i).padStart(3, "0")}.ts\nindex 1111111..2222222 100644\n--- a/file.ts\n+++ b/file.ts\n@@ -1,2 +1,3 @@\n-old-${i}\n+new-${i}\n+security-check-${i}`,
      );
    put(join(workspace, "change.patch"), `${lines.join("\n")}\n`);
  } else if (kind === "heatmap") {
    for (let service = 1; service <= 12; service++)
      for (let slot = 0; slot < 24; slot++)
        lines.push(
          `svc-${String(service).padStart(2, "0")}\t${String(slot).padStart(2, "0")}:00\t${(service * 17 + slot * 13) % 100}`,
        );
    put(join(workspace, "error-density.tsv"), `${lines.join("\n")}\n`);
  } else if (kind === "histogram") {
    for (let i = 0; i < 10000; i++)
      lines.push(String((i * 37 + (i % 19) * 53) % 1000));
    put(join(workspace, "latency-ms.txt"), `${lines.join("\n")}\n`);
  } else if (kind === "health") {
    put(
      join(workspace, "endpoint.txt"),
      `http://127.0.0.1:${HTTP_PORT}/health\n`,
    );
  } else if (kind === "single-log") {
    put(
      join(workspace, "incident.log"),
      "2026-07-16T12:00:00Z ERROR E42 cache directory is read-only\n",
    );
  } else if (kind === "tiny-config") {
    put(
      join(workspace, "settings.toml"),
      'environment = "staging"\ncanary = true\nreplicas = 3\n',
    );
  } else fail(`unknown fixture: ${kind}`);
}

function validate(): void {
  const cases = loadCases();
  if (cases.length !== 20) fail(`expected 20 cases, found ${cases.length}`);
  const ids = new Set<string>();
  for (const item of cases) {
    if (ids.has(item.manifest.id)) fail(`duplicate case: ${item.manifest.id}`);
    ids.add(item.manifest.id);
    if (BANNED.test(item.prompt))
      fail(`tool hint leaked in ${item.manifest.id}/prompt.txt`);
    for (const pattern of item.manifest.required_patterns ?? []) {
      try {
        new RegExp(pattern);
      } catch {
        fail(`invalid required pattern in ${item.manifest.id}: ${pattern}`);
      }
    }
    const first = join(tmpdir(), `ftn-eval-validate-a-${crypto.randomUUID()}`);
    const second = join(tmpdir(), `ftn-eval-validate-b-${crypto.randomUUID()}`);
    try {
      mkdirSync(first, { recursive: true });
      mkdirSync(second, { recursive: true });
      generateFixture(item.manifest.fixture, first);
      generateFixture(item.manifest.fixture, second);
      if (treeHash(first) !== treeHash(second))
        fail(`non-deterministic fixture: ${item.manifest.id}`);
      for (const path of files(first)) {
        if (BANNED.test(basename(path)))
          fail(
            `tool hint leaked in fixture name: ${item.manifest.id}/${basename(path)}`,
          );
        const data = readFileSync(path);
        if (data.length < 2_000_000 && BANNED.test(data.toString("utf8")))
          fail(
            `tool hint leaked in fixture content: ${item.manifest.id}/${basename(path)}`,
          );
      }
    } finally {
      rmSync(first, { recursive: true, force: true });
      rmSync(second, { recursive: true, force: true });
    }
  }
  process.stdout.write(
    `validated ${cases.length} deterministic cases\nsuite ${suiteHash(cases)}\n`,
  );
}

function commandPath(name: string): string | undefined {
  if (name.includes("/")) return existsSync(name) ? resolve(name) : undefined;
  return Bun.which(name) ?? undefined;
}
function ftnExecutable(): string | undefined {
  if (process.env.FTN_BIN) return commandPath(process.env.FTN_BIN);
  const local = join(
    ROOT,
    "dist",
    `${process.platform}-${process.arch}`,
    "bin",
    process.platform === "win32" ? "ftn.exe" : "ftn",
  );
  return commandPath(local) ?? commandPath("ftn");
}
function copyAuth(codexHome: string): void {
  if (process.env.CODEX_API_KEY) return;
  const sourceHome = process.env.CODEX_HOME ?? join(homedir(), ".codex");
  const source = join(sourceHome, "auth.json");
  if (!existsSync(source))
    fail(
      "Codex authentication not found. Remediation: run `codex login` or set `CODEX_API_KEY` for the eval process.",
    );
  copyFileSync(source, join(codexHome, "auth.json"));
  chmodSync(join(codexHome, "auth.json"), 0o600);
}

async function preflight(mode: Mode | "both"): Promise<void> {
  const checks: Array<[string, string]> = [];
  const codex = process.env.CODEX_BIN
    ? (commandPath(process.env.CODEX_BIN) ??
      fail(`Codex executable not found: ${process.env.CODEX_BIN}`))
    : (realCodexPath() ??
      fail(
        "original Codex executable not found. Remediation: run `ftn setup codex` and retry.",
      ));
  const codexVersion = Bun.spawnSync([codex, "--version"]);
  if (codexVersion.exitCode !== 0)
    fail("original Codex executable failed its version check");
  checks.push(["codex", codexVersion.stdout.toString().trim()]);

  if (mode !== "without-ftn") {
    const ftn =
      ftnExecutable() ??
      fail(
        "ftn executable not found. Remediation: run `bun run build` or install Feuilleton and retry.",
      );
    const ftnVersion = Bun.spawnSync([ftn, "--version"]);
    if (ftnVersion.exitCode !== 0)
      fail("ftn executable failed its version check");
    checks.push(["ftn", ftnVersion.stdout.toString().trim()]);
  }
  if (!commandPath("git"))
    fail(
      "git executable not found. Remediation: install Git and ensure `git` is on PATH.",
    );
  checks.push(["git", "available"]);

  if (!process.env.CODEX_API_KEY) {
    const sourceHome = process.env.CODEX_HOME ?? join(homedir(), ".codex");
    const auth = join(sourceHome, "auth.json");
    if (!existsSync(auth))
      fail(
        "Codex authentication not found. Remediation: run `codex login` or set `CODEX_API_KEY` for the eval process.",
      );
    checks.push(["authentication", "saved Codex login"]);
  } else checks.push(["authentication", "CODEX_API_KEY"]);

  const temporary = join(tmpdir(), `ftn-eval-preflight-${crypto.randomUUID()}`);
  try {
    mkdirSync(temporary, { recursive: false });
    put(join(temporary, "write-test"), "ok");
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
  checks.push(["temporary storage", "writable"]);

  if (process.env.FTN_EVAL_SKIP_SANDBOX_PREFLIGHT !== "1") {
    const bwrap =
      commandPath("bwrap") ??
      fail(
        "bubblewrap is not installed. Remediation on Ubuntu: run `sudo apt-get update && sudo apt-get install -y bubblewrap`.",
      );
    const namespace = Bun.spawnSync(["unshare", "-Ur", "true"], {
      stdout: "ignore",
      stderr: "ignore",
    });
    if (namespace.exitCode !== 0)
      fail(
        "unprivileged user namespaces are disabled; no model sessions were started. Remediation on Ubuntu: run `sudo sysctl -w kernel.unprivileged_userns_clone=1` and, when AppArmor restricts uid_map, `sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0`; persist them in `/etc/sysctl.d`, or run the suite inside an isolated container or VM.",
      );
    const sandbox = Bun.spawnSync([
      bwrap,
      "--unshare-user",
      "--uid",
      "0",
      "--gid",
      "0",
      "--ro-bind",
      "/",
      "/",
      "--dev",
      "/dev",
      "--proc",
      "/proc",
      "true",
    ]);
    if (sandbox.exitCode !== 0)
      fail(
        "bubblewrap smoke test failed; no model sessions were started. Remediation: verify `unshare -Ur true` and `bwrap --unshare-user --uid 0 --gid 0 --ro-bind / / --dev /dev --proc /proc true`, then fix the reported host policy error.",
      );
    checks.push(["sandbox", "bubblewrap user namespace smoke test passed"]);
  } else checks.push(["sandbox", "test-only preflight bypass"]);

  let server: ReturnType<typeof Bun.serve> | undefined;
  try {
    server = Bun.serve({
      hostname: "127.0.0.1",
      port: HTTP_PORT,
      fetch: () => new Response("ok"),
    });
  } catch {
    fail(
      `local fixture port ${HTTP_PORT} is unavailable. Remediation: stop the process shown by \`ss -ltnp | grep :${HTTP_PORT}\` and retry.`,
    );
  } finally {
    await server?.stop(true);
  }
  checks.push(["fixture port", String(HTTP_PORT)]);
  checks.push(["model", DEFAULT_MODEL]);
  checks.push(["reasoning", DEFAULT_REASONING]);
  for (const [name, value] of checks)
    process.stdout.write(`preflight ${name}: ${value}\n`);
}

function ftnConfig(home: string): void {
  put(
    join(home, ".feuilleton", "config.toml"),
    `[execution]\nmode = "tool"\ntimeout_seconds = 30\n\n[widgets.heatmap]\ncommand = "ftn-heatmap"\ndescription = "TSV row<TAB>column<TAB>value. Example: printf 'api\\t00:00\\t4\\n' | ftn-heatmap."\n\n[widgets.histogram]\ncommand = "ftn-histogram"\ndescription = "Numbers, one per line. Example: printf '10\\n20\\n' | ftn-histogram."\n`,
  );
}
function startFixtureServer(
  kind: string,
): ReturnType<typeof Bun.serve> | undefined {
  if (kind !== "http-api" && kind !== "health") return undefined;
  return Bun.serve({
    hostname: "127.0.0.1",
    port: HTTP_PORT,
    fetch(request) {
      const url = new URL(request.url);
      if (url.pathname === "/health")
        return Response.json({ status: "healthy", region: "test" });
      if (url.pathname !== "/items")
        return new Response("not found", { status: 404 });
      const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
      const items = Array.from({ length: 100 }, (_, offset) => {
        const index = (page - 1) * 100 + offset + 1;
        return {
          id: `item-${String(index).padStart(4, "0")}`,
          group: `group-${index % 12}`,
          value: index * 7,
        };
      }).filter((item) => Number(item.id.slice(5)) <= 1200);
      return Response.json({ page, pages: 12, items });
    },
  });
}

function parseEvents(stdout: string): any[] {
  return stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch {
        fail(`invalid Codex JSONL at line ${index + 1}`);
      }
    });
}
function lastMessage(events: any[]): string {
  return (
    events
      .filter(
        (event) =>
          event?.type === "item.completed" &&
          event?.item?.type === "agent_message",
      )
      .at(-1)?.item?.text ?? ""
  );
}
function usage(events: any[]): Usage {
  const value =
    events.filter((event) => event?.type === "turn.completed").at(-1)?.usage ??
    {};
  return {
    input_tokens: Number(value.input_tokens ?? 0),
    cached_input_tokens: Number(value.cached_input_tokens ?? 0),
    output_tokens: Number(value.output_tokens ?? 0),
    reasoning_output_tokens: Number(value.reasoning_output_tokens ?? 0),
  };
}
function itemEvents(events: any[]): any[] {
  return events.filter((event) => event?.type === "item.completed");
}
function commandText(event: any): string {
  return String(event?.item?.command ?? event?.item?.aggregated_output ?? "");
}
function artifactIds(text: string): string[] {
  return [...text.matchAll(/<ftn art="([a-z2-7]{8})"\/>/g)].map(
    (match) => match[1]!,
  );
}
function inspectArtifacts(
  home: string,
  ids: string[],
): {
  text: string;
  bytes: number;
  widget?: string;
  widgetArg?: string;
  missing: boolean;
} {
  let text = "";
  let bytes = 0;
  let widget: string | undefined;
  let widgetArg: string | undefined;
  let missing = false;
  for (const id of ids) {
    const dir = join(home, ".cache", "feuilleton", id);
    const stdout = join(dir, "stdout");
    const meta = join(dir, "meta.json");
    if (!existsSync(stdout) || !existsSync(meta)) {
      missing = true;
      continue;
    }
    const output = readFileSync(stdout, "utf8");
    text += `\n${output}`;
    bytes += Buffer.byteLength(output);
    const metadata = json(meta) as any;
    if (metadata?.widget?.name) {
      widget = String(metadata.widget.name);
      widgetArg = String(metadata.widget.args?.[0] ?? "");
      const widgetInput = String(metadata.widget.input ?? "");
      text += `\n${widgetInput}`;
      bytes += Buffer.byteLength(widgetInput);
    }
  }
  return { text, bytes, widget, widgetArg, missing };
}

async function runCase(
  item: ReturnType<typeof loadCases>[number],
  mode: Mode,
  options: {
    model: string;
    reasoning: string;
    codex: string;
    ftn?: string;
    runRoot: string;
  },
): Promise<{ result: CaseResult; metrics: CaseMetrics }> {
  const caseRoot = join(options.runRoot, "cases", item.manifest.id, mode);
  const workspace = join(caseRoot, "workspace");
  const home = join(caseRoot, "home");
  const sessionTmp = join(home, "tmp");
  const codexHome = join(
    tmpdir(),
    `ftn-eval-codex-home-${crypto.randomUUID()}`,
  );
  mkdirSync(workspace, { recursive: true });
  mkdirSync(home, { recursive: true });
  mkdirSync(sessionTmp, { recursive: true });
  mkdirSync(codexHome, { recursive: true });
  generateFixture(item.manifest.fixture, workspace);
  Bun.spawnSync(["git", "init", "-q"], { cwd: workspace });
  copyAuth(codexHome);
  put(
    join(codexHome, "config.toml"),
    `approval_policy = "never"\nmodel_reasoning_effort = "${options.reasoning}"\nweb_search = "disabled"\n[features]\nmulti_agent = false\napps = false\n`,
  );
  const widgets = join(import.meta.dir, "widgets");
  if (mode === "with-ftn") {
    if (!options.ftn) fail("ftn executable not found");
    ftnConfig(home);
    put(
      join(home, ".bash_profile"),
      `export PATH=${JSON.stringify(`${widgets}:${dirname(options.ftn)}`)}:$PATH\n`,
    );
    writeJson(join(codexHome, "hooks.json"), {
      hooks: {
        SessionStart: [
          {
            hooks: [
              {
                type: "command",
                command: `${JSON.stringify(options.ftn)} hook codex`,
                timeout: 35,
                statusMessage: "FTN_INTERNAL_CONTEXT",
              },
            ],
          },
        ],
      },
    });
  }
  const trace = join(home, "custom-widget.trace");
  const env = {
    ...process.env,
    HOME: home,
    TMPDIR: sessionTmp,
    CODEX_HOME: codexHome,
    FTN_TRUST_ALL: "1",
    FTN_EVAL_TRACE: trace,
    PATH: `${widgets}:${dirname(options.ftn ?? options.codex)}:${process.env.PATH ?? ""}`,
  };
  const args = [
    "exec",
    "--json",
    "--ephemeral",
    "--dangerously-bypass-hook-trust",
    "-s",
    "workspace-write",
    "-m",
    options.model,
    "-C",
    workspace,
    "--add-dir",
    home,
    "-c",
    `model_reasoning_effort=\"${options.reasoning}\"`,
    "-c",
    'approval_policy="never"',
    "-c",
    "sandbox_workspace_write.network_access=true",
    item.prompt,
  ];
  const server = startFixtureServer(item.manifest.fixture);
  const started = performance.now();
  let firstEventMs: number | null = null;
  const proc = Bun.spawn([options.codex, ...args], {
    cwd: workspace,
    env,
    stdout: "pipe",
    stderr: "pipe",
  });
  const timeout = setTimeout(() => proc.kill(), 180_000);
  const stdoutPromise = (async (): Promise<string> => {
    const reader = proc.stdout.getReader();
    const chunks: Uint8Array[] = [];
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value.length && firstEventMs === null)
        firstEventMs = Math.round(performance.now() - started);
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString("utf8");
  })();
  const [stdout, stderr, exitCode] = await Promise.all([
    stdoutPromise,
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  clearTimeout(timeout);
  await server?.stop(true);
  rmSync(codexHome, { recursive: true, force: true });
  const wall = Math.round(performance.now() - started);
  put(join(caseRoot, "events.jsonl"), stdout);
  put(join(caseRoot, "stderr.txt"), stderr);
  const events = parseEvents(stdout);
  const final = lastMessage(events);
  put(join(caseRoot, "final.txt"), final);
  const sessionRoot = join(options.runRoot, "sessions", item.manifest.id);
  put(join(sessionRoot, "events.jsonl"), stdout);
  put(join(sessionRoot, "stderr.txt"), stderr);
  put(join(sessionRoot, "final.txt"), final);
  const commands = itemEvents(events).filter(
    (event) => event?.item?.type === "command_execution",
  );
  const ftnCalls = commands.filter((event) =>
    /(^|[\s'"/])ftn\s+run\b/.test(commandText(event)),
  );
  const ids = artifactIds(final);
  const artifacts = inspectArtifacts(home, ids);
  const customTrace = existsSync(trace)
    ? readFileSync(trace, "utf8").trim().split(/\r?\n/).filter(Boolean)
    : [];
  const observedWidget = artifacts.widget ?? customTrace.at(-1);
  const combined = normalizeOracleText(`${final}\n${artifacts.text}`);
  const uniqueRecords = item.manifest.record_pattern
    ? new Set(
        [
          ...combined.matchAll(new RegExp(item.manifest.record_pattern, "g")),
        ].map((match) => match[0]),
      ).size
    : 0;
  const recordsPass =
    !item.manifest.min_unique_records ||
    uniqueRecords >= item.manifest.min_unique_records;
  const externalNetwork = itemEvents(events).some((event) => {
    if (event?.item?.type === "web_search") return true;
    if (event?.item?.type !== "command_execution") return false;
    const urls = commandText(event).match(/https?:\/\/[^\s"'"']+/g) ?? [];
    return urls.some(
      (url) => !url.startsWith(`http://127.0.0.1:${HTTP_PORT}/`),
    );
  });
  const oracleFacts = Object.fromEntries(
    item.manifest.required_facts.map((fact) => [fact, combined.includes(fact)]),
  );
  for (const pattern of item.manifest.required_patterns ?? [])
    oracleFacts[`/${pattern}/`] = new RegExp(pattern).test(combined);
  oracleFacts._records_complete = recordsPass;
  oracleFacts._isolation_clean = !externalNetwork;
  const factsPass = Object.values(oracleFacts).every(Boolean);
  const sizePass = artifacts.bytes >= (item.manifest.min_payload_bytes ?? 0);
  const widgetPass =
    widgetMatches(item.manifest.expected_widget, observedWidget) &&
    (!item.manifest.widget_arg ||
      artifacts.widgetArg === item.manifest.widget_arg);
  const functionalPass =
    exitCode === 0 &&
    factsPass &&
    (item.manifest.expected_use === "forbidden" ||
      (item.manifest.expected_use === "optional" && !ids.length) ||
      sizePass);
  const ftnStatus = classifySelectionStatus({
    mode,
    expectedUse: item.manifest.expected_use,
    ftnCalls: ftnCalls.length,
    artifactIds: ids.length,
    failedFtnCall: commands.some(
      (event) =>
        event?.item?.type === "command_execution" &&
        /ftn\s+run/.test(commandText(event)) &&
        event?.item?.status === "failed",
    ),
    artifactMissing: artifacts.missing,
    widgetPass,
    functionalPass,
  });
  const u = usage(events);
  return {
    result: {
      id: item.manifest.id,
      mode,
      functional_pass: functionalPass,
      ftn_status: ftnStatus,
      oracle_facts: oracleFacts,
      expected_use: item.manifest.expected_use,
      ...(item.manifest.expected_widget
        ? { expected_widget: item.manifest.expected_widget }
        : {}),
      ...(observedWidget ? { observed_widget: observedWidget } : {}),
      exit_code: exitCode,
      prompt_hash: sha(item.prompt),
      fixture_hash: treeHash(workspace),
      case_hash: sha(JSON.stringify(item.manifest)),
    },
    metrics: {
      id: item.manifest.id,
      mode,
      ...u,
      uncached_input_tokens: Math.max(
        0,
        u.input_tokens - u.cached_input_tokens,
      ),
      total_tokens: u.input_tokens + u.output_tokens,
      visible_output_tokens: Math.max(
        0,
        u.output_tokens - u.reasoning_output_tokens,
      ),
      wall_ms: wall,
      first_event_ms: firstEventMs,
      tool_calls: itemEvents(events).filter(
        (event) =>
          event?.item?.type !== "agent_message" &&
          event?.item?.type !== "reasoning",
      ).length,
      command_calls: commands.length,
      final_response_bytes: Buffer.byteLength(final),
      artifact_bytes: artifacts.bytes,
    },
  };
}

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}
async function runMode(
  mode: Mode,
  selected: string | undefined,
  model: string,
  reasoning: string,
  parent?: string,
): Promise<string> {
  validate();
  const codex = process.env.CODEX_BIN
    ? (commandPath(process.env.CODEX_BIN) ??
      fail(`Codex executable not found: ${process.env.CODEX_BIN}`))
    : (realCodexPath() ??
      fail(
        "original Codex executable not found. Remediation: run `ftn setup codex` and retry.",
      ));
  const ftn =
    mode === "with-ftn"
      ? (ftnExecutable() ?? fail("ftn executable not found"))
      : undefined;
  const cases = loadCases().filter(
    (item) => !selected || item.manifest.id === selected,
  );
  if (!cases.length) fail(`unknown case: ${selected}`);
  const runRoot = parent
    ? join(parent, mode)
    : join(RUNS_ROOT, `${stamp()}-${mode}`);
  mkdirSync(runRoot, { recursive: true });
  const results: CaseResult[] = [];
  const metrics: CaseMetrics[] = [];
  for (const item of cases) {
    process.stderr.write(`[${mode}] ${item.manifest.id}\n`);
    const value = await runCase(item, mode, {
      model,
      reasoning,
      codex,
      ftn,
      runRoot,
    });
    results.push(value.result);
    metrics.push(value.metrics);
  }
  const result: RunResult = {
    schema_version: 1,
    suite_hash: suiteHash(),
    model,
    reasoning,
    mode,
    cases: results.sort((a, b) => a.id.localeCompare(b.id)),
  };
  writeJson(join(runRoot, "result.json"), result);
  writeJson(join(runRoot, "metrics.json"), {
    schema_version: 1,
    model,
    reasoning,
    mode,
    cases: metrics.sort((a, b) => a.id.localeCompare(b.id)),
  });
  writeJson(join(runRoot, "environment.json"), {
    codex_version: Bun.spawnSync([codex, "--version"]).stdout.toString().trim(),
    ftn_version: ftn
      ? Bun.spawnSync([ftn, "--version"]).stdout.toString().trim()
      : null,
  });
  const failed = results.some((item) => {
    if (!item.functional_pass) return true;
    if (mode === "without-ftn") return item.ftn_status !== "baseline_clean";
    return !new Set(["applied_correctly", "correctly_skipped"]).has(
      item.ftn_status,
    );
  });
  if (failed) process.exitCode = 1;
  process.stdout.write(`${runRoot}\n`);
  return runRoot;
}

function delta(
  current: number,
  previous: number,
): {
  current: number;
  previous: number;
  absolute: number;
  percent: number | null;
} {
  return {
    current,
    previous,
    absolute: current - previous,
    percent: previous === 0 ? null : ((current - previous) / previous) * 100,
  };
}
function compare(currentDir: string, previousDir: string): void {
  const current = json(join(resolve(currentDir), "result.json")) as RunResult;
  const previous = json(join(resolve(previousDir), "result.json")) as RunResult;
  const currentMetrics = json(join(resolve(currentDir), "metrics.json")) as {
    cases: CaseMetrics[];
  };
  const previousMetrics = json(join(resolve(previousDir), "metrics.json")) as {
    cases: CaseMetrics[];
  };
  const priorCases = new Map(previous.cases.map((item) => [item.id, item]));
  const priorMetrics = new Map(
    previousMetrics.cases.map((item) => [item.id, item]),
  );
  const metricKeys: Array<keyof CaseMetrics> = [
    "input_tokens",
    "cached_input_tokens",
    "uncached_input_tokens",
    "output_tokens",
    "reasoning_output_tokens",
    "total_tokens",
    "wall_ms",
    "tool_calls",
    "command_calls",
    "final_response_bytes",
    "artifact_bytes",
  ];
  const cases = current.cases.map((item) => {
    const key = item.id;
    const before = priorCases.get(key);
    const nowMetrics = currentMetrics.cases.find((metric) => metric.id === key);
    const beforeMetrics = priorMetrics.get(key);
    return {
      id: item.id,
      mode: item.mode,
      previous_present: Boolean(before),
      functional_changed: before
        ? item.functional_pass !== before.functional_pass
        : null,
      ftn_status_changed: before ? item.ftn_status !== before.ftn_status : null,
      previous_functional_pass: before?.functional_pass ?? null,
      current_functional_pass: item.functional_pass,
      previous_ftn_status: before?.ftn_status ?? null,
      current_ftn_status: item.ftn_status,
      metrics:
        nowMetrics && beforeMetrics
          ? Object.fromEntries(
              metricKeys.map((metric) => [
                metric,
                delta(
                  Number(nowMetrics[metric]),
                  Number(beforeMetrics[metric]),
                ),
              ]),
            )
          : null,
    };
  });
  const output = {
    schema_version: 1,
    compatible:
      current.suite_hash === previous.suite_hash &&
      current.model === previous.model &&
      current.reasoning === previous.reasoning,
    same_mode: current.mode === previous.mode,
    current_mode: current.mode,
    previous_mode: previous.mode,
    cases,
  };
  writeJson(join(resolve(currentDir), "compare.json"), output);
  process.stdout.write(`${join(resolve(currentDir), "compare.json")}\n`);
}

function help(): void {
  process.stdout.write(
    `Usage:\n  bun evals/harness.ts validate\n  bun evals/harness.ts preflight [--mode with-ftn|without-ftn|both]\n  bun evals/harness.ts run [--case ID] [--mode with-ftn|without-ftn|both] [--model MODEL] [--reasoning LEVEL]\n  bun evals/harness.ts compare CURRENT PREVIOUS\n`,
  );
}
async function main(): Promise<void> {
  const [command = "help", ...args] = process.argv.slice(2);
  if (command === "validate") return validate();
  if (command === "preflight") {
    const index = args.indexOf("--mode");
    const mode = (index < 0 ? "with-ftn" : args[index + 1]) as Mode | "both";
    if (!new Set(["with-ftn", "without-ftn", "both"]).has(mode))
      fail(`invalid mode: ${String(mode)}`);
    return await preflight(mode);
  }
  if (command === "compare")
    return compare(
      args[0] ?? fail("current run required"),
      args[1] ?? fail("previous run required"),
    );
  if (command !== "run") return help();
  const value = (name: string, fallback?: string): string | undefined => {
    const index = args.indexOf(name);
    return index < 0
      ? fallback
      : (args[index + 1] ?? fail(`${name} requires a value`));
  };
  const selected = value("--case");
  const mode = value("--mode", "with-ftn") as Mode | "both";
  if (!new Set(["with-ftn", "without-ftn", "both"]).has(mode))
    fail(`invalid mode: ${mode}`);
  const model = value("--model", DEFAULT_MODEL)!;
  const reasoning = value("--reasoning", DEFAULT_REASONING)!;
  await preflight(mode);
  if (mode === "both") {
    const root = join(RUNS_ROOT, `${stamp()}-both`);
    const withFtn = await runMode("with-ftn", selected, model, reasoning, root);
    const withoutFtn = await runMode(
      "without-ftn",
      selected,
      model,
      reasoning,
      root,
    );
    compare(withFtn, withoutFtn);
    copyFileSync(join(withFtn, "compare.json"), join(root, "compare.json"));
  } else await runMode(mode, selected, model, reasoning);
}

await main().catch((error) => {
  process.stderr.write(
    `feuilleton-eval: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
