import { describe, expect, test } from "bun:test";
import { renderGraph, renderPlot, renderTree } from "./index.ts";

describe("built-in widgets", () => {
  test("renders a path tree", () => {
    expect(renderTree("src/api/a.ts\nsrc/ui/b.ts\n")).toContain("├── api");
  });

  test("renders responsive bars", () => {
    expect(renderPlot("api\t42\nweb\t31\n", ["bar"])).toContain("████");
  });

  test("renders compact labeled braille lines", () => {
    const previous = process.env.FTN_COLUMNS;
    process.env.FTN_COLUMNS = "200";
    try {
      const output = renderPlot("Mon\t10\nTue\t90\nSun\t40\n", ["line"]);
      expect(output).toContain("Mon");
      expect(output).toContain("Sun");
      expect(output).toMatch(/[\u2801-\u28ff]/);
      expect(
        Math.max(
          ...output
            .trimEnd()
            .split("\n")
            .map((line) => Array.from(line).length),
        ),
      ).toBeLessThanOrEqual(70);
    } finally {
      if (previous === undefined) delete process.env.FTN_COLUMNS;
      else process.env.FTN_COLUMNS = previous;
    }
  });

  test("renders a filled area plot", () => {
    const output = renderPlot("Mon\t10\nTue\t90\nSun\t40\n", ["area"], 50);
    expect(output).toContain("Mon");
    expect((output.match(/[\u2801-\u28ff]/g) ?? []).length).toBeGreaterThan(20);
  });

  test("renders a pie with percentages and a legend", () => {
    const output = renderPlot("api\t3\nweb\t1\n", ["pie"], 50);
    expect(output).toContain("api 75.0%");
    expect(output).toContain("web 25.0%");
    expect(output).toContain("█");
    expect(output).toContain("▓");
  });

  test("lays out a DOT graph with Graphviz", async () => {
    const output = await renderGraph("digraph { api -> db }");
    expect(output).toContain("[api]");
    expect(output).toContain("[db]");
  });
});
