import type { FeuilletonConfig } from "@feuilleton/config";
import type { ArtifactRecord } from "@feuilleton/core";

export function buildAgentContext(config: FeuilletonConfig): string {
  const protocol =
    config.execution.mode === "inline"
      ? "Inline mode: Bash in <ftn>...</ftn> is replaced by its stdout. Put widget calls below inside that Bash. For code, Bash prints Markdown fences around cat."
      : "Tool mode: `ftn run` executes stdin Bash and returns stdout as an artifact in the tool result. Widget calls below go inside that Bash. Shape: `ftn run <<'FTN'\n...bash...\nFTN`. Code Bash prints Markdown fences around `cat`.";
  const widgets = Object.entries(config.widgets)
    .map(
      ([name, widget]) =>
        `${name} (${widget.command}): ${widget.description.trim()}`,
    )
    .join("\n");
  return ["Feuilleton:", protocol, "Size supplied.", widgets]
    .filter(Boolean)
    .join("\n");
}

export function buildArtifactContext(records: ArtifactRecord[]): string {
  if (!records.length) return "";
  return [
    "Inline outputs saved for later use; read only when needed:",
    ...records.map((record) => `- ${record.id}: ${record.stdoutPath}`),
  ].join("\n");
}
