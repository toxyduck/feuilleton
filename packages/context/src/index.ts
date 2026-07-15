import type { FeuilletonConfig } from "@feuilleton/config";
import type { ArtifactRecord } from "@feuilleton/core";

export function buildAgentContext(config: FeuilletonConfig): string {
  const protocol =
    config.execution.mode === "inline"
      ? "For terminal visuals, put complete Bash in <ftn>...</ftn>; it runs after the response."
      : 'For terminal visuals, pass complete Bash to `ftn run` on stdin and paste its returned `<ftn art="id"/>`.';
  const widgets = Object.entries(config.widgets)
    .map(
      ([name, widget]) =>
        `${name} (${widget.command}): ${widget.description.trim()}`,
    )
    .join("\n");
  return [
    "Feuilleton:",
    protocol,
    "Runtime sets terminal size; never pass dimensions.",
    widgets,
  ]
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
