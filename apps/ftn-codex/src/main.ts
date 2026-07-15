#!/usr/bin/env bun
import { realCodexPath } from "@feuilleton/setup";
import { freePort, startCodexProxy } from "@feuilleton/adapter-codex";

const passthrough = new Set([
  "-h",
  "--help",
  "-V",
  "--version",
  "exec",
  "review",
  "login",
  "logout",
  "mcp",
  "plugin",
  "mcp-server",
  "app-server",
  "remote-control",
  "completion",
  "update",
  "doctor",
  "sandbox",
  "debug",
  "apply",
  "cloud",
  "exec-server",
  "features",
  "help",
]);

async function main(): Promise<number> {
  const real = realCodexPath();
  if (!real)
    throw new Error(
      "original Codex path is not configured; run ftn setup codex",
    );
  const args = process.argv.slice(2);
  if (passthrough.has(args[0] ?? "")) {
    const child = Bun.spawn([real, ...args], {
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    });
    return await child.exited;
  }

  const appPort = await freePort();
  const app = Bun.spawn(
    [real, "app-server", "--listen", `ws://127.0.0.1:${appPort}`],
    {
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (
      await fetch(`http://127.0.0.1:${appPort}/readyz`)
        .then((r) => r.ok)
        .catch(() => false)
    )
      break;
    if (app.exitCode !== null)
      throw new Error("codex app-server exited before becoming ready");
    await Bun.sleep(50);
  }
  if (Date.now() >= deadline) {
    app.kill();
    throw new Error("timed out waiting for codex app-server");
  }
  const proxy = await startCodexProxy(`ws://127.0.0.1:${appPort}`);
  const cleanup = async (): Promise<void> => {
    await proxy.close();
    app.kill();
  };
  process.once("SIGINT", () => void cleanup());
  process.once("SIGTERM", () => void cleanup());

  try {
    const tui = Bun.spawn(
      [real, "--remote", `ws://127.0.0.1:${proxy.port}`, ...args],
      {
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      },
    );
    return await tui.exited;
  } finally {
    await cleanup();
  }
}

try {
  process.exitCode = await main();
} catch (error) {
  process.stderr.write(
    `ftn-codex: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
