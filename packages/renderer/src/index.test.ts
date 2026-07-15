import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ArtifactStore } from "@feuilleton/artifacts";
import { MessageRenderer } from "./index.ts";
import type { FeuilletonConfig } from "@feuilleton/config";

function config(mode: "inline" | "tool"): FeuilletonConfig {
  return {
    execution: { mode, shell: "bash", timeoutSeconds: 5 },
    terminal: { fallbackColumns: 80, horizontalInset: 4 },
    cache: { maxBytes: 1_000_000, maxEntries: 10, ttlDays: 1 },
    widgets: {},
    sources: [],
  };
}

describe("MessageRenderer", () => {
  test("executes inline bash and saves the complete artifact", async () => {
    const root = mkdtempSync(join(tmpdir(), "ftn-test-"));
    const store = new ArtifactStore({ ...config("inline").cache, root });
    const output = await new MessageRenderer(config("inline"), store).push(
      "<ftn>printf hello</ftn>",
      true,
    );
    expect(output).toContain("hello");
    expect(output).not.toContain("[output](<");
    expect(output).not.toContain("artifact:");
    store.close();
  });

  test("does not execute scripts in tool mode", async () => {
    const root = mkdtempSync(join(tmpdir(), "ftn-test-"));
    const store = new ArtifactStore({ ...config("tool").cache, root });
    const output = await new MessageRenderer(config("tool"), store).push(
      "<ftn>printf hello</ftn>",
      true,
    );
    expect(output).toContain("<ftn>printf hello</ftn>");
    expect(output).toContain("ftn run");
    store.close();
  });

  test("renders an artifact reference with a compact output link", async () => {
    const root = mkdtempSync(join(tmpdir(), "ftn-test-"));
    const store = new ArtifactStore({ ...config("tool").cache, root });
    const artifact = store.create("rendered output", "", 0);
    const output = await new MessageRenderer(config("tool"), store).push(
      `<ftn art="${artifact.id}"/>`,
      true,
    );

    expect(output).toContain("rendered output");
    expect(output).toContain(`[output](<${artifact.stdoutPath}>)`);
    expect(output).not.toContain("artifact:");
    store.close();
  });
});
