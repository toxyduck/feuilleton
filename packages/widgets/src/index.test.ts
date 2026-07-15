import { describe, expect, test } from "bun:test";
import { renderGraph, renderPlot, renderTree } from "./index.ts";

describe("built-in widgets", () => {
  test("renders a path tree", () => {
    expect(renderTree("src/api/a.ts\nsrc/ui/b.ts\n")).toContain("├── api");
  });

  test("renders responsive bars", () => {
    expect(renderPlot("api\t42\nweb\t31\n", ["bar"])).toContain("████");
  });

  test("lays out a DOT graph with Graphviz", async () => {
    const output = await renderGraph("digraph { api -> db }");
    expect(output).toContain("[api]");
    expect(output).toContain("[db]");
  });
});
