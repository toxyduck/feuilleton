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
      500,
    );
    expect(context).toContain("Tool mode:");
    expect(context).toContain("`ftn run` executes stdin Bash");
    expect(context).toContain("returns stdout as an artifact");
    expect(context).toContain("Widget calls below go inside that Bash");
    expect(context).toContain("ftn run <<'FTN'");
    expect(context).toContain("Markdown fences around `cat`");
    expect(context).not.toContain("<ftn>");
    for (const command of ["ftn-plot", "ftn-tree", "ftn-graph"]) {
      expect(context).toContain(command);
    }
    expect(context).not.toContain("after the response");
    expect(context).not.toContain("<ftn>\n");
  });

  test("describes inline mechanics only in inline mode", () => {
    const cwd = mkdtempSync(join(tmpdir(), "ftn-context-inline-"));
    const config = loadConfig(cwd);
    config.execution.mode = "inline";
    const context = buildAgentContext(config);

    expect(context).toContain("Inline mode:");
    expect(context).toContain("<ftn>...</ftn>");
    expect(context).toContain("is replaced by its stdout");
    expect(context).toContain("Put widget calls below inside that Bash");
    expect(context).not.toContain("ftn run");
  });
});
