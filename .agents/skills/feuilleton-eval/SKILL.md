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

## Mandatory abstraction gate

Treat one deliberately bounded edit as one atomic change set. After changing eval instructions, context, prompts, harness code, widgets, fixtures, manifests, or oracles, freeze that change set and review it before making another such change or running a quota-consuming model eval:

1. Spawn a separate Codex child agent or use a separate Codex session that did not author the diff. Have that reviewer invoke `eval-abstraction-review` on the exact atomic diff, the objective, and the motivating failure evidence. Merely applying the review skill in the author's own session is not an independent review.
2. The author must not assign or override the final gate scores or verdict. If an independent Codex reviewer cannot be created, stop: do not make the next eval-related change and do not run a quota-consuming eval until independent review is available.
3. Always create or update `evals/ABSTRACTION_AUDIT.ru.md`. Record the UTC time, reviewer agent/session identity, reviewed paths, a SHA-256 hash of the exact review bundle (diff plus objective and evidence), `hardcoding_risk`, `abstraction_score`, `atomicity_score`, `utility_boundary_risk`, confidence, verdict, evidence, and required changes. An audit-only append that faithfully records an already returned review is not a new change set.
4. Do not add the next change set until the current reviewer returns `pass` (`hardcoding_risk <= 3`, `abstraction_score >= 7`, `atomicity_score >= 8`, and `utility_boundary_risk <= 3`).
5. For `revise`, revise only the frozen change set and send the resulting replacement diff to an independent reviewer again.
6. For `exception-required`, document why a narrow domain contract is unavoidable and obtain explicit user acceptance before another change set or quota spend.

The invariant is: one atomic change set -> one independent review result -> pass before the next change set. Do not batch unrelated edits or repeatedly review a growing cumulative diff.

An independent reviewer may see the minimal exact diff of a private manifest, oracle, or expected strategy only when that file is part of the frozen change set being reviewed. Do not reveal unchanged private cases, unrelated expected strategies, or the rest of a private file when a smaller diff is sufficient. Do not add tool suggestions to case prompts or generated workspaces. A real run consumes model quota; obtain confirmation before starting the full suite when the user did not explicitly request execution.
