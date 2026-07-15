import type { FeuilletonConfig } from "@feuilleton/config";
import type { ArtifactRecord } from "@feuilleton/core";

export function buildAgentContext(config: FeuilletonConfig): string {
  const protocol =
    config.execution.mode === "inline"
      ? "Feuilleton renders Bash stdout for visuals and file/code display. In inline mode, put full Bash in <ftn>...</ftn>; the tag becomes the display. For code, Bash prints Markdown fences around cat."
      : "Feuilleton renders Bash stdout for visuals and file/code display. In tool mode, pass full Bash to `ftn run` on stdin; that tool result is the display. For code, Bash prints Markdown fences around `cat`. One call completes it.";
  const widgets = Object.entries(config.widgets)
    .map(
      ([name, widget]) =>
        `${name} (${widget.command}): ${widget.description.trim()}`,
    )
    .join("\n");
  return ["Feuilleton:", protocol, "Runtime supplies size.", widgets]
    .filter(Boolean)
    .join("\n");
}

export function buildArtifactContext(records: ArtifactRecord[]): string {
  if (!records.length) return "";
  return [
    "New Feuilleton artifacts are available. Read a file only if its output is needed:",
    ...records.map((r) => `- ${r.id}: ${r.stdoutPath}`),
  ].join("\n");
}
