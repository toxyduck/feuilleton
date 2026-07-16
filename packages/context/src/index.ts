import type { FeuilletonConfig } from "@feuilleton/config";
import type { ArtifactRecord } from "@feuilleton/core";

export function buildAgentContext(config: FeuilletonConfig): string {
  const guidance =
    "Use Feuilleton for any substantial output to save response tokens. Prefer generating output with Bash whenever that is more token-efficient, and use an available widget when it fits.";
  const protocol =
    config.execution.mode === "inline"
      ? "Feuilleton inline mode:\n" +
        guidance +
        "\nFinal-answer parsing executes Bash inside `<ftn>...</ftn>` and replaces the block with stdout. Put display Bash in such a block where its output belongs. Code: print Markdown fences around `cat`."
      : "Feuilleton tool mode:\n" +
        guidance +
        '\n`ftn run` executes stdin Bash, returning `<ftn art="ID"/>`. It renders only if that exact tag appears in the final answer. Insert each returned tag verbatim where its output belongs; otherwise nothing displays. Code: print Markdown fences around `cat`.';
  const widgets = Object.entries(config.widgets)
    .map(
      ([name, widget]) =>
        `${name}: ${widget.description.trim().replace("Example body:", "E.g.").replace("Example:", "E.g.")}`,
    )
    .join("\n");
  return [protocol, widgets].filter(Boolean).join("\n");
}

export function buildArtifactContext(records: ArtifactRecord[]): string {
  if (!records.length) return "";
  return [
    "Inline outputs saved for later use; read only when needed:",
    ...records.map((record) => `- ${record.id}: ${record.stdoutPath}`),
  ].join("\n");
}

interface ContextHookEvent {
  hook_event_name: string;
  session_id: string;
}

function hookOutput(name: string, additionalContext: string) {
  return {
    hookSpecificOutput: { hookEventName: name, additionalContext },
  };
}

export function buildContextHookOutput(
  event: ContextHookEvent,
  config: FeuilletonConfig,
  undelivered: () => ArtifactRecord[],
): Record<string, unknown> | undefined {
  if (event.hook_event_name === "SessionStart")
    return hookOutput("SessionStart", buildAgentContext(config));
  if (
    event.hook_event_name === "UserPromptSubmit" &&
    config.execution.mode === "inline"
  ) {
    const context = buildArtifactContext(undelivered());
    return context ? hookOutput("UserPromptSubmit", context) : {};
  }
  return event.hook_event_name === "UserPromptSubmit" ? {} : undefined;
}
