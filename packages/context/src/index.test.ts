import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "@feuilleton/config";
import { buildAgentContext, buildWorkspaceInventory } from "./index";

describe("agent context", () => {
  test("keeps the default tool prompt within its byte budget", () => {
    const cwd = mkdtempSync(join(tmpdir(), "ftn-context-"));
    const context = buildAgentContext(loadConfig(cwd));

    expect(new TextEncoder().encode(context).byteLength).toBeLessThanOrEqual(
      3000,
    );
    expect(context).toContain("Feuilleton tool mode:");
    expect(context).toContain("`ftn run` executes stdin Bash");
    expect(context).toContain('returning `<ftn art="ID"/>`');
    expect(context).toContain("Execute a widget command inside the script");
    expect(context).toContain("cut -f1,2 data.tsv | ftn-plot line");
    expect(context).toContain("Printing TSV, DOT");
    expect(context).toContain("DOT `digraph{...}`");
    expect(context).toContain('subprocess.run(["ftn-graph"], input=dot');
    expect(context).toContain("one quoted heredoc");
    expect(context).toContain("never serialize them through `printf`");
    expect(context).toContain("exact returned tag appears in the final answer");
    expect(context).toContain("Markdown fences around `cat`");
    expect(context).toContain("rendered artifact or registered widget");
    expect(context).toContain("does not change the normal answer style");
    expect(context).toContain(
      "completeness, reasoning, or use of unrelated tools",
    );
    expect(context).toContain("`ftn` is ready on PATH");
    expect(context).toContain("Widget commands are a closed set");
    expect(context).toContain("invoke only exact commands listed below");
    expect(context).toContain(
      "only when the requested presentation needs them",
    );
    expect(context).toContain("directly to stdout inside Feuilleton execution");
    expect(context).toContain("no wrapper command is needed");
    expect(context).toContain(
      "must contain every finding, record, and explanation",
    );
    expect(context).toContain(
      "Necessary prose may also appear outside the artifact",
    );
    expect(context).toContain(
      "do not omit information merely to reduce tokens",
    );
    expect(context).toContain("Pass original numeric values to widgets");
    expect(context).toContain("Preserve explicit source identifiers");
    expect(context).toContain(
      "derive a value only when the source does not provide it",
    );
    expect(context).toContain("use `$TMPDIR` for temporary files");
    expect(context).toContain("normal escaping rules of its language");
    expect(context).toContain("line for a time series");
    expect(context).toContain("pie for composition");
    expect(context).toContain("area for accumulated backlog");
    expect(context).not.toContain("<ftn>");
    for (const forbidden of [
      "REQ-NNN",
      "duplicate_versions",
      "step-N",
      "service-N",
      "one-line `/** summary */`",
      "headerless three-column heatmap",
      "fixed-bin summaries",
      "do not run pwd",
      "schema probe",
      "return the exact artifact tag only",
      "never rerun one only to add prose",
    ]) {
      expect(context).not.toContain(forbidden);
    }
    for (const command of ["ftn-plot", "ftn-tree", "ftn-graph"]) {
      expect(context).toContain(command);
    }
    expect(context).not.toContain("Size supplied");
  });

  test("describes inline mechanics only in inline mode", () => {
    const cwd = mkdtempSync(join(tmpdir(), "ftn-context-inline-"));
    const config = loadConfig(cwd);
    config.execution.mode = "inline";
    const context = buildAgentContext(config);

    expect(new TextEncoder().encode(context).byteLength).toBeLessThanOrEqual(
      3000,
    );
    expect(context).toContain("Feuilleton inline mode:");
    expect(context).toContain("<ftn>...</ftn>");
    expect(context).toContain("replaces the block with stdout");
    expect(context).toContain("Put display Bash in such a block");
    expect(context).toContain("does not change the normal answer style");
    expect(context).toContain(
      "Necessary prose may also appear outside the artifact",
    );
    expect(context).toContain("`ftn` is ready on PATH");
    expect(context).not.toContain("ftn run");
  });
});

test("workspace inventory replaces discovery without exposing values", () => {
  const cwd = mkdtempSync(join(tmpdir(), "ftn-context-inventory-"));
  writeFileSync(join(cwd, "metrics.tsv"), "secret-value\n");

  const inventory = buildWorkspaceInventory(cwd);

  expect(inventory).toContain(`Workspace cwd: ${cwd}`);
  expect(inventory).toContain("values not exposed");
  expect(inventory).toContain("metrics.tsv (13 bytes;");
  expect(inventory).not.toContain("secret-value");
});

test("workspace inventory exposes JSON field names but not values", () => {
  const cwd = mkdtempSync(join(tmpdir(), "ftn-context-json-schema-"));
  writeFileSync(
    join(cwd, "lock.json"),
    JSON.stringify({
      collection: { "secret-key": { revision: "secret-revision", copies: 2 } },
    }),
  );

  const inventory = buildWorkspaceInventory(cwd);

  expect(inventory).toContain("JSON keys: collection");
  expect(inventory).toContain("collection record keys: revision, copies");
  expect(inventory).not.toContain("secret-key");
  expect(inventory).not.toContain("secret-revision");
});

test("workspace inventory identifies headerless delimited data without values", () => {
  const cwd = mkdtempSync(join(tmpdir(), "ftn-context-delimited-schema-"));
  writeFileSync(join(cwd, "samples.tsv"), "secret-a\tsecret-b\tsecret-c\t17\n");

  const inventory = buildWorkspaceInventory(cwd);

  expect(inventory).toContain(
    "delimited schema: 4 columns; first row is data (last field numeric)",
  );
  expect(inventory).not.toContain("secret-a");
  expect(inventory).not.toContain("secret-b");
  expect(inventory).not.toContain("secret-c");
});
