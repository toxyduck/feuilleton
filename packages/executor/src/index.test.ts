import { afterEach, describe, expect, test } from "bun:test";
import { detectEnvironment } from "./index";
import type { FeuilletonConfig } from "@feuilleton/config";

const originalColumns = process.env.COLUMNS;

afterEach(() => {
  if (originalColumns === undefined) delete process.env.COLUMNS;
  else process.env.COLUMNS = originalColumns;
});

function config(inset: number): FeuilletonConfig {
  return {
    execution: { mode: "tool", shell: "bash", timeoutSeconds: 5 },
    terminal: { fallbackColumns: 80, horizontalInset: inset },
    cache: { maxBytes: 1_000, maxEntries: 1, ttlDays: 1 },
    widgets: {},
    sources: [],
  };
}

describe("render environment", () => {
  test("reserves a safe horizontal inset", () => {
    process.env.COLUMNS = "100";
    expect(detectEnvironment(config(4)).columns).toBe(96);
  });

  test("never reports fewer than twenty columns", () => {
    process.env.COLUMNS = "21";
    expect(detectEnvironment(config(4)).columns).toBe(20);
  });
});
