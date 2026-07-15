import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { loadConfig } from "@feuilleton/config";
import { ArtifactStore } from "@feuilleton/artifacts";
import { buildAgentContext, buildArtifactContext } from "@feuilleton/context";
import { MessageRenderer } from "@feuilleton/renderer";

const common = z.object({
  hook_event_name: z.string(),
  session_id: z.string(),
  cwd: z.string(),
});
const display = common.extend({
  hook_event_name: z.literal("MessageDisplay"),
  message_id: z.string(),
  index: z.number().int().nonnegative(),
  final: z.boolean(),
  delta: z.string(),
});

export async function handleClaudeHook(
  input: unknown,
): Promise<Record<string, unknown>> {
  const base = common.parse(input);
  const config = loadConfig(base.cwd);
  const store = new ArtifactStore(config.cache);
  try {
    if (base.hook_event_name === "SessionStart") {
      return {
        hookSpecificOutput: {
          hookEventName: "SessionStart",
          additionalContext: buildAgentContext(config),
        },
      };
    }
    if (
      base.hook_event_name === "UserPromptSubmit" &&
      config.execution.mode === "inline"
    ) {
      const context = buildArtifactContext(store.undelivered(base.session_id));
      return context
        ? {
            hookSpecificOutput: {
              hookEventName: "UserPromptSubmit",
              additionalContext: context,
            },
          }
        : {};
    }
    const event = display.parse(input);
    const stateRoot = join(
      homedir(),
      ".cache",
      "feuilleton",
      "hooks",
      event.session_id,
    );
    const statePath = join(stateRoot, `${event.message_id}.json`);
    mkdirSync(stateRoot, { recursive: true });
    const state =
      event.index === 0
        ? undefined
        : (JSON.parse(readFileSync(statePath, "utf8")) as {
            parser: import("@feuilleton/core").StreamingParserState;
          });
    const renderer = new MessageRenderer(
      config,
      store,
      event.session_id,
      state?.parser,
    );
    const content = await renderer.push(event.delta, event.final);
    if (event.final) {
      rmSync(statePath, { force: true });
    } else {
      writeFileSync(statePath, JSON.stringify({ parser: renderer.snapshot() }));
    }
    return {
      hookSpecificOutput: {
        hookEventName: "MessageDisplay",
        displayContent: content,
      },
    };
  } finally {
    store.close();
  }
}
