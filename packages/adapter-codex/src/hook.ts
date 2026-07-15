import { z } from "zod";
import { loadConfig } from "@feuilleton/config";
import { buildAgentContext } from "@feuilleton/context";

const inputSchema = z.object({
  hook_event_name: z.string(),
  session_id: z.string(),
  cwd: z.string(),
});

export function handleCodexHook(input: unknown): Record<string, unknown> {
  const event = inputSchema.parse(input);
  const config = loadConfig(event.cwd);
  if (event.hook_event_name === "SessionStart") {
    return {
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: buildAgentContext(config),
      },
    };
  }
  return {};
}
