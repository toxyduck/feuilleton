---
name: eval-abstraction-review
description: Independently score eval, harness, prompt, context, oracle, and implementation changes for hardcoding risk and cross-case generalization. Use after every Feuilleton eval instruction or code change, before spending quota on the next model eval, and when reviewing whether a fix encodes fixture-specific answers instead of a reusable mechanism.
---

# Eval Abstraction Review

Review the raw change, its stated objective, and the failing evidence. Do not assume the author's intended fix is general.

## Reviewer independence

Run this skill in a separate Codex child agent or Codex session that did not author the reviewed diff. The author cannot issue the final scores or verdict. State the reviewer agent/session identity in the result. If you authored any part of the diff, return `verdict: revise` and require a different reviewer rather than scoring it as independent.

## Required input

Use:

- the exact diff since the preceding review;
- the user-visible objective;
- the failure or metric evidence that motivated the change;
- affected case IDs only for traceability, never as justification for hardcoding.

If any input is missing, state it and lower confidence. Do not inspect expected answers beyond what is already present in the diff or evidence.

## Score independently

Return four independent integer scores from 0 to 10:

1. `hardcoding_risk`: 0 means no fixture/case coupling; 10 means case IDs, fixture values, expected answers, exact incidental formatting, or one-off branches are encoded directly.
2. `abstraction_score`: 0 means useful only for the observed sample; 10 means a clear mechanism covers a broad class of inputs while preserving validation strength.
3. `atomicity_score`: 0 means the bundle mixes unrelated mechanisms or has no reproducible boundary; 10 means it is one deliberately bounded mechanism with an exact, reproducible diff and evidence.
4. `utility_boundary_risk`: 0 means the change stays inside Feuilleton selection, artifact production, rendering, isolation, or eval validation; 10 means it changes the model's general answer style, completeness, reasoning, or unrelated tool use mainly to reduce tokens or improve eval metrics.

Judge mechanisms, not wording. A long generic-sounding instruction can still be hardcoded. A narrow parser can be appropriate when it implements a real declared format rather than an observed answer.

## Checks

- Look for case IDs, fixture filenames, magic values, expected labels, copied answers, format-sensitive regexes, and branches that exist only for one test.
- Distinguish schema contracts from fixture values. Field names supplied by a real format are less risky than exact record values.
- Check whether an oracle became weaker merely to turn a failure green.
- Check whether the change prevents the failure class or only the exact observed failure.
- Identify likely collateral effects on other cases, token cost, and selection behavior.
- Prefer structured metadata, reusable parsing rules, writable isolation boundaries, and semantic oracles over prompt accumulation.
- Reject a cumulative bundle when the reviewer cannot identify one atomic mechanism. Require unrelated code, instruction, oracle, and test-alignment changes to be reviewed separately.
- Check whether the change is necessary for Feuilleton's utility contract. Feuilleton may govern when and how Feuilleton itself is selected and how its artifacts are produced, but must not suppress unrelated tools, force terse or stylistically different answers, omit requested findings, weaken reasoning, or change general model behavior merely to save tokens.
- Treat a token reduction as evidence only when it follows from less duplicated transport or better artifact handling. Token savings do not justify crossing the utility boundary.

## Verdict

Use this exact compact format:

```text
reviewer: agent-or-session-identity
hardcoding_risk: N/10
abstraction_score: N/10
atomicity_score: N/10
utility_boundary_risk: N/10
confidence: low|medium|high
verdict: pass|revise|exception-required
evidence:
- ...
required_changes:
- ...
```

Set `pass` only when `hardcoding_risk <= 3`, `abstraction_score >= 7`, `atomicity_score >= 8`, and `utility_boundary_risk <= 3`.
Set `revise` when a reusable improvement can meet the gate.
Set `exception-required` only when the domain genuinely requires a narrow contract; state why and require explicit documentation before the next eval.

Do not average the scores. Do not raise abstraction merely because tests pass, and do not lower boundary risk merely because tokens decrease.
