import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "./index";

describe("configuration", () => {
  test("uses tool execution by default", () => {
    const cwd = mkdtempSync(join(tmpdir(), "ftn-config-"));

    expect(loadConfig(cwd).execution.mode).toBe("tool");
  });
});
