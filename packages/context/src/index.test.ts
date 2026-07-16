import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "@feuilleton/config";
import { buildAgentContext } from "./index";

describe("agent context", () => {
  test("keeps the default tool prompt within its byte budget", () => {
    const cwd = mkdtempSync(join(tmpdir(), "ftn-context-"));
    const context = buildAgentContext(loadConfig(cwd));

    expect(new TextEncoder().encode(context).byteLength).toBeLessThanOrEqual(
      700,
    );
    expect(context).toContain("Feuilleton tool mode:");
    expect(context).toContain("`ftn run` executes stdin Bash");
    expect(context).toContain('returning `<ftn art="ID"/>`');
    expect(context).toContain("exact tag appears in the final answer");
    expect(context).toContain("Insert each returned tag verbatim");
    expect(context).toContain("otherwise nothing displays");
    expect(context).toContain("Markdown fences around `cat`");
    expect(context).toContain("Feuilleton for any substantial output");
    expect(context).toContain("generating output with Bash");
    expect(context).toContain("use an available widget when it fits");
    expect(context).not.toContain("<ftn>");
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
      700,
    );
    expect(context).toContain("Feuilleton inline mode:");
    expect(context).toContain("<ftn>...</ftn>");
    expect(context).toContain("replaces the block with stdout");
    expect(context).toContain("Put display Bash in such a block");
    expect(context).toContain("Feuilleton for any substantial output");
    expect(context).toContain("generating output with Bash");
    expect(context).toContain("use an available widget when it fits");
    expect(context).not.toContain("ftn run");
  });
});
