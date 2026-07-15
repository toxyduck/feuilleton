import { z } from "zod";
import { loadConfig } from "@feuilleton/config";
import { ArtifactStore } from "@feuilleton/artifacts";
import { buildAgentContext, buildArtifactContext } from "@feuilleton/context";

const inputSchema = z.object({
  hook_event_name: z.string(),
  session_id: z.string(),
  cwd: z.string(),
});

export function handleCodexHook(input: unknown): Record<string, unknown> {
  const event = inputSchema.parse(input);
  const config = loadConfig(event.cwd);
  const store = new ArtifactStore(config.cache);
  try {
    if (event.hook_event_name === "SessionStart") {
      return {
        hookSpecificOutput: {
          hookEventName: "SessionStart",
          additionalContext: buildAgentContext(config),
        },
      };
    }
    if (event.hook_event_name === "UserPromptSubmit") {
      const context = buildArtifactContext(store.undelivered(event.session_id));
      return context
        ? {
            hookSpecificOutput: {
              hookEventName: "UserPromptSubmit",
              additionalContext: context,
            },
          }
        : {};
    }
    return {};
  } finally {
    store.close();
  }
}
