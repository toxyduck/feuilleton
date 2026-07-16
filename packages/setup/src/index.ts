import {
  accessSync,
  constants,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, delimiter, dirname, join, resolve } from "node:path";
import { WIDGET_NAMES } from "@feuilleton/core";

type Agent = "codex" | "claude";
interface InstallState {
  realCodex?: string;
  codexLink?: string;
}

const statePath = join(homedir(), ".feuilleton", "state", "install.json");
const commandNames = ["ftn", ...WIDGET_NAMES.map((name) => `ftn-${name}`)];
const marketplace = "feuilleton";
const plugin = `${marketplace}@feuilleton`;

function readState(): InstallState {
  try {
    return JSON.parse(readFileSync(statePath, "utf8")) as InstallState;
  } catch {
    return {};
  }
}
function writeState(state: InstallState): void {
  mkdirSync(dirname(statePath), { recursive: true });
  writeFileSync(statePath, JSON.stringify(state, null, 2));
}
async function run(command: string[], ignoreFailure = false): Promise<void> {
  const proc = Bun.spawn(command, { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0 && !ignoreFailure)
    throw new Error(`${command.join(" ")} failed: ${stderr || stdout}`);
}
function executable(name: string): string | undefined {
  const path = Bun.which(name);
  return path ? realpathSync(resolve(path)) : undefined;
}
function resolved(path: string | undefined): string | undefined {
  if (!path) return undefined;
  try {
    return realpathSync(resolve(path));
  } catch {
    return undefined;
  }
}

function resolvedExecutable(path: string | undefined): string | undefined {
  if (!path) return undefined;
  try {
    accessSync(path, constants.X_OK);
    return resolved(path);
  } catch {
    return undefined;
  }
}

function isCodexLauncher(path: string | undefined, launcher: string): boolean {
  const real = resolved(path);
  return (
    !real ||
    real === resolved(launcher) ||
    basename(real).toLowerCase().split(".")[0] === "ftn-codex"
  );
}

export function findOriginalCodex(
  launcher: string,
  pathValue = process.env.PATH ?? "",
): string | undefined {
  const names =
    process.platform === "win32" ? ["codex.exe", "codex"] : ["codex"];
  for (const directory of pathValue.split(delimiter)) {
    if (!directory) continue;
    for (const name of names) {
      const real = resolvedExecutable(join(directory, name));
      if (real && !isCodexLauncher(real, launcher)) return real;
    }
  }
  return undefined;
}

function installCommandLinks(): void {
  const bin = dirname(process.execPath);
  const destination = join(homedir(), ".local", "bin");
  mkdirSync(destination, { recursive: true });
  for (const name of commandNames) {
    if (executable(name)) continue;
    const source = join(bin, name);
    if (!existsSync(source)) {
      throw new Error(
        `Feuilleton command not found beside the binary: ${source}`,
      );
    }
    const link = join(destination, name);
    if (lstatSafe(link)) rmSync(link, { force: true });
    symlinkSync(source, link);
  }
}
function missingCommands(): string[] {
  return commandNames.filter((name) => !executable(name));
}
function integrationRoot(agent: Agent): string {
  const env = process.env.FTN_INTEGRATIONS_DIR;
  if (env) return join(env, `${agent}-plugin`);
  const installed = resolve(
    dirname(process.execPath),
    "..",
    "share",
    "feuilleton",
    "integrations",
    `${agent}-plugin`,
  );
  if (existsSync(installed)) return installed;
  return resolve(import.meta.dir, "../../../integrations", `${agent}-plugin`);
}

export async function setupAgent(agent: Agent): Promise<void> {
  installCommandLinks();
  if (agent === "claude") {
    if (!executable("claude")) throw new Error("claude is not installed");
    const root = integrationRoot("claude");
    await run(["claude", "plugin", "marketplace", "add", root], true);
    await run(["claude", "plugin", "install", plugin, "--scope", "user"]);
    return;
  }
  const launcher =
    process.env.FTN_CODEX_LAUNCHER ??
    join(dirname(process.execPath), "ftn-codex");
  if (!existsSync(launcher))
    throw new Error(`Codex launcher not found: ${launcher}`);
  const link = join(homedir(), ".local", "bin", "codex");
  const state = readState();
  const saved = isCodexLauncher(state.realCodex, launcher)
    ? undefined
    : resolvedExecutable(state.realCodex);
  const real = findOriginalCodex(launcher) ?? saved;
  if (!real)
    throw new Error("cannot find the original codex executable on PATH");
  state.realCodex = real;
  await run(
    [state.realCodex, "plugin", "marketplace", "add", integrationRoot("codex")],
    true,
  );
  await run([state.realCodex, "plugin", "add", plugin]);
  state.codexLink = link;
  mkdirSync(dirname(link), { recursive: true });
  if (lstatSafe(link)) rmSync(link, { force: true });
  symlinkSync(launcher, link);
  writeState(state);
}
function lstatSafe(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}

export async function removeAgent(agent: Agent): Promise<void> {
  if (agent === "claude") {
    if (executable("claude")) {
      await run(
        ["claude", "plugin", "uninstall", plugin, "--scope", "user", "--yes"],
        true,
      );
      await run(
        ["claude", "plugin", "marketplace", "remove", marketplace],
        true,
      );
    }
    return;
  }
  const state = readState();
  if (state.codexLink && state.realCodex) {
    await run([state.realCodex, "plugin", "remove", plugin], true);
    await run(
      [state.realCodex, "plugin", "marketplace", "remove", marketplace],
      true,
    );
    rmSync(state.codexLink, { force: true });
    symlinkSync(state.realCodex, state.codexLink);
  }
}

export function doctorAgent(agent: Agent): string[] {
  const issues: string[] = [];
  for (const command of missingCommands()) {
    issues.push(`${command} is not installed or not on PATH`);
  }
  if (!executable(agent))
    issues.push(`${agent} is not installed or not on PATH`);
  if (agent === "codex") {
    const state = readState();
    const launcher =
      process.env.FTN_CODEX_LAUNCHER ??
      join(dirname(process.execPath), "ftn-codex");
    if (isCodexLauncher(state.realCodex, launcher))
      issues.push(
        "original Codex path is missing or points to a Feuilleton launcher",
      );
    if (
      state.codexLink &&
      lstatSafe(state.codexLink) &&
      !lstatSync(state.codexLink).isSymbolicLink()
    ) {
      issues.push("configured Codex command is not a symbolic link");
    }
  }
  return issues;
}

export function realCodexPath(): string | undefined {
  if (process.env.FTN_REAL_CODEX) return process.env.FTN_REAL_CODEX;
  const launcher = process.env.FTN_CODEX_LAUNCHER ?? process.execPath;
  const saved = readState().realCodex;
  return isCodexLauncher(saved, launcher)
    ? findOriginalCodex(launcher)
    : resolvedExecutable(saved);
}
