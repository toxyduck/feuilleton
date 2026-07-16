import { writeFileSync } from "node:fs";
import { loadConfig, trustProject } from "@feuilleton/config";
import { ArtifactStore } from "@feuilleton/artifacts";
import { executeScript } from "@feuilleton/executor";
import { buildAgentContext } from "@feuilleton/context";
import { handleClaudeHook } from "@feuilleton/adapter-claude";
import { handleCodexHook } from "@feuilleton/adapter-codex";
import { doctorAgent, removeAgent, setupAgent } from "@feuilleton/setup";
import { runWidget } from "@feuilleton/widgets";
import { isWidgetName, PLOT_KINDS } from "@feuilleton/core";

const VERSION =
  typeof __FTN_VERSION__ === "string" ? __FTN_VERSION__ : "0.1.1-dev";
type Agent = "codex" | "claude";

function agent(value: string | undefined): Agent {
  if (value === "codex" || value === "claude") return value;
  throw new Error("expected agent: codex or claude");
}

async function stdin(): Promise<string> {
  return await new Response(Bun.stdin.stream()).text();
}

function help(): string {
  return `Feuilleton ${VERSION}

Usage:
  ftn run
  ftn setup <codex|claude>
  ftn remove <codex|claude>
  ftn doctor <codex|claude>
  ftn trust
  ftn context
  ftn plot <${PLOT_KINDS.join("|")}>
  ftn tree
  ftn graph
`;
}

export async function runCli(argv = process.argv.slice(2)): Promise<number> {
  const [command, target] = argv;
  if (
    !command ||
    command === "help" ||
    command === "--help" ||
    command === "-h"
  ) {
    process.stdout.write(help());
    return 0;
  }
  if (command === "--version" || command === "-V") {
    process.stdout.write(`feuilleton ${VERSION}\n`);
    return 0;
  }
  if (command === "run") {
    const config = loadConfig();
    const store = new ArtifactStore(config.cache);
    try {
      const result = await executeScript(await stdin(), config, store);
      if (result.timedOut || result.exitCode !== 0) {
        process.stderr.write(
          result.stderr || `script exited with status ${result.exitCode}\n`,
        );
        return result.exitCode || 124;
      }
      process.stdout.write(`<ftn art="${result.artifactId}"/>\n`);
      return 0;
    } finally {
      store.close();
    }
  }
  if (isWidgetName(command)) {
    const input = await stdin();
    const capture = process.env.FTN_WIDGET_CAPTURE;
    if (capture) {
      writeFileSync(
        capture,
        JSON.stringify({
          version: 1,
          name: command,
          args: argv.slice(1),
          input,
        }),
      );
      process.stdout.write("\u001eFTN_WIDGET\u001e");
    } else {
      process.stdout.write(await runWidget(command, input, argv.slice(1)));
    }
    return 0;
  }
  if (command === "setup") {
    await setupAgent(agent(target));
    process.stdout.write(`${target} integration installed\n`);
    return 0;
  }
  if (command === "remove") {
    await removeAgent(agent(target));
    process.stdout.write(`${target} integration removed\n`);
    return 0;
  }
  if (command === "doctor") {
    const issues = doctorAgent(agent(target));
    if (issues.length) {
      process.stderr.write(issues.map((issue) => `- ${issue}\n`).join(""));
      return 1;
    }
    process.stdout.write(`${target}: ok\n`);
    return 0;
  }
  if (command === "trust") {
    process.stdout.write(`trusted: ${trustProject()}\n`);
    return 0;
  }
  if (command === "context") {
    process.stdout.write(buildAgentContext(loadConfig()));
    return 0;
  }
  if (command === "hook") {
    const selected = agent(target);
    const payload = JSON.parse(await stdin()) as unknown;
    const output =
      selected === "claude"
        ? await handleClaudeHook(payload)
        : handleCodexHook(payload);
    process.stdout.write(JSON.stringify(output));
    return 0;
  }
  throw new Error(`unknown command: ${command}`);
}

declare const __FTN_VERSION__: string;
