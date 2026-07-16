import { describe, expect, test } from "bun:test";
import {
  classifySelectionStatus,
  type ExpectedUse,
  widgetMatches,
} from "./selection-status";

const base = {
  mode: "with-ftn" as const,
  expectedUse: "optional" as ExpectedUse,
  ftnCalls: 0,
  artifactIds: 0,
  failedFtnCall: false,
  artifactMissing: false,
  widgetPass: true,
  functionalPass: true,
};

describe("selection status", () => {
  test.each([
    ["optional direct success", {}, "correctly_skipped"],
    ["optional artifact success", { artifactIds: 1 }, "applied_correctly"],
    [
      "optional failed FTN",
      { ftnCalls: 1, failedFtnCall: true },
      "command_failed",
    ],
    [
      "recovered FTN",
      { ftnCalls: 2, artifactIds: 1, failedFtnCall: true },
      "applied_correctly",
    ],
    ["optional FTN without tag", { ftnCalls: 1 }, "tag_missing"],
    ["required direct", { expectedUse: "required" }, "not_attempted"],
    [
      "forbidden use",
      { expectedUse: "forbidden", artifactIds: 1 },
      "unnecessary_use",
    ],
    ["baseline direct", { mode: "without-ftn" }, "baseline_clean"],
  ] as const)("%s", (_name, overrides, expected) => {
    expect(classifySelectionStatus({ ...base, ...overrides })).toBe(expected);
  });
});

describe("widget alternatives", () => {
  test("accepts a scalar or one member of an allowed set", () => {
    expect(widgetMatches("plot", "plot")).toBe(true);
    expect(widgetMatches(["histogram", "plot"], "plot")).toBe(true);
    expect(widgetMatches(["histogram", "plot"], "tree")).toBe(false);
  });
});
