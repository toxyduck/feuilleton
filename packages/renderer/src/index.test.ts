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

  test("renders one widget artifact for each client width", async () => {
    const root = mkdtempSync(join(tmpdir(), "ftn-widget-test-"));
    const store = new ArtifactStore({ ...config("tool").cache, root });
    const artifact = store.create(
      "before\n\u001eFTN_WIDGET\u001eafter\n",
      "",
      0,
      {
        widget: {
          version: 1,
          name: "plot",
          args: ["line"],
          input: "Mon\t10\nTue\t90\nSun\t40\n",
        },
      },
    );
    const tag = `<ftn art="${artifact.id}"/>`;
    const narrow = await new MessageRenderer(
      config("tool"),
      store,
      undefined,
      undefined,
      () => 40,
    ).push(tag, true);
    const wide = await new MessageRenderer(
      config("tool"),
      store,
      undefined,
      undefined,
      () => 80,
    ).push(tag, true);

    expect(narrow).not.toBe(wide);
    expect(narrow).toContain("before");
    expect(narrow).toContain("after");
    expect(narrow).not.toContain("FTN_WIDGET");
    expect(narrow).toContain("render-plot-40");
    expect(wide).toContain("render-plot-80");
    expect(
      Math.max(...narrow.split("\n").map((line) => Array.from(line).length)),
    ).toBeLessThan(
      Math.max(...wide.split("\n").map((line) => Array.from(line).length)),
    );
    store.close();
  });

  test("keeps rendering after one widget artifact fails", async () => {
    const root = mkdtempSync(join(tmpdir(), "ftn-widget-failure-test-"));
    const store = new ArtifactStore({ ...config("tool").cache, root });
    const invalid = store.create("\u001eFTN_WIDGET\u001e", "", 0, {
      widget: {
        version: 1,
        name: "plot",
        args: ["radar"],
        input: "A\t1\n",
      },
    });
    const valid = store.create("hello", "", 0);
    const renderer = new MessageRenderer(config("tool"), store);

    const output = await renderer.push(
      `<ftn art="${invalid.id}"/><ftn art="${valid.id}"/>`,
      true,
    );

    expect(output).toContain("plot failed: unknown plot type: radar");
    expect(output).toContain("hello");
    expect(output).not.toContain("<ftn");
    store.close();
  });
});
