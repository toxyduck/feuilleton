import type { FeuilletonConfig } from "@feuilleton/config";
import type { ArtifactRecord } from "@feuilleton/core";

export function buildAgentContext(config: FeuilletonConfig): string {
  const protocol =
    config.execution.mode === "inline"
      ? "For long, file, or visual output, put complete Bash in <ftn>...</ftn>; it renders in place. For code, Bash prints Markdown fences around cat. Do not repeat the output."
      : "For long/file/visual output, use only `ftn run` with full Bash on stdin. Tool output renders itself; never paste its tag or repeat it. For code, Bash prints Markdown fences around `cat`.";
  const widgets = Object.entries(config.widgets)
    .map(
      ([name, widget]) =>
        `${name} (${widget.command}): ${widget.description.trim()}`,
    )
    .join("\n");
  return ["Feuilleton:", protocol, "Never pass size.", widgets]
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
