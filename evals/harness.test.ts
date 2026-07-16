import { describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = join(import.meta.dir, "..");

describe("feuilleton eval harness", () => {
  test("validates all deterministic cases without tool hints", () => {
    const result = Bun.spawnSync(["bun", "evals/harness.ts", "validate"], {
      cwd: root,
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toContain(
      "validated 20 deterministic cases",
    );
  });

  test("compares canonical results and reports metric deltas", () => {
    const previous = mkdtempSync(join(tmpdir(), "ftn-eval-prev-"));
    const current = mkdtempSync(join(tmpdir(), "ftn-eval-now-"));
    const base = {
      schema_version: 1,
      suite_hash: "same",
      model: "model",
      reasoning: "low",
      mode: "with-ftn",
      cases: [
        {
          id: "case",
          mode: "with-ftn",
          functional_pass: true,
          ftn_status: "applied_correctly",
          oracle_facts: { x: true },
          expected_use: "required",
          exit_code: 0,
        },
      ],
    };
    const metrics = (tokens: number) => ({
      schema_version: 1,
      model: "model",
      reasoning: "low",
      mode: "with-ftn",
      cases: [
        {
          id: "case",
          mode: "with-ftn",
          input_tokens: tokens,
          cached_input_tokens: 0,
          output_tokens: 10,
          reasoning_output_tokens: 2,
          uncached_input_tokens: tokens,
          total_tokens: tokens + 10,
          visible_output_tokens: 8,
          wall_ms: 100,
          first_event_ms: 0,
          tool_calls: 1,
          command_calls: 1,
          final_response_bytes: 20,
          artifact_bytes: 30,
        },
      ],
    });
    writeFileSync(join(previous, "result.json"), JSON.stringify(base));
    writeFileSync(join(current, "result.json"), JSON.stringify(base));
    writeFileSync(join(previous, "metrics.json"), JSON.stringify(metrics(100)));
    writeFileSync(join(current, "metrics.json"), JSON.stringify(metrics(125)));
    const result = Bun.spawnSync(
      ["bun", "evals/harness.ts", "compare", current, previous],
      { cwd: root },
    );
    expect(result.exitCode).toBe(0);
    const compared = JSON.parse(
      readFileSync(join(current, "compare.json"), "utf8"),
    );
    expect(compared.compatible).toBe(true);
    expect(compared.cases[0].metrics.input_tokens.absolute).toBe(25);
    expect(compared.cases[0].metrics.input_tokens.percent).toBe(25);
  });

  test("scores a complete artifact when the top-level command is indirect", () => {
    const tools = mkdtempSync(join(tmpdir(), "ftn-eval-tools-"));
    const fakeCodex = join(tools, "codex");
    const fakeFtn = join(tools, "ftn");
    writeFileSync(
      fakeCodex,
      `#!/usr/bin/env bash
set -euo pipefail
if [[ "\${1:-}" == "--version" ]]; then echo 'codex-cli fake'; exit 0; fi
id=abcdefgh
dir="$HOME/.cache/feuilleton/$id"
mkdir -p "$dir"
printf '\\x1eFTN_WIDGET\\x1e' >"$dir/stdout"
: >"$dir/stderr"
printf '%s\n' '{"id":"abcdefgh","exitCode":0,"widget":{"version":1,"name":"plot","args":["pie"],"input":"images\\t480\\ndatabases\\t20\\nbackups\\t20\\nlogs\\t20\\nbuilds\\t20\\ndocuments\\t20\\naudio\\t20\\nvideo\\t20\\narchives\\t20\\ncache\\t20\\nmodels\\t20\\nother\\t20"}}' >"$dir/meta.json"
printf '%s\n' \
  '{"type":"thread.started","thread_id":"fixed"}' \
  '{"type":"turn.started"}' \
  '{"type":"item.completed","item":{"id":"cmd","type":"command_execution","command":"sh render.sh","status":"completed"}}' \
  '{"type":"item.completed","item":{"id":"msg","type":"agent_message","text":"<ftn art=\\"abcdefgh\\"/>"}}' \
  '{"type":"turn.completed","usage":{"input_tokens":100,"cached_input_tokens":20,"output_tokens":30,"reasoning_output_tokens":5}}'
`,
    );
    writeFileSync(
      fakeFtn,
      `#!/usr/bin/env bash
if [[ "\${1:-}" == "--version" ]]; then echo 'feuilleton fake'; exit 0; fi
if [[ "\${1:-}" == "hook" ]]; then printf '{}'; exit 0; fi
exit 0
`,
    );
    chmodSync(fakeCodex, 0o755);
    chmodSync(fakeFtn, 0o755);
    const result = Bun.spawnSync(
      ["bun", "evals/harness.ts", "run", "--case", "03-storage-allocation"],
      {
        cwd: root,
        env: {
          ...process.env,
          CODEX_BIN: fakeCodex,
          FTN_BIN: fakeFtn,
          CODEX_API_KEY: "fake",
          FTN_EVAL_SKIP_SANDBOX_PREFLIGHT: "1",
        },
      },
    );
    expect(result.exitCode).toBe(0);
    const runDir = result.stdout.toString().trim().split(/\r?\n/).at(-1)!;
    const report = JSON.parse(
      readFileSync(join(runDir, "result.json"), "utf8"),
    );
    expect(report.cases[0].functional_pass).toBe(true);
    expect(report.cases[0].ftn_status).toBe("applied_correctly");
    expect(report.cases[0].observed_widget).toBe("plot");
    const metrics = JSON.parse(
      readFileSync(join(runDir, "metrics.json"), "utf8"),
    );
    expect(metrics.cases[0].artifact_bytes).toBeGreaterThan(100);
  });
});
