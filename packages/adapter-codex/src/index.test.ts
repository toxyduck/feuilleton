import { expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ArtifactStore } from "@feuilleton/artifacts";
import {
  handleCodexHook,
  transformCodexFrame,
  transformCodexMessage,
} from "./index.ts";

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

test("delivers saved output links only in inline mode", () => {
  const original = Object.getOwnPropertyDescriptor(
    ArtifactStore.prototype,
    "undelivered",
  )!;
  let calls = 0;
  ArtifactStore.prototype.undelivered = function () {
    calls += 1;
    return [];
  };
  try {
    const toolCwd = mkdtempSync(join(tmpdir(), "ftn-hook-tool-"));
    handleCodexHook({
      hook_event_name: "UserPromptSubmit",
      session_id: "tool-session",
      cwd: toolCwd,
    });
    expect(calls).toBe(0);

    const inlineCwd = mkdtempSync(join(tmpdir(), "ftn-hook-inline-"));
    mkdirSync(join(inlineCwd, ".feuilleton"));
    writeFileSync(
      join(inlineCwd, ".feuilleton", "config.toml"),
      '[execution]\nmode = "inline"\n',
    );
    process.env.FTN_TRUST_ALL = "1";
    handleCodexHook({
      hook_event_name: "UserPromptSubmit",
      session_id: "inline-session",
      cwd: inlineCwd,
    });
    expect(calls).toBe(1);
  } finally {
    Object.defineProperty(ArtifactStore.prototype, "undelivered", original);
  }
});

test("transforms agent messages carried in binary WebSocket frames", async () => {
  const frame = await transformCodexFrame(
    Buffer.from(
      JSON.stringify({
        method: "item/agentMessage/delta",
        params: { itemId: "binary", delta: '<ftn art="abcdefgh"/>' },
      }),
    ),
    new Map(),
    mkdtempSync(join(tmpdir(), "ftn-codex-binary-")),
  );

  expect(frame).toContain("artifact abcdefgh expired");
  expect(frame).not.toContain('<ftn art="abcdefgh"/>');
});
