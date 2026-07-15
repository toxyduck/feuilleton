import { describe, expect, test } from "bun:test";
import { StreamingParser, parseDirective } from "./index.ts";

describe("StreamingParser", () => {
  test("parses scripts split across chunks", () => {
    const parser = new StreamingParser();
    expect(parser.push("before <f").segments).toEqual(["before "]);
    expect(parser.push("tn>printf hi").segments).toEqual([]);
    const result = parser.push("</ftn> after", true).segments;
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ type: "execute", script: "printf hi" });
    expect(result[1]).toBe(" after");
  });

  test("passes an incomplete block through on final", () => {
    const parser = new StreamingParser();
    expect(parser.push("<ftn>echo hi", true).segments).toEqual([
      "<ftn>echo hi",
    ]);
  });

  test("parses compact artifact tags", () => {
    expect(parseDirective('<ftn art="abcdefgh"/>')).toMatchObject({
      type: "artifact",
      id: "abcdefgh",
    });
  });

  test("parses multiple artifact tags followed by text", () => {
    const parser = new StreamingParser();
    const segments = parser.push(
      `# One\n<ftn art="abcdefgh"/>\n# Two\n<ftn art="bcdefgha"/>\n`,
      true,
    ).segments;
    expect(
      segments.filter((segment) => typeof segment !== "string"),
    ).toHaveLength(2);
    expect(segments).toContain("\n# Two\n");
  });
});
