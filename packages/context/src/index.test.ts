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
    expect(context).toContain("ftn run");
    expect(context).toContain("renders itself");
    expect(context).toContain("Markdown fences around `cat`");
    expect(context).toContain("never paste its tag or repeat it");
    expect(context).not.toContain("ftn inline");
    for (const command of ["ftn-plot", "ftn-tree", "ftn-graph"]) {
      expect(context).toContain(command);
    }
    expect(context).not.toContain("after the response");
    expect(context).not.toContain("<ftn>\n");
  });
});
