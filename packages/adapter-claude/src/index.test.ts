import { expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { handleClaudeHook } from "./index.ts";

test("streams normal Claude text and buffers only an open ftn block", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "ftn-claude-"));
  const session = `session-${crypto.randomUUID()}`;
  const message = crypto.randomUUID();
  const first = await handleClaudeHook({
    hook_event_name: "MessageDisplay",
    session_id: session,
    cwd,
    message_id: message,
    index: 0,
    final: false,
    delta: "Visible immediately.\n",
  });
  expect(
    (first.hookSpecificOutput as { displayContent: string }).displayContent,
  ).toBe("Visible immediately.\n");
  const second = await handleClaudeHook({
    hook_event_name: "MessageDisplay",
    session_id: session,
    cwd,
    message_id: message,
    index: 1,
    final: false,
    delta: "<ftn>printf hello",
  });
  expect(
    (second.hookSpecificOutput as { displayContent: string }).displayContent,
  ).toBe("");
  const final = await handleClaudeHook({
    hook_event_name: "MessageDisplay",
    session_id: session,
    cwd,
    message_id: message,
    index: 2,
    final: true,
    delta: "</ftn>",
  });
  expect(
    (final.hookSpecificOutput as { displayContent: string }).displayContent,
  ).toContain("tool mode");
});
