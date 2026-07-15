import { join } from "node:path";
import type { RenderEnvironment } from "@feuilleton/core";
import type { FeuilletonConfig } from "@feuilleton/config";
import type { ArtifactStore } from "@feuilleton/artifacts";

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
  artifactId: string;
  artifactPath: string;
}

export function detectEnvironment(config: FeuilletonConfig): RenderEnvironment {
  const terminalColumns = Number(
    process.stdout.columns ??
      process.env.COLUMNS ??
      config.terminal.fallbackColumns,
  );
  const columns = Number.isFinite(terminalColumns)
    ? terminalColumns - config.terminal.horizontalInset
    : config.terminal.fallbackColumns - config.terminal.horizontalInset;
  const unicode = !["C", "POSIX"].includes(
    process.env.LC_ALL ?? process.env.LANG ?? "",
  );
  const color = Boolean(
    process.stdout.isTTY &&
    !process.env.NO_COLOR &&
    process.env.TERM !== "dumb",
  );
  return {
    columns: Math.max(20, Math.floor(columns)),
    unicode,
    color,
  };
}

export async function executeScript(
  script: string,
  config: FeuilletonConfig,
  store: ArtifactStore,
  metadata: Record<string, unknown> = {},
): Promise<ExecutionResult> {
  const terminal = detectEnvironment(config);
  const proc = Bun.spawn([config.execution.shell], {
    stdin: new Blob([script]),
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      FTN_COLUMNS: String(terminal.columns),
      FTN_UNICODE: terminal.unicode ? "1" : "0",
      FTN_COLOR: terminal.color ? "1" : "0",
      ...(terminal.color ? {} : { NO_COLOR: "1" }),
    },
  });
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    proc.kill();
  }, config.execution.timeoutSeconds * 1000);
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  clearTimeout(timeout);
  const record = store.create(stdout, stderr, exitCode, metadata);
  return {
    stdout,
    stderr,
    exitCode,
    timedOut,
    artifactId: record.id,
    artifactPath: join(record.directory, "stdout"),
  };
}
