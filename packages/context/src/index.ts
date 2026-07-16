import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { FeuilletonConfig } from "@feuilleton/config";
import type { ArtifactRecord } from "@feuilleton/core";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function buildAgentContext(config: FeuilletonConfig): string {
  const guidance = [
    "Use Feuilleton when the user requests a rendered artifact or registered widget, or when it is a useful presentation mechanism for substantial structured output. Feuilleton does not change the normal answer style, completeness, reasoning, or use of unrelated tools.",
    "`ftn` is ready on PATH. Widget commands are a closed set: invoke only exact commands listed below, and only when the requested presentation needs them. If no listed widget fits, print requested Markdown or code directly to stdout inside Feuilleton execution; no wrapper command is needed.",
    "A Feuilleton artifact must contain every finding, record, and explanation the user requested. Necessary prose may also appear outside the artifact; do not omit information merely to reduce tokens.",
    "Pass original numeric values to widgets. Preserve explicit source identifiers, fields, counts, totals, ranks, and flags; derive a value only when the source does not provide it.",
    "Inside Feuilleton execution, use `$TMPDIR` for temporary files and write complete program source using the normal escaping rules of its language.",
  ].join(" ");
  const protocol =
    config.execution.mode === "inline"
      ? "Feuilleton inline mode:\n" +
        guidance +
        "\nFinal-answer parsing executes Bash inside `<ftn>...</ftn>` and replaces the block with stdout. Put display Bash in such a block where its output belongs. Code: print Markdown fences around `cat`."
      : "Feuilleton tool mode:\n" +
        guidance +
        '\n`ftn run` executes stdin Bash, returning `<ftn art="ID"/>`. Pass multiline scripts with one quoted heredoc: `ftn run <<\'BASH\'` … `BASH`; never serialize them through `printf` or nested escaped strings. Inside it, write program source literally; do not double-escape regexes for JSON or the shell. It renders only if the exact returned tag appears in the final answer. Execute a widget command inside the script after any short summary, e.g. `cut -f1,2 data.tsv | ftn-plot line`. Printing TSV, DOT `digraph{...}`, a code fence, or command text is not a widget call. For graph plus prose, Python can print findings then call `subprocess.run(["ftn-graph"], input=dot, text=True, check=True)` in the same heredoc. Code: print Markdown fences around `cat`.';
  const widgets = Object.entries(config.widgets)
    .map(
      ([name, widget]) =>
        `${name}: ${widget.description.trim().replace("Example body:", "E.g.").replace("Example:", "E.g.")}`,
    )
    .join("\n");
  return [protocol, widgets].filter(Boolean).join("\n");
}

export function buildWorkspaceInventory(cwd: string): string {
  try {
    const entries = readdirSync(cwd, { withFileTypes: true })
      .filter((entry) => !entry.name.startsWith("."))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 20)
      .map((entry) => {
        if (entry.isDirectory()) return `- ${entry.name}/`;
        const path = join(cwd, entry.name);
        const bytes = statSync(path).size;
        let schema = "";
        if (entry.name.endsWith(".json") && bytes <= 1_000_000) {
          try {
            const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
            if (isRecord(parsed)) {
              const top = Object.keys(parsed).slice(0, 12);
              schema = `; JSON keys: ${top.join(", ")}`;
              for (const key of top) {
                const value = parsed[key];
                if (isRecord(value)) {
                  const first = Object.values(value).find(isRecord);
                  if (first !== undefined) {
                    schema += `; ${key} record keys: ${Object.keys(first).slice(0, 12).join(", ")}`;
                    break;
                  }
                }
              }
            }
          } catch {
            // Inventory schema hints are best-effort.
          }
        }
        if (/\.(?:csv|tsv)$/.test(entry.name) && bytes <= 1_000_000) {
          try {
            const first = readFileSync(path, "utf8").split(/\r?\n/, 1)[0] ?? "";
            const delimiter = entry.name.endsWith(".tsv") ? "\t" : ",";
            const fields = first.split(delimiter);
            const numericLast =
              fields.length > 1 && Number.isFinite(Number(fields.at(-1)));
            schema += `; delimited schema: ${fields.length} columns; first row ${numericLast ? "is data (last field numeric)" : "may be a header"}`;
          } catch {
            // Inventory schema hints are best-effort.
          }
        }
        return `- ${entry.name} (${bytes} bytes${schema})`;
      });
    return entries.length
      ? [
          `Workspace cwd: ${cwd}`,
          "Inventory (names, sizes, and limited schema hints; values not exposed):",
          ...entries,
        ].join("\n")
      : `Workspace cwd: ${cwd}\nInventory: empty.`;
  } catch {
    return "";
  }
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
  cwd?: string;
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
  if (event.hook_event_name === "SessionStart") {
    const inventory =
      "cwd" in event && typeof event.cwd === "string"
        ? buildWorkspaceInventory(event.cwd)
        : "";
    return hookOutput(
      "SessionStart",
      [buildAgentContext(config), inventory].filter(Boolean).join("\n"),
    );
  }
  if (
    event.hook_event_name === "UserPromptSubmit" &&
    config.execution.mode === "inline"
  ) {
    const context = buildArtifactContext(undelivered());
    return context ? hookOutput("UserPromptSubmit", context) : {};
  }
  return event.hook_event_name === "UserPromptSubmit" ? {} : undefined;
}
