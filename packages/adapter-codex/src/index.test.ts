import { expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { transformCodexMessage } from "./index.ts";

test("transforms Codex delta and completed message once", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "ftn-codex-"));
  mkdirSync(join(cwd, ".feuilleton"));
  writeFileSync(
    join(cwd, ".feuilleton", "config.toml"),
    '[execution]\nmode = "inline"\n',
  );
  process.env.FTN_TRUST_ALL = "1";
  const state = new Map();
  const delta = await transformCodexMessage(
    JSON.stringify({
      method: "item/agentMessage/delta",
      params: { itemId: "one", delta: "<ftn>printf hello</ftn>" },
    }),
    state,
    cwd,
  );
  expect(JSON.parse(delta).params.delta).toContain("hello");
  const completed = await transformCodexMessage(
    JSON.stringify({
      method: "item/completed",
      params: {
        item: {
          id: "one",
          type: "agentMessage",
          text: "<ftn>printf hello</ftn>",
        },
      },
    }),
    state,
    cwd,
  );
  expect(JSON.parse(completed).params.item.text.match(/hello/g)).toHaveLength(
    1,
  );
});

test("keeps the artifact store open across split Codex deltas", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "ftn-codex-split-"));
  mkdirSync(join(cwd, ".feuilleton"));
  writeFileSync(
    join(cwd, ".feuilleton", "config.toml"),
    '[execution]\nmode = "inline"\n',
  );
  process.env.FTN_TRUST_ALL = "1";
  const state = new Map();
  const first = await transformCodexMessage(
    JSON.stringify({
      method: "item/agentMessage/delta",
      params: { itemId: "split", delta: "<ftn>printf" },
    }),
    state,
    cwd,
  );
  expect(JSON.parse(first).params.delta).toBe("");
  const second = await transformCodexMessage(
    JSON.stringify({
      method: "item/agentMessage/delta",
      params: { itemId: "split", delta: " hello</ftn>" },
    }),
    state,
    cwd,
  );
  expect(JSON.parse(second).params.delta).toContain("hello");
});
