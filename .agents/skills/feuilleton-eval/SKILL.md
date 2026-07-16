---
name: feuilleton-eval
description: Run and compare the repository's deterministic isolated Codex evaluation suite for Feuilleton. Use when asked to evaluate tool selection, execute the 20-case agent harness, run a single eval case, collect token and timing metrics, create a baseline without Feuilleton, or compare two saved runs.
---

# Feuilleton Eval

Run the deterministic harness rather than reproducing its orchestration manually.

1. For the standard 20-case paired evaluation, run `bun run eval` from the repository root. This single command validates the suite, checks the environment, runs both modes, writes reports, and compares the results.
2. Use the lower-level harness only for a narrower requested scope or diagnostics:
   - One case: `bun evals/harness.ts run --case <case-id>`
   - Feuilleton only: `bun evals/harness.ts run`
   - Baseline: `bun evals/harness.ts run --mode without-ftn`
   - Environment diagnostics only: `bun evals/harness.ts preflight --mode <with-ftn|without-ftn|both>`
   - Suite validation only: `bun evals/harness.ts validate`
3. If sandbox preflight fails, do not bypass it. Report every failed check together with the remediation printed by the harness.
4. Preserve the default `gpt-5.6-luna` model and `low` reasoning unless the user explicitly overrides them.
5. Compare saved runs with `bun evals/harness.ts compare <current-run-dir> <previous-run-dir>`.
6. Report the run directory, functional failures, Feuilleton selection statuses, and metric deltas. Do not interpret metric changes as regressions unless the user supplies a policy.

Do not reveal private case manifests or expected strategies to child Codex sessions. Do not add tool suggestions to case prompts or generated workspaces. A real run consumes model quota; obtain confirmation before starting the full suite when the user did not explicitly request execution.
