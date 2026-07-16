import { expect, test } from "bun:test";
import { normalizeOracleText } from "./oracle-text";

test("normalizes typographic range dashes for semantic matching", () => {
  expect(normalizeOracleText("100–199 200—299 300−399")).toBe(
    "100-199 200-299 300-399",
  );
  expect(normalizeOracleText("foo—bar −5")).toBe("foo—bar −5");
});
