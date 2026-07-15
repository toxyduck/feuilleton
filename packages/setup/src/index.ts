import {
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
import { dirname, join, resolve } from "node:path";

type Agent = "codex" | "claude";
interface InstallState {
  realCodex?: string;
  codexLink?: string;
}

const statePath = join(homedir(), ".feuilleton", "state", "install.json");

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
function installCommandLinks(): void {
  const bin = dirname(process.execPath);
  const destination = join(homedir(), ".local", "bin");
  mkdirSync(destination, { recursive: true });
  for (const name of ["ftn", "ftn-plot", "ftn-tree", "ftn-graph"]) {
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
  return ["ftn", "ftn-plot", "ftn-tree", "ftn-graph"].filter(
    (name) => !executable(name),
  );
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
    await run([
      "claude",
      "plugin",
      "install",
      "feuilleton@feuilleton",
      "--scope",
      "user",
    ]);
    return;
  }
  const real = executable("codex");
  if (!real) throw new Error("codex is not installed");
  const launcher =
    process.env.FTN_CODEX_LAUNCHER ??
    join(dirname(process.execPath), "ftn-codex");
  if (!existsSync(launcher))
    throw new Error(`Codex launcher not found: ${launcher}`);
  const link = join(homedir(), ".local", "bin", "codex");
  const state = readState();
  if (real !== realpathSync(launcher)) state.realCodex = real;
  if (!state.realCodex)
    throw new Error("cannot determine the original codex executable");
  await run(
    [state.realCodex, "plugin", "marketplace", "add", integrationRoot("codex")],
    true,
  );
  await run([state.realCodex, "plugin", "add", "feuilleton@feuilleton"]);
  state.codexLink = link;
  mkdirSync(dirname(link), { recursive: true });
  if (existsSync(link) || lstatSafe(link)) rmSync(link, { force: true });
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
        [
          "claude",
          "plugin",
          "uninstall",
          "feuilleton@feuilleton",
          "--scope",
          "user",
          "--yes",
        ],
        true,
      );
      await run(
        ["claude", "plugin", "marketplace", "remove", "feuilleton"],
        true,
      );
    }
    return;
  }
  const state = readState();
  if (state.codexLink && state.realCodex) {
    await run(
      [state.realCodex, "plugin", "remove", "feuilleton@feuilleton"],
      true,
    );
    await run(
      [state.realCodex, "plugin", "marketplace", "remove", "feuilleton"],
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
    if (!state.realCodex) issues.push("original Codex path is not recorded");
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
  return process.env.FTN_REAL_CODEX ?? readState().realCodex;
}
